
export function MetricCard({
    label,
    value,
    caption,
}: {
    label: string;
    value: string | number;
    caption: string;
}) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-white px-4 py-4 shadow-sm">
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {label}
            </div>
            <div className="mt-2 text-2xl font-semibold tracking-tight text-zinc-950">
                {value}
            </div>
            <div className="mt-1 text-xs leading-5 text-zinc-500">{caption}</div>
        </div>
    );
}

