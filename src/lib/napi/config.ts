/**
 * napi (Guardian360's Lighthouse back end) as an optional record of TestForge's
 * runs. Off unless all four variables are set: unconfigured means nothing is
 * attempted and TestForge runs exactly as before. The client is a
 * client-credentials machine client napi issues with
 *   php artisan napi:clients:create testforge --role=testforge-writer --company=<uuid>
 * and its secret is read from the environment here, never written anywhere.
 */
export interface NapiConfig {
    /** napi's base URL, e.g. http://localhost:8100 */
    url: string;
    clientId: string;
    clientSecret: string;
    /** The company (uuid) the runs belong to. */
    companyId: string;
    /** This TestForge server, for the poller to drive its own API. */
    selfUrl: string;
    /** How often queued runs are looked for; 0 disables the poller, pushes still happen. */
    pollSeconds: number;
}

const DEFAULT_POLL_SECONDS = 30;

export function readNapiConfig(env: Record<string, string | undefined> = process.env): NapiConfig | null {
    const url = env.NAPI_URL?.trim();
    const clientId = env.NAPI_CLIENT_ID?.trim();
    const clientSecret = env.NAPI_CLIENT_SECRET?.trim();
    const companyId = env.NAPI_COMPANY_ID?.trim();
    if (!url || !clientId || !clientSecret || !companyId) return null;

    const poll = env.NAPI_POLL_SECONDS?.trim();
    const pollSeconds = poll === undefined || poll === "" ? DEFAULT_POLL_SECONDS : Math.max(0, Number(poll) || 0);
    const selfUrl = (env.TESTFORGE_SELF_URL?.trim() || env.NEXT_PUBLIC_SITE_URL?.trim() || `http://127.0.0.1:${env.PORT?.trim() || "3000"}`).replace(/\/+$/, "");

    return { url: url.replace(/\/+$/, ""), clientId, clientSecret, companyId, selfUrl, pollSeconds };
}
