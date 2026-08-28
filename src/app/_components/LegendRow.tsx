
export function LegendRow({
    color,
    label,
    value,
}: {
    color: string;
    label: string;
    value: number;
}) {
    return (
        <div className="flex items-center gap-2">
            <span className={`h-2.5 w-2.5 rounded-full ${color}`} />
            <span className="flex-1">{label}</span>
            <span className="font-semibold text-zinc-900">{value}</span>
        </div>
    );
}

