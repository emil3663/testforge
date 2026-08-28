
export function ReportPanel({
    eyebrow,
    title,
    description,
    children,
    className,
}: {
    eyebrow: string;
    title: string;
    description: string;
    children: React.ReactNode;
    className?: string;
}) {
    return (
        <div className={`rounded-[28px] border border-zinc-200 bg-white p-5 shadow-sm ${className ?? ""}`}>
            <div className="text-xs font-semibold uppercase tracking-[0.18em] text-zinc-500">
                {eyebrow}
            </div>
            <h3 className="mt-2 text-xl font-semibold tracking-tight text-zinc-950">
                {title}
            </h3>
            <p className="mt-1 text-sm leading-6 text-zinc-500">{description}</p>
            <div className="mt-5">{children}</div>
        </div>
    );
}

