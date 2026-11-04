// TFP-252, for issue.test.mjs only: plays the few `gh` calls notify.mjs's issue command makes, against a JSON state
// file (FAKE_GH_STATE), and records each call there. Not GitHub: what GitHub really does is proven by the dispatch runs.
import { readFileSync, writeFileSync } from "node:fs";

const path = process.env.FAKE_GH_STATE;
const state = JSON.parse(readFileSync(path, "utf8"));
const args = process.argv.slice(2);
const stdin = () => readFileSync(0, "utf8");
const option = (name) => args[args.indexOf(name) + 1];
let out = "";

if (args[0] === "api" && args[1] === `repos/${state.repo}`) {
    out = state.defaultBranch;
} else if (args[0] === "api" && args[1].includes("/actions/workflows/")) {
    if (state.runsFail) {
        console.error("gh: Server Error (HTTP 502)");
        process.exit(1);
    }
    out = JSON.stringify({ workflow_runs: state.green ? [state.green] : [] });
} else if (args[0] === "api" && args[1].includes("/compare/")) {
    if (state.compareFails) {
        console.error("gh: Not Found (HTTP 404)");
        process.exit(1);
    }
    out = JSON.stringify({ total_commits: state.totalCommits ?? state.commits.length, commits: state.commits });
} else if (args[0] === "issue" && args[1] === "list") {
    out = JSON.stringify(state.issues.filter((issue) => issue.state === "open").map(({ number, title, url }) => ({ number, title, url })));
} else if (args[0] === "issue" && args[1] === "create") {
    const number = state.issues.length + 1;
    const issue = { number, title: option("--title"), url: `https://github.com/${state.repo}/issues/${number}`, state: "open", body: stdin(), comments: [] };
    state.issues.push(issue);
    out = issue.url;
} else if (args[0] === "issue" && args[1] === "comment") {
    state.issues.find((issue) => issue.number === Number(args[2])).comments.push(stdin());
} else if (args[0] === "issue" && args[1] === "close") {
    state.issues.find((issue) => issue.number === Number(args[2])).state = "closed";
} else {
    console.error(`fake gh: unexpected call: ${args.join(" ")}`);
    process.exit(1);
}

state.calls.push(args.join(" "));
writeFileSync(path, JSON.stringify(state), "utf8");
if (out) console.log(out);
