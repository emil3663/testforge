import { readFile } from "fs/promises";
import { resolve } from "path";
import { BEST_PRACTICE_OPTIONS } from "@/app/_lib/constants";
import type { BestPracticeArea } from "@/lib/generate/mock/types";
import { normalizeRunMode, RunModeError, type RunMode } from "@/lib/comprehensive/run-mode";
import { normalizeBaseUrl } from "@/lib/generate/normalize";
import { normalizeLoginConfig, RunLoginError, type LoginConfig } from "@/lib/run/auth";

/**
 * Phase 47 (TFP-245): what `mr-onion run` was asked to do, from its flags and an optional JSON config file
 * (`--config`; a flag wins over the file). Anything it can't use is a ConfigError naming the field: exit 3
 * (Decision 5), never a run of something other than what was asked.
 */

export class ConfigError extends Error {
    readonly field: string;

    constructor(field: string, message: string) {
        super(`${field}: ${message}`);
        this.field = field;
    }
}

export interface ServerSpec {
    command: string;
    port: number;
}

export interface CliConfig {
    url: string;
    runMode: RunMode;
    practices: BestPracticeArea[];
    auditMode: "fast" | "deep";
    description: string;
    /** Pages to test instead of the crawl's selection; empty means crawl and select as the UI does. */
    pages: string[];
    interactive: boolean;
    login: LoginConfig | null;
    out: string;
    dataDir: string | null;
    reportOnly: boolean;
    /** TFP-246: the run to compare with - a run.json, or "latest" (the newest like run in the data folder); null for none. */
    baseline: string | null;
    servers: ServerSpec[];
    serverTimeoutMs: number;
}

const PRACTICES = BEST_PRACTICE_OPTIONS.map((option) => option.id) as BestPracticeArea[];
const DEFAULT_SERVER_TIMEOUT_S = 120;

export const USAGE = `Usage: mr-onion run --url <base URL> [options]

  --url <url>              the site to test (required)
  --mode <mode>            standard (default) or comprehensive
  --area <area>            comprehensive only: security or accessibility
  --page-cap <n>           comprehensive only: pages to cover (default 20)
  --practices <a,b,...>    Standard's areas (default: all ten)
  --audit-mode <mode>      fast (default) or deep
  --description <text>     what to test, as typed in the UI
  --pages </a,/b,...>      test these pages instead of crawling
  --interactive            also run the interactive (journey) tests
  --out <dir>              where the reports go (default ./mr-onion-out)
  --data-dir <dir>         Mr Onion's data folder, runs included (restore and save it between jobs)
  --report-only            report failures, exit 0 unless the run couldn't run
  --baseline <run.json>    fail only on failures this earlier run didn't have; "latest" for the
                           newest run of the same site and tests in the data folder
  --server "<command>"     start this before the run; give its --port next (repeatable)
  --port <n>               the port the --server before it answers on
  --server-timeout <s>     how long a server may take to answer (default 120)
  --config <file>          a JSON file with any of these, plus "login"

Exit codes: 0 no failures (with --baseline: no new ones), 1 test failures, 2 couldn't run, 3 invalid configuration.`;

const FILE_FIELDS = ["url", "mode", "area", "pageCap", "practices", "auditMode", "description", "pages", "interactive", "login", "out", "dataDir", "reportOnly", "baseline", "servers", "serverTimeout"] as const;
type FileField = (typeof FILE_FIELDS)[number];
type Raw = Partial<Record<FileField, unknown>>;

const FLAGS: Record<string, { field: FileField; kind: "string" | "boolean" | "list" | "number" }> = {
    "--url": { field: "url", kind: "string" },
    "--mode": { field: "mode", kind: "string" },
    "--area": { field: "area", kind: "string" },
    "--page-cap": { field: "pageCap", kind: "number" },
    "--practices": { field: "practices", kind: "list" },
    "--audit-mode": { field: "auditMode", kind: "string" },
    "--description": { field: "description", kind: "string" },
    "--pages": { field: "pages", kind: "list" },
    "--interactive": { field: "interactive", kind: "boolean" },
    "--out": { field: "out", kind: "string" },
    "--data-dir": { field: "dataDir", kind: "string" },
    "--report-only": { field: "reportOnly", kind: "boolean" },
    "--baseline": { field: "baseline", kind: "string" },
    "--server-timeout": { field: "serverTimeout", kind: "number" },
};

