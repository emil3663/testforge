import { ArtifactLinkList } from "@/app/_components/ArtifactLinkList";
import { EmptyState } from "@/app/_components/EmptyState";
import type { DefectRecord } from "@/lib/report/types";

export function DefectList({ defects }: { defects: DefectRecord[] }) {
    return defects.length > 0 ? (
        <div className="space-y-4">
            {defects.map((defect) => (
                <div
                    key={defect.id}
                    className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4"
                >
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                                {defect.id}
                            </div>
                            <div className="mt-1 text-sm font-semibold text-zinc-950">
                                {defect.title}
                            </div>
                            {defect.testTitle ? (
                                <div className="mt-2 text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                    Failed test: {defect.testTitle} · {defect.browser}
                                </div>
                            ) : null}
                            <p className="mt-2 text-sm leading-6 text-zinc-600">{defect.summary}</p>
                        </div>
                        <div className="flex flex-wrap gap-2">
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                {defect.area}
                            </span>
                            <span className="rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                                {defect.browser}
                            </span>
                            <span className="rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-xs font-semibold text-rose-700">
                                {defect.severity}
                            </span>
                        </div>
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                        <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                            Observed failure
                        </div>
                        <div className="mt-2">{defect.description}</div>
                    </div>
                    <ol className="mt-3 list-decimal space-y-1 pl-5 text-sm leading-6 text-zinc-600">
                        {defect.reproductionSteps.map((step) => (
                            <li key={step}>{step}</li>
                        ))}
                    </ol>
                    {defect.artifacts.length > 0 ? (
                        <div className="mt-4 rounded-2xl border border-zinc-200 bg-white px-4 py-3">
                            <div className="text-xs font-semibold uppercase tracking-[0.16em] text-zinc-500">
                                Related artifacts
                            </div>
                            <ArtifactLinkList items={defect.artifacts} className="mt-3" />
                        </div>
                    ) : null}
                </div>
            ))}
        </div>
    ) : (
        <EmptyState message="No open defects were generated from this run." />
    );
}

