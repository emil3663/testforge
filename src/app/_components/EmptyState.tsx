
export function EmptyState({ message }: { message: string }) {
    return (
        <div className="rounded-2xl border border-dashed border-zinc-200 bg-zinc-50 px-4 py-6 text-sm text-zinc-500">
            {message}
        </div>
    );
}

