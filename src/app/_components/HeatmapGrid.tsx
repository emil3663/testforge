import { EmptyState } from "@/app/_components/EmptyState";

export function HeatmapGrid({ cells }: { cells: { area: string; count: number }[] }) {
    if (cells.length === 0) {
        return <EmptyState message="No defect hot spots detected in this run." />;
    }

    const max = Math.max(...cells.map((cell) => cell.count), 1);

    return (
        <div className="grid gap-3 sm:grid-cols-2">
            {cells.map((cell) => (
                <div
                    key={cell.area}
                    className="rounded-2xl border border-zinc-200 p-4"
                    style={{
                        backgroundColor: `rgba(244, 63, 94, ${0.12 + (cell.count / max) * 0.28})`,
                    }}
                >
                    <div className="text-sm font-semibold text-zinc-950">{cell.area}</div>
                    <div className="mt-1 text-xs text-zinc-600">
                        {cell.count} defect{cell.count === 1 ? "" : "s"}
                    </div>
                </div>
            ))}
        </div>
    );
}

