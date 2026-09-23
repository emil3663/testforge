import type { DependencyDetail, DependencyKind, DependencyMapEntry, EmbeddedLinkDetail } from "./types";

function hostOf(url: string): string | null {
    try {
        return new URL(url).host;
    } catch {
        return null;
    }
}

// TFP-084: script/iframe/form-action dependencies are already discovered by
// dom-snapshot.ts's static embeddedLinkDetails scan (read-only, no
// additional navigation or submission) - this just reclassifies the ones
// the dependency map cares about. Same-origin scripts are excluded (every
// bundled app has dozens; recording them would drown out real third-party
// dependencies), but same-origin forms and iframes are kept, since a page's
// own backend endpoint or embedded frame is still a real outbound
// dependency the page can't function without.
export function dependenciesFromEmbeddedLinks(embeddedLinkDetails: EmbeddedLinkDetail[]): DependencyDetail[] {
    return embeddedLinkDetails.flatMap((link) => {
        const kind: DependencyKind | null =
            link.kind === "script" && !link.sameOrigin
                ? "third-party-script"
                : link.kind === "iframe"
                    ? "iframe"
                    : link.kind === "form"
                        ? "form-action"
                        : null;

        if (!kind) {
            return [];
        }

        const host = hostOf(link.url);
        if (!host) {
            return [];
        }

        return [{
            kind,
            host,
            url: link.url,
            sameOrigin: link.sameOrigin,
            method: kind === "form-action" ? "POST" : null,
        }];
    });
}

// Cookies dedupe by (host, name) rather than (host, kind) alone - unlike a
// script or fetch target, several distinctly-named cookies routinely share
// one host (a session cookie and an analytics cookie are different
// dependencies, not the same one observed twice), so collapsing them by
// host would silently hide all but the first.
function dedupeKey(dependency: DependencyDetail) {
    return dependency.kind === "cookie"
        ? `${dependency.kind}\u0000${dependency.host}\u0000${dependency.url}`
        : `${dependency.kind}\u0000${dependency.host}`;
}

// Aggregates per-page dependency observations into the per-baseUrl map,
// deduped by (host, kind) - the same shape buildDiscoveredCoverageMatrix
// already uses to aggregate discovered elements per site, per the decision
// record (docs/decisions/phase-18-integration-mapping-decision-record.md).
export function aggregateDependencyMap(
    perPageDependencies: { path: string; dependencies: DependencyDetail[] }[]
): DependencyMapEntry[] {
    const entries = new Map<string, DependencyMapEntry>();

    for (const { path, dependencies } of perPageDependencies) {
        for (const dependency of dependencies) {
            const key = dedupeKey(dependency);
            const existing = entries.get(key);

            if (existing) {
                existing.occurrences += 1;
                if (!existing.paths.includes(path)) {
                    existing.paths.push(path);
                }
                continue;
            }

            entries.set(key, {
                host: dependency.host,
                kind: dependency.kind,
                sampleUrl: dependency.url,
                sameOrigin: dependency.sameOrigin,
                method: dependency.method,
                occurrences: 1,
                paths: [path],
            });
        }
    }

    return [...entries.values()];
}
