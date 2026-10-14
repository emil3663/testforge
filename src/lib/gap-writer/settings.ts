import { mkdir, readFile, rename, writeFile } from "fs/promises";
import { join } from "path";
import { siteFolderName } from "@/lib/site-suites/store";
import { dataDir } from "@/lib/storage/data-dir";

/**
 * Phase 42 (TFP-194, Decision 6): who writes a site's gap tests - nobody
 * unless the site opts in. Writing a gap test sends the page's structure off
 * the machine (Claude Code) or to the local model, which a local-first tool
 * shouldn't do by default.
 *
 *   <data>/site-suites/<site>/settings.json   { "gapWriter": "off" | "claude-code" | "local-model" }
 *
 * Absent, unreadable or anything else reads as "off".
 */

export const GAP_WRITERS = ["off", "claude-code", "local-model"] as const;
export type GapWriterSetting = (typeof GAP_WRITERS)[number];

export interface SiteSettings {
    gapWriter: GapWriterSetting;
}

const settingsFile = (origin: string) => join(dataDir(), "site-suites", siteFolderName(origin), "settings.json");

export async function loadSiteSettings(origin: string): Promise<SiteSettings> {
    const text = await readFile(settingsFile(origin), "utf8").catch(() => null);
    try {
        const value = text ? (JSON.parse(text) as { gapWriter?: unknown }).gapWriter : undefined;
        return { gapWriter: (GAP_WRITERS as readonly unknown[]).includes(value) ? (value as GapWriterSetting) : "off" };
    } catch {
        return { gapWriter: "off" };
    }
}

export async function saveSiteSettings(origin: string, settings: SiteSettings): Promise<void> {
    const file = settingsFile(origin);
    await mkdir(join(file, ".."), { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(settings, null, 2), "utf8");
    await rename(`${file}.tmp`, file);
}
