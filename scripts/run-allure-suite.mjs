import { spawn } from "node:child_process";
import { access, rm } from "node:fs/promises";
import path from "node:path";

const [suiteName, configPath] = process.argv.slice(2);

if (!suiteName || !configPath) {
    console.error("Usage: node scripts/run-allure-suite.mjs <suite-name> <playwright-config>");
    process.exit(1);
}

const resultsDir = path.join("artifacts", "allure-results", suiteName);
const reportDir = path.join("artifacts", "allure-report", suiteName);
const suiteTitle = suiteName.charAt(0).toUpperCase() + suiteName.slice(1);
const nodeCommand = process.execPath;
const playwrightCli = path.join(process.cwd(), "node_modules", "@playwright", "test", "cli.js");
const allureCli = path.join(process.cwd(), "node_modules", "allure", "cli.js");

async function removeDirectory(directoryPath) {
    await rm(directoryPath, { force: true, recursive: true });
}

async function pathExists(filePath) {
    try {
        await access(filePath);
        return true;
    } catch {
        return false;
    }
}

function runCommand(command, args) {
    return new Promise((resolve, reject) => {
        const child = spawn(command, args, {
            stdio: "inherit",
        });

        child.on("error", reject);
        child.on("close", (exitCode) => {
            resolve(exitCode ?? 1);
        });
    });
}

await Promise.all([removeDirectory(resultsDir), removeDirectory(reportDir)]);

const testExitCode = await runCommand(nodeCommand, [playwrightCli, "test", "-c", configPath]);

let reportExitCode = 0;
if (await pathExists(resultsDir)) {
    reportExitCode = await runCommand(nodeCommand, [
        allureCli,
        "generate",
        resultsDir,
        "--output",
        reportDir,
        "--report-name",
        `TestForge ${suiteTitle} Report`,
        "--history-limit",
        "5",
    ]);
} else {
    console.error(`Skipped Allure generation because ${resultsDir} was not created.`);
    reportExitCode = 1;
}

process.exit(testExitCode !== 0 ? testExitCode : reportExitCode);