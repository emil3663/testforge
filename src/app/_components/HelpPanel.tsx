import { useEffect, useRef } from "react";

interface HelpPanelProps {
    isOpen: boolean;
    onClose: () => void;
}

const REPORT_TABS: { label: string; description: string }[] = [
    { label: "Summary", description: "the headline: how many checks passed, how many failed, at a glance." },
    { label: "Execution", description: "the play-by-play of every step the test took." },
    { label: "Defects", description: "anything that looks like a real bug, explained in plain terms." },
    { label: "Coverage", description: "how much of the page or site was actually checked, and what was skipped (and why)." },
    { label: "Performance", description: "how fast the site responded." },
    { label: "Usability", description: "things that might confuse a real visitor." },
    { label: "SEO", description: "(only if you asked for it) how findable the page is in search engines." },
];

const THINGS_WORTH_KNOWING: string[] = [
    "You don't need to know how to code to use TestForge. If you can describe what \"working\" looks like, that's enough.",
    "If no AI key is set up, TestForge still works — it falls back to a built-in test builder instead of the AI-written one.",
    "A test TestForge writes is a real, standard test file. A developer can take it, tweak it, and keep using it — nothing here is locked to TestForge.",
    "You can compare two past test runs against the same site to see what changed between them — useful after a new version ships.",
];

const FAQ: { question: string; answer: string }[] = [
    {
        question: "Do I need to write any code?",
        answer: "No. Describe what you want checked in your own words.",
    },
    {
        question: "What if my description doesn't cover everything?",
        answer: "TestForge only tests what you describe (or what it discovers if you ask it to crawl/inspect first). If something wasn't checked, the Coverage tab will say so and explain why.",
    },
    {
        question: "Can I trust the report?",
        answer: "Every claim in the report is backed by something TestForge actually did in the browser — it doesn't guess or make things up about what happened.",
    },
];

export function HelpPanel({ isOpen, onClose }: HelpPanelProps) {
    const panelRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (!isOpen) {
            return;
        }

        function handleKeyDown(event: KeyboardEvent) {
            if (event.key === "Escape") {
                onClose();
            }
        }

        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [isOpen, onClose]);

    if (!isOpen) {
        return null;
    }

    return (
        <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-zinc-950/35 px-6 backdrop-blur-sm"
            onMouseDown={(event) => {
                if (!panelRef.current?.contains(event.target as Node)) {
                    onClose();
                }
            }}
        >
            <div
                ref={panelRef}
                className="flex max-h-[calc(100vh-2rem)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] border border-white/70 bg-white/95 shadow-[0_24px_80px_rgba(15,23,42,0.18)]"
            >
                <div className="flex items-start justify-between gap-3 border-b border-zinc-200 px-6 py-5">
                    <div>
                        <div className="text-sm font-semibold uppercase tracking-[0.18em] text-indigo-600">
                            Help
                        </div>
                        <div className="mt-1 text-lg font-semibold text-zinc-950">
                            How TestForge works
                        </div>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close help panel"
                        className="flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-zinc-200 bg-white text-zinc-500 transition hover:border-zinc-300 hover:text-zinc-800"
                    >
                        <svg
                            className="h-4 w-4"
                            viewBox="0 0 24 24"
                            fill="none"
                            stroke="currentColor"
                            strokeWidth="2"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        >
                            <path d="M18 6 6 18M6 6l12 12" />
                        </svg>
                    </button>
                </div>

                <div className="min-h-0 flex-1 space-y-6 overflow-y-auto px-6 py-5 text-sm leading-6 text-zinc-600">
                    <section>
                        <h3 className="text-sm font-semibold text-zinc-900">What is TestForge?</h3>
                        <p className="mt-2">
                            TestForge writes automated quality tests for a website, without you having
                            to write any code. You describe what you want checked in plain English —
                            &ldquo;check that the login page works&rdquo; — and TestForge turns that
                            into a real test, runs it against your site in a browser, and shows you a
                            report of what passed, what failed, and why.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-zinc-900">How to use it, step by step</h3>
                        <ol className="mt-2 list-decimal space-y-2 pl-5">
                            <li>
                                <strong className="text-zinc-800">Enter the website address</strong>{" "}
                                (the &ldquo;base URL&rdquo;) you want to test — for example the site
                                your team is building.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Describe what you want to check</strong>,
                                in your own words. You can also ask TestForge to first &ldquo;crawl&rdquo;
                                the site (look at its pages) or &ldquo;introspect&rdquo; a page (look
                                closely at what&rsquo;s on one page) so the test it writes actually
                                matches what&rsquo;s really there, instead of guessing.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Click Generate.</strong>{" "}
                                TestForge writes the test for you and shows you the code — you
                                don&rsquo;t need to understand it, but you can read the comments if
                                you&rsquo;re curious.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Click Run.</strong>{" "}
                                The test runs in a real browser in the background. You&rsquo;ll see
                                live progress, and you can stop it early if you need to.
                            </li>
                            <li>
                                <strong className="text-zinc-800">Read the report.</strong>{" "}
                                When it&rsquo;s done, TestForge shows a structured report broken into
                                tabs (see below) telling you exactly what it found.
                            </li>
                        </ol>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-zinc-900">What do the report tabs mean?</h3>
                        <ul className="mt-2 space-y-1.5">
                            {REPORT_TABS.map((tab) => (
                                <li key={tab.label}>
                                    <strong className="text-zinc-800">{tab.label}</strong> — {tab.description}
                                </li>
                            ))}
                        </ul>
                        <p className="mt-2">
                            Each tab can be exported as its own page you can share with someone else,
                            even if they don&rsquo;t have TestForge.
                        </p>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-zinc-900">Things worth knowing</h3>
                        <ul className="mt-2 list-disc space-y-1.5 pl-5">
                            {THINGS_WORTH_KNOWING.map((item) => (
                                <li key={item}>{item}</li>
                            ))}
                        </ul>
                    </section>

                    <section>
                        <h3 className="text-sm font-semibold text-zinc-900">Frequently asked</h3>
                        <div className="mt-2 space-y-3">
                            {FAQ.map((item) => (
                                <div key={item.question}>
                                    <div className="font-semibold text-zinc-800">{item.question}</div>
                                    <div className="mt-0.5">{item.answer}</div>
                                </div>
                            ))}
                        </div>
                    </section>
                </div>
            </div>
        </div>
    );
}
