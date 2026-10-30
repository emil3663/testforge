/**
 * A site on this machine's LAN address (a host Phase 39 Decision 10 treats as remote) that records when each request
 * arrived, for the request cap's real-browser tests (host-limits.test.ts, cap-starved.test.ts).
 */
import { createServer } from "node:http";
import type { AddressInfo } from "node:net";
import { networkInterfaces } from "node:os";

/** This machine's LAN address: a host Decision 10 treats as remote, served from here. */
export const lanAddress = Object.values(networkInterfaces()).flat().find((entry) => entry?.family === "IPv4" && !entry.internal)?.address ?? null;

/** The most requests that arrived within any one second. */
export function busiestSecond(arrivals: Array<{ at: number }>) {
    const times = arrivals.map((arrival) => arrival.at).sort((left, right) => left - right);
    let most = 0;
    for (let start = 0, end = 0; end < times.length; end++) {
        while (times[end] - times[start] >= 1000) start++;
        most = Math.max(most, end - start + 1);
    }
    return most;
}

/** A site on the LAN address that records when each request arrived. Each page pulls in a script and three images. */
export async function withRecordingSite(run: (origin: string, arrivals: Array<{ path: string; at: number }>) => Promise<void>) {
    const arrivals: Array<{ path: string; at: number }> = [];
    const page = (title: string) => `<!doctype html><html lang="en"><head><title>${title}</title><script src="/app.js"></script></head><body><h1>${title}</h1><img src="/a.png" alt="a"><img src="/b.png" alt="b"><img src="/c.png" alt="c"></body></html>`;
    const png = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=", "base64");
    const server = createServer((req, res) => {
        const path = (req.url ?? "/").split("?")[0];
        arrivals.push({ path, at: performance.now() });
        if (path.startsWith("/slow/")) setTimeout(() => res.writeHead(200, { "content-type": "image/png" }).end(png), 300);
        // A page of 20 images the site answers only after 4 s, so each holds its slot that long.
        else if (path.startsWith("/held/")) setTimeout(() => res.writeHead(200, { "content-type": "image/png" }).end(png), 4000);
        else if (path === "/held") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>held</title></head><body><h1>held</h1>${Array.from({ length: 20 }, (_, index) => `<img src="/held/${index}.png" alt="${index}">`).join("")}</body></html>`);
        else if (path === "/heavy") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>heavy</title></head><body><h1>heavy</h1>${Array.from({ length: 30 }, (_, index) => `<img src="/slow/${index}.png" alt="${index}">`).join("")}</body></html>`);
        // TFP-264: 60 quick images: capped, the page takes about 12 s to load, inside the 30 s test timeout.
        else if (path === "/sixty") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>sixty</title></head><body><h1>sixty</h1>${Array.from({ length: 60 }, (_, index) => `<img src="/x/${index}.png" alt="${index}">`).join("")}</body></html>`);
        // TFP-264: a page whose script asks the API 100 times and says "ready" once all have answered. Fetches don't
        // hold up its load, so a check reading it waits for them in its own assertion.
        // TFP-264: a page whose button asks the API 100 times, and says "ready" once all have answered.
        else if (path === "/button") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>button</title></head><body><h1>button</h1><button id="go">Go</button><script>document.getElementById("go").addEventListener("click", () => Promise.all(Array.from({ length: 100 }, (_, index) => fetch("/api/button/" + index))).then(() => { const ready = document.createElement("h2"); ready.textContent = "ready"; document.body.append(ready); }));</script></body></html>`);
        else if (path === "/late") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>late</title></head><body><h1>late</h1><script>Promise.all(Array.from({ length: 100 }, (_, index) => fetch("/api/late/" + index))).then(() => { const ready = document.createElement("h2"); ready.textContent = "ready"; document.body.append(ready); });</script></body></html>`);
        // TFP-264: 200 quick images: uncapped they load in well under a second; capped at 5 a second, not inside 30 s.
        // 10 quick images: 12 requests against 5 slots, so some wait about a second or two, well under 5 s.
        else if (path === "/some") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>some</title><script src="/app.js"></script></head><body><h1>some</h1>${Array.from({ length: 10 }, (_, index) => `<img src="/s/${index}.png" alt="${index}">`).join("")}</body></html>`);
        // TFP-264's carry-over: /many, its 200 images sent a second after its head, so a test that ends as the page
        // commits always ends before they reach the cap's route.
        else if (path === "/many-late") {
            res.writeHead(200, { "content-type": "text/html" });
            res.write(`<!doctype html><html lang="en"><head><title>many</title></head><body><h1>many</h1>`);
            setTimeout(() => res.end(`${Array.from({ length: 200 }, (_, index) => `<img src="/m/${index}.png" alt="${index}">`).join("")}</body></html>`), 1000);
        }
        else if (path === "/many") res.writeHead(200, { "content-type": "text/html" }).end(`<!doctype html><html lang="en"><head><title>many</title></head><body><h1>many</h1>${Array.from({ length: 200 }, (_, index) => `<img src="/m/${index}.png" alt="${index}">`).join("")}</body></html>`);
        else if (path.endsWith(".png")) res.writeHead(200, { "content-type": "image/png" }).end(png);
        else if (path === "/app.js") res.writeHead(200, { "content-type": "text/javascript" }).end("document.documentElement.dataset.ready = '1';");
        else if (path.startsWith("/api/")) res.writeHead(200, { "content-type": "application/json" }).end('{"ok":true}');
        else res.writeHead(200, { "content-type": "text/html" }).end(page(path));
    });
    await new Promise<void>((resolve) => server.listen(0, lanAddress!, resolve));
    try {
        await run(`http://${lanAddress}:${(server.address() as AddressInfo).port}`, arrivals);
    } finally {
        server.closeAllConnections();
        await new Promise<void>((resolve) => server.close(() => resolve()));
    }
}
