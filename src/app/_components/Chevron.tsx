
export function Chevron({ collapsed, dark = false }: { collapsed: boolean; dark?: boolean }) {
    return (
        <svg
            className={`h-5 w-5 shrink-0 transition-transform ${collapsed ? "rotate-180" : "rotate-0"} ${dark ? "text-zinc-400" : "text-zinc-500"}`}
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
        >
            <path d="M6 15l6-6 6 6" />
        </svg>
    );
}

