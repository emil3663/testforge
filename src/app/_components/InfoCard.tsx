
export function InfoCard({ title, body }: { title: string; body: string }) {
    return (
        <div className="rounded-2xl border border-zinc-200 bg-zinc-50 p-4">
            <div className="text-sm font-semibold text-zinc-950">{title}</div>
            <p className="mt-2 text-sm leading-6 text-zinc-500">{body}</p>
        </div>
    );
}

