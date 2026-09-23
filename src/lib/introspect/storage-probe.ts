// TFP-086: installed once via page.addInitScript() before the first
// navigation, so it re-runs automatically at the start of every subsequent
// page.goto() in inspectPages' per-path loop (addInitScript persists across
// navigations on the same page) - each navigation gets a fresh
// window.__tfStorageAccess, scoped to that one page load.
//
// This only OBSERVES real access (wraps localStorage/sessionStorage behind
// a getter, indexedDB.open behind a function wrapper, both forwarding to
// the real implementation) - it never breaks storage during introspect
// itself. The actual "mock it to throw" half lives in
// generate/mock/storage-failure-injection.ts, run later by the generated
// test, not here.
export function installStorageAccessProbe() {
    const w = window as unknown as { __tfStorageAccess?: Record<string, boolean> };
    w.__tfStorageAccess = { localStorage: false, sessionStorage: false, indexedDB: false };

    function wrapStorageGetter(name: "localStorage" | "sessionStorage") {
        try {
            const real = window[name];
            Object.defineProperty(window, name, {
                configurable: true,
                get() {
                    w.__tfStorageAccess![name] = true;
                    return real;
                },
            });
        } catch {
            // Some engines don't allow redefining these - leave undetected
            // rather than breaking the page's real storage access.
        }
    }

    wrapStorageGetter("localStorage");
    wrapStorageGetter("sessionStorage");

    try {
        const realIndexedDB = window.indexedDB;
        if (realIndexedDB) {
            const realOpen = realIndexedDB.open.bind(realIndexedDB);
            realIndexedDB.open = ((...args: Parameters<IDBFactory["open"]>) => {
                w.__tfStorageAccess!.indexedDB = true;
                return realOpen(...args);
            }) as IDBFactory["open"];
        }
    } catch {
        // Ignore - same fallback as above.
    }
}

export async function readStorageAccessProbe(page: {
    evaluate: <T>(fn: () => T) => Promise<T>;
}) {
    return page.evaluate(() => {
        const w = window as unknown as { __tfStorageAccess?: Record<string, boolean> };
        return {
            localStorage: Boolean(w.__tfStorageAccess?.localStorage),
            sessionStorage: Boolean(w.__tfStorageAccess?.sessionStorage),
            indexedDB: Boolean(w.__tfStorageAccess?.indexedDB),
        };
    });
}
