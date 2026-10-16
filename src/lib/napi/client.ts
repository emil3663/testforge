import type { NapiConfig } from "./config.ts";

/**
 * The few napi calls TestForge makes, over napi's REST API with a
 * client-credentials token (the orchestrator in guardian360/pentest does the
 * same from Python). Every call is one request; nothing here retries, because
 * a missed push is visible in napi as a run that never arrived and the poller
 * tries again on its next tick.
 */
export interface NapiRunRow {
    uuid: string;
    run_uid: string;
    status: string;
    scope_file: NapiRunConfig | null;
}

/** The run config napi hands over (testforge-runs.scope_file): TestForge's own words. */
export interface NapiRunConfig {
    runId: string;
    baseUrl: string;
    selectedPractices: string[];
    auditMode: "fast" | "deep";
    description: string | null;
    login: Record<string, unknown> | null;
}

export type FetchLike = (input: string, init?: RequestInit) => Promise<Response>;

export class NapiError extends Error {
    readonly status: number;

    constructor(message: string, status: number) {
        super(message);
        this.name = "NapiError";
        this.status = status;
    }
}

export class NapiClient {
    private token: { value: string; expiresAt: number } | null = null;

    private readonly config: NapiConfig;

    private readonly fetchImpl: FetchLike;

    constructor(config: NapiConfig, fetchImpl: FetchLike = fetch) {
        this.config = config;
        this.fetchImpl = fetchImpl;
    }

    /** POST testforge-runs · ingest: a finished run as persisted, on the claimed row when it was asked for in napi. */
    async ingestRun(record: unknown, claimed?: string): Promise<{ status: number }> {
        const body: Record<string, unknown> = { company_id: this.config.companyId, run: record };
        if (claimed) body.claimed = claimed;
        const response = await this.request("POST", "/api/v2/testforge-runs/ingest", body);
        return { status: response.status };
    }

    /** The runs napi queued and nobody took yet. */
    async queuedRuns(): Promise<NapiRunRow[]> {
        const response = await this.request("GET", "/api/v2/testforge-runs?scopes=queued&per_page=20");
        const json = (await response.json()) as { data?: NapiRunRow[] };
        return Array.isArray(json.data) ? json.data : [];
    }

    /** Claim a queued run. `false` when another TestForge took it first (409). */
    async handOff(uuid: string): Promise<boolean> {
        const response = await this.request("POST", `/api/v2/testforge-runs/${uuid}/hand-off`, {}, [409]);
        return response.status !== 409;
    }

    /** One run as napi holds it now, for its status (a stop asked for shows as "stopping"). */
    async run(uuid: string): Promise<NapiRunRow | null> {
        const response = await this.request("GET", `/api/v2/testforge-runs/${uuid}`, undefined, [404]);
        if (response.status === 404) return null;
        const json = (await response.json()) as { data?: NapiRunRow };
        return json.data ?? null;
    }

    private async request(method: string, path: string, body?: unknown, allow: number[] = []): Promise<Response> {
        const response = await this.fetchImpl(`${this.config.url}${path}`, {
            method,
            headers: {
                Authorization: `Bearer ${await this.accessToken()}`,
                Accept: "application/json",
                ...(body !== undefined ? { "Content-Type": "application/json" } : {}),
            },
            body: body !== undefined ? JSON.stringify(body) : undefined,
        });
        if (!response.ok && !allow.includes(response.status)) {
            const text = await response.text().catch(() => "");
            throw new NapiError(`napi ${method} ${path}: ${response.status} ${text.slice(0, 500)}`, response.status);
        }
        return response;
    }

    private async accessToken(): Promise<string> {
        if (this.token && this.token.expiresAt > Date.now() + 30_000) return this.token.value;
        const response = await this.fetchImpl(`${this.config.url}/oauth/token`, {
            method: "POST",
            headers: { "Content-Type": "application/json", Accept: "application/json" },
            body: JSON.stringify({ grant_type: "client_credentials", client_id: this.config.clientId, client_secret: this.config.clientSecret }),
        });
        if (!response.ok) throw new NapiError(`napi token: ${response.status}`, response.status);
        const json = (await response.json()) as { access_token?: string; expires_in?: number };
        if (!json.access_token) throw new NapiError("napi token: no access_token in the answer", response.status);
        this.token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in ?? 3600) * 1000 };
        return this.token.value;
    }
}
