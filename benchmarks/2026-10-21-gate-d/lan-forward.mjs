// Phase 39 Gate D, the dry run only: forwards this machine's LAN address to the comparison fixture on 127.0.0.1, so
// the capped variant (CAP) can be tried on a host Decision 10 treats as remote without touching a public site.
// Prints the forwarded origin. Usage: node <this> <fixturePort> <listenPort>
import { networkInterfaces } from "node:os";
import { connect, createServer } from "node:net";

const [fixturePort, listenPort] = process.argv.slice(2).map(Number);
const lan = Object.values(networkInterfaces()).flat().find((entry) => entry?.family === "IPv4" && !entry.internal)?.address;
if (!lan) {
    console.error("no LAN IPv4 address");
    process.exit(1);
}
createServer((client) => {
    const upstream = connect(fixturePort, "127.0.0.1");
    client.pipe(upstream).pipe(client);
    const end = () => { client.destroy(); upstream.destroy(); };
    client.on("error", end);
    upstream.on("error", end);
}).listen(listenPort, lan, () => console.log(`http://${lan}:${listenPort}`));
