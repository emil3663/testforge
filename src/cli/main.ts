import { join } from "path";
import { ConfigError, loadConfig, USAGE } from "@/cli/config";
import { EXIT_COULD_NOT_RUN, installExitHandlers } from "@/cli/exit";

/**
 * Phase 47 (TFP-245): `testforge run ...`. Started by bin/testforge.mjs from TestForge's own folder (the run
 * executor finds Playwright and its working folders there); paths on the command line resolve against the folder the
 * command was typed in, which the launcher passes as TESTFORGE_CLI_CWD.
 */
const EXIT_INVALID_CONFIG = 3;

async function main(argv: string[]): Promise<number> {
    const [command, ...rest] = argv;
    if (command === undefined || command === "--help" || command === "-h" || command === "help") {
        console.log(USAGE);
        return command === undefined ? EXIT_INVALID_CONFIG : 0;
    }
    if (command !== "run") {
        console.error(`testforge: unknown command "${command}"\n\n${USAGE}`);
        return EXIT_INVALID_CONFIG;
    }
    if (rest.includes("--help") || rest.includes("-h")) {
        console.log(USAGE);
        return 0;
    }

    let config;
    try {
        config = await loadConfig(rest, process.env.TESTFORGE_CLI_CWD || process.cwd());
    } catch (error) {
        if (error instanceof ConfigError) {
            console.error(`testforge: invalid configuration: ${error.message}`);
            return EXIT_INVALID_CONFIG;
        }
        throw error;
    }

    // Decision 6: the data folder - site suites, candidates and (for TFP-246's baselines) the saved runs - is the one
    // the pipeline restores and saves. Set before the run's modules load: the runs folder is fixed when they do.
    if (config.dataDir) {
        process.env.TESTFORGE_DATA_DIR = config.dataDir;
        process.env.TESTFORGE_RUNS_ROOT = join(config.dataDir, "runs");
    }
    const { RUNS_ROOT } = await import("@/lib/run/persistence");
    if (config.dataDir && RUNS_ROOT !== join(config.dataDir, "runs")) {
        console.error(`testforge: the runs folder was fixed before --data-dir could set it (${RUNS_ROOT})`);
        return EXIT_COULD_NOT_RUN;
    }
    const { runTarget } = await import("@/cli/run");
    return runTarget(config);
}

// An interrupt, a cancelled job or a crash still stops every server it started, and exits 2.
installExitHandlers();
main(process.argv.slice(2)).then(
    (code) => process.exit(code),
    (error: unknown) => {
        console.error(`testforge: couldn't run: ${error instanceof Error ? error.stack ?? error.message : String(error)}`);
        process.exit(EXIT_COULD_NOT_RUN);
    }
);
