const LOCAL_API_PREFIX = "/api";

function normalizeBaseUrl(input: string) {
    return input.replace(/\/+$/, "");
}

export function getBackendBaseUrl() {
    const configured = process.env.TESTFORGE_BACKEND_BASE_URL?.trim();

    if (!configured) {
        return null;
    }

    return normalizeBaseUrl(configured);
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

export async function proxyJsonRequest<T>(options: ProxyJsonOptions) {
    const { path, method, body, headers, cache } = options;
    const target = buildBackendUrl(path.startsWith(LOCAL_API_PREFIX) ? path : `${LOCAL_API_PREFIX}${path}`);

    const response = await fetch(target, {
        method,
        cache,
        headers: {
            "Content-Type": "application/json",
            ...(headers ?? {}),
        },
        body: body === undefined ? undefined : JSON.stringify(body),
    });

    const data = (await response.json().catch(() => ({}))) as T | { error?: string };
    return {
        ok: response.ok,
        status: response.status,
        data,
    };
}