import { readFileSync } from "node:fs";
const has = (file, needle) => JSON.parse(readFileSync(file, "utf8")).records.some((r) => [r.message, ...r.findings, ...r.issues].some((t) => t.includes(needle)));
const checks = {
    "28 logo (axe)": '.navbar-brand > img[src$="broken.png"]',
    "28/30 broken.png (failed request)": "HTTP 404 https://with-bugs.practicesoftwaretesting.com/broken.png",
    "30 second broken.png (axe)": '.grid-title:nth-child(7) > img[src$="broken.png"]',
    "33 sort select-name": "select-name",
};
for (const [k, needle] of Object.entries(checks)) console.log(k.padEnd(36), ["standard", "security", "accessibility"].map((x) => `${x}:${has(`with-bugs-${x}-records.json`, needle)}/clean:${has(`clean-${x}-records.json`, needle)}`).join("  "));
