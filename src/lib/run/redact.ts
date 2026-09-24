import { createRequire } from "node:module";
import { readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { extname, join } from "node:path";

// Phase 20 (TFP-094): a run that logged in must not hand back its credentials
// or its session.
//
// Found while building this ticket, not assumed: a real authenticated run's
// trace.zip contained the full storageState - the session cookie and its
// value, recorded in the trace's context options - even though the login
// itself ran outside any traced context. So capture is not "excluded by
// default"; every artifact and report a run produces is scrubbed of the
// run's secret values before it can reach the result, the persisted
// evidence, or a download. Two independent layers: value-based redaction of
// everything text (including the contents of trace zips), and a structural
// pass that drops any storageState key outright.
//
// It fails closed: an artifact that cannot be scrubbed and might hold a
// secret is deleted, never kept.

export const REDACTED = "[redacted]";

// A value shorter than this is not redacted: replacing a 1-3 character
// string would shred every unrelated occurrence and prove nothing.
const MIN_SECRET_LENGTH = 4;

const BINARY_EXTENSIONS = new Set([
    ".png", ".jpg", ".jpeg", ".gif", ".webp", ".ico", ".bmp",
    ".webm", ".mp4", ".mov",
    ".woff", ".woff2", ".ttf", ".otf", ".eot",
    ".pdf", ".wasm",
]);

const TEXT_EXTENSIONS = new Set([
    ".md", ".txt", ".json", ".log", ".html", ".htm", ".css", ".js", ".ts", ".xml", ".yml", ".yaml", ".csv", ".svg",
    ".trace", ".network", ".stacks", ".har",
]);

// Every form a secret can take in captured text: as-is, escaped for a JSON
// string (traces and reports are JSON), and percent-encoded/decoded (cookie
// and query values travel that way).
function variantsOf(secret: string) {
    const variants = new Set<string>([secret, JSON.stringify(secret).slice(1, -1)]);

    try {
        variants.add(encodeURIComponent(secret));
    } catch { /* lone surrogate: no encoded form */ }

    try {
        variants.add(decodeURIComponent(secret));
    } catch { /* not a percent-encoded string */ }

    return [...variants].filter((variant) => variant.length >= MIN_SECRET_LENGTH);
}

export function buildRedactor(secrets: Iterable<string>) {
    const variants = [...new Set([...secrets].filter((secret) => secret.length >= MIN_SECRET_LENGTH).flatMap(variantsOf))]
        // Longest first, so a secret containing another is replaced whole.
        .sort((left, right) => right.length - left.length);

    const redact = (text: string) => variants.reduce((current, variant) => current.split(variant).join(REDACTED), text);

    return {
        redact,
        // True when nothing needs redacting at all.
        isEmpty: variants.length === 0,
        // Bytes to look for in a file that cannot be scrubbed safely.
        variantBuffers: variants.map((variant) => Buffer.from(variant, "utf8")),
    };
}

export type Redactor = ReturnType<typeof buildRedactor>;

// The values inside a Playwright storageState: cookie values and web-storage
// values. Names are not secret.
export function secretsFromStorageState(state: unknown): string[] {
    if (!state || typeof state !== "object") {
        return [];
    }

    const { cookies, origins } = state as { cookies?: unknown; origins?: unknown };
    const values: string[] = [];

    for (const cookie of Array.isArray(cookies) ? cookies : []) {
        if (cookie && typeof cookie.value === "string") {
            values.push(cookie.value);
        }
    }

    for (const origin of Array.isArray(origins) ? origins : []) {
        for (const entry of Array.isArray(origin?.localStorage) ? origin.localStorage : []) {
            if (entry && typeof entry.value === "string") {
                values.push(entry.value);
            }
        }
    }

    return values;
}

// Deep-scrubs anything JSON-shaped: strings are redacted, and any key named
// storageState is dropped entirely (the structural layer, independent of
// knowing the values).
export function redactDeep<T>(value: T, redactor: Redactor): T {
    if (typeof value === "string") {
        return redactor.redact(value) as T;
    }

    if (Array.isArray(value)) {
        return value.map((item) => redactDeep(item, redactor)) as T;
    }

    if (value && typeof value === "object") {
        return Object.fromEntries(
            Object.entries(value as Record<string, unknown>)
                .filter(([key]) => key !== "storageState")
                .map(([key, item]) => [key, redactDeep(item, redactor)])
        ) as T;
    }

    return value;
}

export interface ZipEntryData {
    name: string;
    data: Buffer;
    mtime: Date;
}

// playwright-core bundles yauzl/yazl for its own trace handling; using them
// avoids adding a zip dependency. They are an internal export, so the
// regression test that greps a real trace for the secrets is what guards
// against an update moving them.
interface ZipReader {
    on(event: string, listener: (...args: never[]) => void): void;
    readEntry(): void;
    openReadStream(entry: unknown, callback: (error: Error | null, stream: NodeJS.ReadableStream) => void): void;
}

interface ZipWriter {
    outputStream: NodeJS.ReadableStream;
    addBuffer(buffer: Buffer, name: string, options: { mtime: Date }): void;
    end(): void;
}

function zipTools() {
    // Resolved from the working directory (the repo root, where node_modules
    // lives) rather than import.meta.url, which the Playwright test loader
    // (CommonJS) cannot compile.
    const require = createRequire(join(process.cwd(), "package.json"));
    return require("playwright-core/lib/zipBundle") as {
        yauzl: {
            fromBuffer: (
                buffer: Buffer,
                options: { lazyEntries: boolean },
                callback: (error: Error | null, zip: ZipReader | undefined) => void
            ) => void;
        };
        yazl: { ZipFile: new () => ZipWriter };
    };
}

export async function readZipEntries(buffer: Buffer): Promise<ZipEntryData[]> {
    return readZip(buffer);
}

function readZip(buffer: Buffer): Promise<ZipEntryData[]> {
    const { yauzl } = zipTools();

    return new Promise((resolve, reject) => {
        yauzl.fromBuffer(buffer, { lazyEntries: true }, (openError, zip) => {
            if (openError || !zip) {
                reject(openError ?? new Error("could not open zip"));
                return;
            }

            const entries: ZipEntryData[] = [];
            zip.on("error", reject);
            zip.on("end", () => resolve(entries));
            zip.on("entry", (entry: { fileName: string; getLastModDate: () => Date }) => {
                if (entry.fileName.endsWith("/")) {
                    zip.readEntry();
                    return;
                }

                zip.openReadStream(entry, (streamError: Error | null, stream: NodeJS.ReadableStream) => {
                    if (streamError || !stream) {
                        reject(streamError ?? new Error("could not read zip entry"));
                        return;
                    }

                    const chunks: Buffer[] = [];
                    stream.on("data", (chunk: Buffer) => chunks.push(chunk));
                    stream.on("error", reject);
                    stream.on("end", () => {
                        entries.push({ name: entry.fileName, data: Buffer.concat(chunks), mtime: entry.getLastModDate() });
                        zip.readEntry();
                    });
                });
            });
            zip.readEntry();
        });
    });
}

function writeZip(entries: ZipEntryData[]): Promise<Buffer> {
    const { yazl } = zipTools();

    return new Promise((resolve, reject) => {
        const zip = new yazl.ZipFile();
        const chunks: Buffer[] = [];

        zip.outputStream.on("data", (chunk: Buffer) => chunks.push(chunk));
        zip.outputStream.on("error", reject);
        zip.outputStream.on("end", () => resolve(Buffer.concat(chunks)));

        for (const entry of entries) {
            zip.addBuffer(entry.data, entry.name, { mtime: entry.mtime });
        }

        zip.end();
    });
}

function isBinaryName(name: string) {
    return BINARY_EXTENSIONS.has(extname(name).toLowerCase());
}

export async function scrubZipBuffer(buffer: Buffer, redactor: Redactor) {
    const entries = await readZip(buffer);
    let changed = false;

    const scrubbed = entries.map((entry) => {
        if (isBinaryName(entry.name)) {
            return entry;
        }

        const original = entry.data.toString("utf8");
        const redacted = redactor.redact(original);

        if (redacted === original) {
            return entry;
        }

        changed = true;
        return { ...entry, data: Buffer.from(redacted, "utf8") };
    });

    return { changed, buffer: changed ? await writeZip(scrubbed) : buffer };
}

export interface ScrubNote {
    file: string;
    action: "scrubbed" | "removed";
    reason?: string;
}

async function listFiles(dir: string): Promise<string[]> {
    const entries = await readdir(dir, { withFileTypes: true }).catch(() => []);
    const nested = await Promise.all(
        entries.map((entry) => (entry.isDirectory() ? listFiles(join(dir, entry.name)) : Promise.resolve([join(dir, entry.name)])))
    );
    return nested.flat();
}

async function scrubFile(file: string, redactor: Redactor): Promise<ScrubNote | null> {
    const extension = extname(file).toLowerCase();

    if (extension === ".zip") {
        const original = await readFile(file);
        const { changed, buffer } = await scrubZipBuffer(original, redactor);

        if (!changed) {
            return null;
        }

        // Write beside, then swap in, so a failure can't leave a half file.
        await writeFile(`${file}.scrubbed`, buffer);
        await rename(`${file}.scrubbed`, file);
        return { file, action: "scrubbed" };
    }

    if (BINARY_EXTENSIONS.has(extension)) {
        return null;
    }

    const original = await readFile(file);

    if (TEXT_EXTENSIONS.has(extension)) {
        const text = original.toString("utf8");
        const redacted = redactor.redact(text);

        if (redacted === text) {
            return null;
        }

        await writeFile(file, redacted, "utf8");
        return { file, action: "scrubbed" };
    }

    // An unrecognized type: it cannot be scrubbed without risking corrupting
    // it, so if it holds a secret it cannot be kept.
    if (redactor.variantBuffers.some((secret) => original.includes(secret))) {
        await rm(file, { force: true });
        return { file, action: "removed", reason: "an unrecognized file type that contains a credential or session value" };
    }

    return null;
}

// Scrubs every artifact a run produced, in place, before anything is
// collected, served, or persisted. Fails closed: a file that cannot be
// scrubbed is deleted.
export async function scrubArtifactDirectory(dir: string, redactor: Redactor): Promise<ScrubNote[]> {
    if (redactor.isEmpty) {
        return [];
    }

    const notes: ScrubNote[] = [];

    for (const file of await listFiles(dir)) {
        try {
            const note = await scrubFile(file, redactor);
            if (note) {
                notes.push(note);
            }
        } catch (error) {
            await rm(file, { force: true }).catch(() => { });
            await rm(`${file}.scrubbed`, { force: true }).catch(() => { });
            notes.push({
                file,
                action: "removed",
                reason: `it could not be scrubbed (${error instanceof Error ? error.message.split("\n")[0] : "unknown error"})`,
            });
        }
    }

    return notes;
}
