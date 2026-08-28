
export function TrendBars({ points }: { points: { label: string; count: number }[] }) {
    const max = Math.max(...points.map((point) => point.count), 1);

    return (
        <div className="flex min-w-max items-end gap-2 rounded-2xl bg-white px-4 py-4">
            {points.map((point) => (
                <div key={point.label} className="flex min-w-[32px] flex-col items-center gap-2">
                    <div className="text-[10px] font-semibold text-zinc-500">{point.count}</div>
                    <div className="flex h-28 items-end">
                        <div
                            className="w-6 rounded-t-xl bg-indigo-500"
                            style={{ height: `${Math.max(6, (point.count / max) * 112)}px` }}
                        />
                    </div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-400">
                        {point.label}
                    </div>
                </div>
            ))}
        </div>
    );
}

