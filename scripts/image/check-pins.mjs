// Phase 47 (TFP-247): run inside the image, at its build and by verify-image.mjs. Fails the build unless what is
// installed is what the repo pins: Node's major is .nvmrc's, Playwright is the lockfile's, its Chromium is
// installed where PLAYWRIGHT_BROWSERS_PATH says, and a given build version is package.json's. Prints the versions as
// one JSON line, for verify-image.mjs and the release's log.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("../../", import.meta.url));
const json = (path) => JSON.parse(readFileSync(join(root, path), "utf8"));

/** The pins' failures, given what is installed and what the repo says; empty when they agree. */
export function pinFailures({ nodeVersion, nvmrc, lock, installed, browsersJson, browsersPath, browserInstalled, buildVersion, packageVersion }) {
    const failures = [];
    const major = nodeVersion.replace(/^v/, "").split(".")[0];
    if (major !== nvmrc.trim().replace(/^v/, "").split(".")[0]) failures.push(`Node ${nodeVersion} isn't .nvmrc's ${nvmrc.trim()}`);
    for (const name of ["playwright-core", "playwright", "@playwright/test"]) {
        const locked = lock.packages?.[`node_modules/${name}`]?.version;
        if (!locked) failures.push(`${name} isn't in package-lock.json`);
        else if (installed[name] !== locked) failures.push(`${name} ${installed[name] ?? "isn't installed"}; the lockfile says ${locked}`);
    }
    const shell = browsersJson.browsers.find((browser) => browser.name === "chromium-headless-shell");
    if (!shell) failures.push("Playwright names no chromium-headless-shell");
    else if (!browsersPath) failures.push("PLAYWRIGHT_BROWSERS_PATH isn't set");
    else if (!browserInstalled(join(browsersPath, `chromium_headless_shell-${shell.revision}`))) failures.push(`Chromium's headless shell ${shell.revision} isn't installed in ${browsersPath}`);
    if (buildVersion && buildVersion !== packageVersion) failures.push(`the build says version ${buildVersion}; package.json says ${packageVersion}`);
    return failures;
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
    const installed = Object.fromEntries(["playwright-core", "playwright", "@playwright/test"].map((name) => {
        const path = join(root, "node_modules", name, "package.json");
        return [name, existsSync(path) ? JSON.parse(readFileSync(path, "utf8")).version : undefined];
    }));
    const browsersJson = json("node_modules/playwright-core/browsers.json");
    const failures = pinFailures({
        nodeVersion: process.version,
        nvmrc: readFileSync(join(root, ".nvmrc"), "utf8"),
        lock: json("package-lock.json"),
        installed,
        browsersJson,
        browsersPath: process.env.PLAYWRIGHT_BROWSERS_PATH,
        browserInstalled: existsSync,
        buildVersion: process.env.MRONION_BUILD_VERSION,
        packageVersion: json("package.json").version,
    });
    if (failures.length > 0) {
        for (const failure of failures) console.error(`check-pins: ${failure}`);
        process.exit(1);
    }
    const os = existsSync("/etc/os-release") ? /^VERSION_ID="?([^"\n]*)/m.exec(readFileSync("/etc/os-release", "utf8"))?.[1] ?? null : null;
    const chromium = browsersJson.browsers.find((browser) => browser.name === "chromium-headless-shell");
    console.log(JSON.stringify({
        os,
        node: process.version,
        playwright: installed["playwright-core"],
        chromium: chromium.browserVersion,
        chromiumRevision: chromium.revision,
        version: process.env.MRONION_BUILD_VERSION || json("package.json").version,
        commit: process.env.MRONION_BUILD_COMMIT || null,
    }));
}
