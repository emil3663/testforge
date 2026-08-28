import { fallbackStatusClasses, getFallbackExecutionRecords } from "@/lib/report/status";
import { formatMilliseconds } from "@/lib/report/text";
import type { RunProgressSnapshot } from "@/app/_lib/types";

export function FallbackExecutionTable({ progress }: { progress: RunProgressSnapshot }) {
    const records = getFallbackExecutionRecords(progress);

    if (records.length === 0) {
        return null;
    }

    return (
        <div className="mt-4 space-y-3">
            {records.map((record) => (
                <article key={record.id} className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                            <div className="text-sm font-semibold text-zinc-950">{record.title}</div>
                            {record.linkLabel ? (
                                <div className="mt-1 text-xs text-zinc-500">Target: {record.linkLabel}</div>
                            ) : null}
                        </div>
                        <span className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${fallbackStatusClasses(record.status)}`}>
                            {record.status}
                        </span>
                    </div>
                    <div className="mt-3 inline-flex rounded-full border border-zinc-200 bg-white px-2.5 py-1 text-xs font-semibold text-zinc-700">
                        Duration: {record.duration !== null ? formatMilliseconds(record.duration) : "Not captured"}
                    </div>
                    <div className="mt-3 rounded-2xl border border-zinc-200 bg-white px-4 py-3 text-sm leading-6 text-zinc-600">
                        {record.remarks}
                    </div>
                </article>
            ))}
        </div>
    );
}