function numberFrom(flag: string, value: string) {
    const number = Number(value);
    if (value.trim() === "" || !Number.isFinite(number)) throw new ConfigError(flag, `must be a number, got "${value}"`);
    return number;
}

/** The flags after `run`, as the config file's fields. `--server` and `--port` pair up in order. */
export function parseFlags(argv: string[]): { raw: Raw; configFile: string | null } {
    const raw: Raw = {};
    let configFile: string | null = null;
    const servers: { command: unknown; port: unknown }[] = [];
    for (let index = 0; index < argv.length; index++) {
        const flag = argv[index];
        const value = () => {
            const next = argv[index + 1];
            if (next === undefined || next.startsWith("--")) throw new ConfigError(flag, "needs a value");
            index += 1;
            return next;
        };
        if (flag === "--config") {
            configFile = value();
        } else if (flag === "--server") {
            servers.push({ command: value(), port: undefined });
        } else if (flag === "--port") {
            const last = servers[servers.length - 1];
            if (!last || last.port !== undefined) throw new ConfigError("--port", "must follow the --server it belongs to");
            last.port = numberFrom("--port", value());
        } else if (FLAGS[flag]) {
            const { field, kind } = FLAGS[flag];
            raw[field] = kind === "boolean" ? true : kind === "number" ? numberFrom(flag, value()) : kind === "list" ? value().split(",").map((item) => item.trim()).filter(Boolean) : value();
        } else {
            throw new ConfigError(flag, "is not an option of mr-onion run");
        }
    }
    if (servers.length > 0) raw.servers = servers;
    return { raw, configFile };
}

export async function readConfigFile(file: string): Promise<Raw> {
    const text = await readFile(file, "utf8").catch((error: unknown) => {
        throw new ConfigError("--config", `could not read ${file} (${error instanceof Error ? error.message : String(error)})`);
    });
    let parsed: unknown;
    try {
        parsed = JSON.parse(text);
    } catch (error) {
        throw new ConfigError("--config", `${file} is not valid JSON (${error instanceof Error ? error.message : String(error)})`);
    }
    if (!parsed || typeof parsed !== "object" || Array.isArray(parsed)) throw new ConfigError("--config", `${file} must hold a JSON object`);
    for (const key of Object.keys(parsed)) {
        if (!(FILE_FIELDS as readonly string[]).includes(key)) throw new ConfigError(key, `is not a field of the config file (fields: ${FILE_FIELDS.join(", ")})`);
    }
    return parsed as Raw;
}

const isString = (value: unknown): value is string => typeof value === "string";

function stringList(field: string, value: unknown): string[] {
    if (!Array.isArray(value)) throw new ConfigError(field, "must be a list");
    value.forEach((item, index) => {
        if (!isString(item) || !item.trim()) throw new ConfigError(`${field}[${index}]`, "must be a non-empty string");
    });
    return (value as string[]).map((item) => item.trim());
}

function optionalString(field: string, value: unknown, fallback: string): string {
    if (value === undefined) return fallback;
    if (!isString(value)) throw new ConfigError(field, "must be a string");
    return value;
}

function optionalBoolean(field: string, value: unknown): boolean {
    if (value === undefined) return false;
    if (typeof value !== "boolean") throw new ConfigError(field, "must be true or false");
    return value;
}

function servers(value: unknown): ServerSpec[] {
    if (value === undefined) return [];
    if (!Array.isArray(value)) throw new ConfigError("servers", "must be a list of { command, port }");
    return value.map((item, index) => {
        const field = `servers[${index}]`;
        if (!item || typeof item !== "object") throw new ConfigError(field, "must be { command, port }");
        const { command, port, ...rest } = item as Record<string, unknown>;
        const extra = Object.keys(rest)[0];
        if (extra) throw new ConfigError(`${field}.${extra}`, "is not a field of a server (fields: command, port)");
        if (!isString(command) || !command.trim()) throw new ConfigError(`${field}.command`, "must be a non-empty string");
        if (typeof port !== "number" || !Number.isInteger(port) || port < 1 || port > 65535) throw new ConfigError(`${field}.port`, "must be a port number from 1 to 65535 (--port after --server)");
        return { command: command.trim(), port };
    });
}

