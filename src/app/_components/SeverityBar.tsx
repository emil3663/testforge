
export function SeverityBar({
    label,
    value,
    maxValue,
    color,
}: {
    label: string;
    value: number;
    maxValue: number;
    color: string;
}) {
    const widthPercent = value === 0 ? 0 : Math.max(8, (value / Math.max(maxValue, 1)) * 100);

    return (
        <div>
            <div className="mb-1 flex items-center justify-between text-xs font-medium">
                <span>{label}</span>
                <span>{value}</span>
            </div>
            <div className="h-2 rounded-full bg-zinc-100">
                <div
                    className={`h-2 rounded-full ${color}`}
                    style={{ width: `${Math.min(widthPercent, 100)}%` }}
                />
            </div>
        </div>
    );
}

