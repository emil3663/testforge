import { EmptyState } from "@/app/_components/EmptyState";
import { formatMilliseconds } from "@/lib/report/text";

export function PerformanceTable({
    rows,
}: {
    rows: { title: string; browser: string; area: string; duration: number }[];
}) {
    return rows.length > 0 ? (
        <div className="overflow-hidden rounded-2xl border border-zinc-200 bg-white">
            {rows.map((row) => (
                <div
                    key={`${row.browser}-${row.title}`}
                    className="flex items-center justify-between gap-3 border-b border-zinc-100 px-4 py-3 last:border-b-0"
                >
                    <div>
                        <div className="text-sm font-medium text-zinc-900">{row.title}</div>
                        <div className="text-xs text-zinc-500">
                            {row.area} • {row.browser}
                        </div>
                    </div>
                    <div className="text-sm font-semibold text-zinc-700">
                        {formatMilliseconds(row.duration)}
                    </div>
                </div>
            ))}
        </div>
    ) : (
        <EmptyState message="No performance-specific timings were captured." />
    );
}

