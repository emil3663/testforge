import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

/**
 * TFP-261: every API route is for the tester's own browser on this machine, as README.md's security model says,
 * because `/api/run` runs the code it is given. The server binds to loopback (package.json, `-H 127.0.0.1`); this
 * refuses, with 403 and the reason, any `/api/*` request that could still come from elsewhere:
 * - a `Host` that isn't this machine's loopback name (DNS rebinding: another site's name resolved to 127.0.0.1);
 * - an `Origin` that isn't this same origin (another site's page in the tester's browser);
 * - a `POST`, `PUT`, `PATCH` or `DELETE` that isn't `Content-Type: application/json`: a page can send `text/plain`,
 *   form or multipart bodies to any address without a CORS preflight, and the routes parse the body as JSON whatever
 *   its type (measured 2026-10-27: a foreign `Origin` with `text/plain` started a run, 202).
 * The port isn't checked: a `Host` naming loopback reaches here only from a client on this machine, and the `Origin`
 * check compares the whole origin, port included.
 */
const LOOPBACK = new Set(["localhost", "127.0.0.1", "[::1]"]);
const WRITES = new Set(["POST", "PUT", "PATCH", "DELETE"]);

/** Why a request is refused, or null when it may go on. */
export function refusalOf(method: string, headers: Headers): string | null {
    const host = headers.get("host") ?? "";
    const hostname = host.replace(/:\d+$/, "").toLowerCase();
    if (!LOOPBACK.has(hostname)) return `refused: the Host "${host}" isn't this machine (TestForge answers only on localhost, 127.0.0.1 or [::1])`;
    const origin = headers.get("origin");
    if (origin !== null && origin.toLowerCase() !== `http://${host.toLowerCase()}`) return `refused: the request comes from another origin (${origin}); TestForge's API answers only its own pages`;
    if (WRITES.has(method.toUpperCase())) {
        const type = (headers.get("content-type") ?? "").split(";")[0].trim().toLowerCase();
        if (type !== "application/json") return `refused: a ${method.toUpperCase()} must be Content-Type: application/json (it was ${type ? `"${type}"` : "missing"})`;
    }
    return null;
}

export function proxy(request: NextRequest) {
    const refusal = refusalOf(request.method, request.headers);
    if (refusal) return NextResponse.json({ error: refusal }, { status: 403 });
    return NextResponse.next();
}

export const config = {
    matcher: "/api/:path*",
};
