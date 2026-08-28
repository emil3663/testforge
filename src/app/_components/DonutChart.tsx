
export function DonutChart({ passed, failed }: { passed: number; failed: number }) {
    const total = Math.max(passed + failed, 1);
    const passedAngle = (passed / total) * 360;

    return (
        <div
            className="relative h-24 w-24 rounded-full"
            style={{
                background: `conic-gradient(#10b981 0deg ${passedAngle}deg, #f43f5e ${passedAngle}deg 360deg)`,
            }}
        >
            <div className="absolute inset-[14px] flex items-center justify-center rounded-full bg-white text-center">
                <div>
                    <div className="text-lg font-semibold text-zinc-950">{total}</div>
                    <div className="text-[10px] uppercase tracking-[0.18em] text-zinc-500">
                        results
                    </div>
                </div>
            </div>
        </div>
    );
}