/** The file's fields, then the flags over them, checked field by field. Paths resolve against `cwd`. */
export function buildConfig(fileRaw: Raw, flagRaw: Raw, cwd: string): CliConfig {
    const raw: Raw = { ...fileRaw, ...flagRaw };

    if (raw.url === undefined) throw new ConfigError("url", "is required (--url <base URL>)");
    if (!isString(raw.url) || !raw.url.trim()) throw new ConfigError("url", "must be a URL");
    const url = normalizeBaseUrl(raw.url);
    if (!url.ok) throw new ConfigError("url", url.message);

    const mode = optionalString("mode", raw.mode, "standard");
    if (mode !== "standard" && mode !== "comprehensive") throw new ConfigError("mode", `must be "standard" or "comprehensive", got "${mode}"`);
    if (mode === "standard") {
        if (raw.area !== undefined) throw new ConfigError("area", "is for --mode comprehensive only");
        if (raw.pageCap !== undefined) throw new ConfigError("pageCap", "is for --mode comprehensive only");
    }
    let runMode: RunMode;
    try {
        runMode = normalizeRunMode(mode === "standard" ? undefined : { kind: "comprehensive", area: raw.area, pageCap: raw.pageCap });
    } catch (error) {
        if (error instanceof RunModeError) throw new ConfigError(/area/.test(error.message) ? "area" : /pageCap/.test(error.message) ? "pageCap" : "mode", error.message);
        throw error;
    }

    const practices = raw.practices === undefined ? [...PRACTICES] : stringList("practices", raw.practices);
    practices.forEach((practice, index) => {
        if (!(PRACTICES as string[]).includes(practice)) throw new ConfigError(`practices[${index}]`, `"${practice}" is not an area (areas: ${PRACTICES.join(", ")})`);
    });
    if (practices.length === 0) throw new ConfigError("practices", "must name at least one area");

    const auditMode = optionalString("auditMode", raw.auditMode, "fast");
    if (auditMode !== "fast" && auditMode !== "deep") throw new ConfigError("auditMode", `must be "fast" or "deep", got "${auditMode}"`);

    let login: LoginConfig | null;
    try {
        login = normalizeLoginConfig(raw.login, url.value);
    } catch (error) {
        if (error instanceof RunLoginError) throw new ConfigError("login", error.message);
        throw error;
    }

    const serverTimeout = raw.serverTimeout === undefined ? DEFAULT_SERVER_TIMEOUT_S : raw.serverTimeout;
    if (typeof serverTimeout !== "number" || !(serverTimeout > 0)) throw new ConfigError("serverTimeout", "must be a number of seconds above 0");

    const dataDir = raw.dataDir === undefined ? null : optionalString("dataDir", raw.dataDir, "");
    if (dataDir !== null && !dataDir.trim()) throw new ConfigError("dataDir", "must be a folder");

    const baseline = raw.baseline === undefined ? null : optionalString("baseline", raw.baseline, "").trim();
    if (baseline !== null && !baseline) throw new ConfigError("baseline", "must be a run.json file, or \"latest\"");

    return {
        url: url.value,
        runMode,
        practices: [...new Set(practices)] as BestPracticeArea[],
        auditMode,
        description: optionalString("description", raw.description, "").trim(),
        pages: raw.pages === undefined ? [] : stringList("pages", raw.pages).map((page) => (page.startsWith("/") ? page : `/${page}`)),
        interactive: optionalBoolean("interactive", raw.interactive),
        login,
        out: resolve(cwd, optionalString("out", raw.out, "mr-onion-out")),
        dataDir: dataDir === null ? null : resolve(cwd, dataDir),
        reportOnly: optionalBoolean("reportOnly", raw.reportOnly),
        baseline: baseline === null || baseline === "latest" ? baseline : resolve(cwd, baseline),
        servers: servers(raw.servers),
        serverTimeoutMs: serverTimeout * 1000,
    };
}

/** The whole of `mr-onion run <flags>`: flags, the config file they name, and the two merged. */
export async function loadConfig(argv: string[], cwd: string): Promise<CliConfig> {
    const { raw, configFile } = parseFlags(argv);
    const fileRaw = configFile ? await readConfigFile(resolve(cwd, configFile)) : {};
    return buildConfig(fileRaw, raw, cwd);
}
