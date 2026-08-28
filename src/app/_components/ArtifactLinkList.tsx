import type { ReportArtifactItem } from "@/lib/report/types";

export function ArtifactLinkList({
    items,
    className,
    compact = false,
}: {
    items: ReportArtifactItem[];
    className?: string;
    compact?: boolean;
}) {
    return items.length > 0 ? (
        <div className={`space-y-2 ${className ?? ""}`}>
            {items.map((item) => (
                <div
                    key={item.artifactId}
                    className={`rounded-2xl border border-zinc-200 bg-white ${compact ? "px-3 py-2" : "px-4 py-3"}`}
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-950">{item.label}</div>
                            <div className="mt-1 text-xs leading-5 text-zinc-500">
                                {item.browser} · {item.testTitle || "No linked test"} · {item.fileName}
                            </div>
                            {item.defectTitle ? (
                                <div className="mt-1 text-xs leading-5 text-zinc-500">
                                    Linked bug: {item.defectId} · {item.defectTitle}
                                </div>
                            ) : null}
                        </div>
                        {item.downloadPath ? (
                            <a
                                href={item.downloadPath}
                                className="rounded-xl border border-zinc-300 bg-white px-3 py-1.5 text-xs font-medium text-zinc-700 transition hover:border-zinc-400 hover:text-zinc-950"
                            >
                                Download
                            </a>
                        ) : null}
                    </div>
                </div>
            ))}
        </div>
    ) : null;
}

