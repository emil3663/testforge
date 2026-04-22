import { randomUUID } from "crypto";

const LOCAL_API_PREFIX = "/api";

function normalizeBaseUrl(input: string) {
    return input.replace(/\/+$/, "");
}

function isAllowedBackendProtocol(value: string) {
    return value === "http:" || value === "https:";
}

export function getBackendBaseUrl() {
    const configured = process.env.TESTFORGE_BACKEND_BASE_URL?.trim();

    if (!configured) {
        return null;
    }

    try {
        const parsed = new URL(configured);

        if (!isAllowedBackendProtocol(parsed.protocol)) {
            return null;
        }

        if (parsed.username || parsed.password || parsed.search || parsed.hash) {
            return null;
        }

        return normalizeBaseUrl(parsed.toString());
    } catch {
        return null;
    }
}

export function isExternalBackendEnabled() {
    return Boolean(getBackendBaseUrl());
}

export function buildBackendUrl(path: string) {
    const normalizedPath = path.startsWith("/") ? path : `/${path}`;
    const baseUrl = getBackendBaseUrl();

    if (!baseUrl) {
        return normalizedPath;
    }

    return `${baseUrl}${normalizedPath}`;
}

export interface ProxyJsonOptions {
    path: string;
    method: "GET" | "POST" | "DELETE";
    body?: unknown;
    headers?: Record<string, string>;
    cache?: RequestCache;
}

export interface ProxyJsonResult<T> {
    ok: boolean;
    status: number;
    data: T | { error?: string };
    requestId: string;
    target: string;
}

export async function proxyJsonRequest<T>(options: ProxyJsonOptions) {
    const { path, method, body, headers, cache } = options;
    const target = buildBackendUrl(path.startsWith(LOCAL_API_PREFIX) ? path : `${LOCAL_API_PREFIX}${path}`);
    const requestId = randomUUID();

    try {
        const response = await fetch(target, {
            method,
            cache,
            headers: {
                "Content-Type": "application/json",
                "X-TestForge-Request-Id": requestId,
                ...(headers ?? {}),
            },
            body: body === undefined ? undefined : JSON.stringify(body),
        });

        const data = (await response.json().catch(() => ({}))) as T | { error?: string };
        return {
            ok: response.ok,
            status: response.status,
            data,
            requestId: response.headers.get("x-testforge-request-id") ?? requestId,
            target,
        } satisfies ProxyJsonResult<T>;
    } catch {
        return {
            ok: false,
            status: 502,
            data: { error: "Failed to reach external backend" },
            requestId,
            target,
        } satisfies ProxyJsonResult<T>;
    }

}