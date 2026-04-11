"use client";

import { useState, useRef, useEffect } from "react";

type Step = "idle" | "generating" | "ready" | "running" | "done";

interface RunResult {
  passed: boolean;
  output: string;
  duration: number;
}

export default function Home() {
  const [baseUrl, setBaseUrl] = useState("https://example.com");
  const [description, setDescription] = useState("");
  const [step, setStep] = useState<Step>("idle");
  const [editedCode, setEditedCode] = useState("");
  const [editing, setEditing] = useState(false);
  const [result, setResult] = useState<RunResult | null>(null);
  const [error, setError] = useState("");
  const [copyLabel, setCopyLabel] = useState("Copy");
  const codeRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (editing && codeRef.current) {
      codeRef.current.focus();
    }
  }, [editing]);

  async function handleGenerate() {
    if (!description.trim()) return;
    setStep("generating");
    setEditedCode("");
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseUrl, description }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      setEditedCode(data.code);
      setStep("ready");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("idle");
    }
  }

  async function handleRun() {
    setStep("running");
    setResult(null);
    setError("");

    try {
      const res = await fetch("/api/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ code: editedCode }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Run failed");
      setResult(data);
      setStep("done");
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
      setStep("ready");
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(editedCode);
      setCopyLabel("Copied!");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    } catch {
      setCopyLabel("Copy failed");
      setTimeout(() => setCopyLabel("Copy"), 2000);
    }
  }

  const isGenerating = step === "generating";
  const isRunning = step === "running";
  const hasCode = step === "ready" || step === "done";

  return (
    <div className="flex flex-col min-h-screen">
      {/* Header */}
      <header className="border-b border-zinc-200 bg-white">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-indigo-600">
            <svg
              className="w-5 h-5 text-white"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M9 3H5a2 2 0 0 0-2 2v4m6-6h10a2 2 0 0 1 2 2v4M9 3v18m0 0h10a2 2 0 0 0 2-2V9M9 21H5a2 2 0 0 1-2-2V9m0 0h18" />
            </svg>
          </div>
          <span className="text-lg font-semibold tracking-tight">
            TestForge
          </span>
          <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-indigo-50 text-indigo-600 border border-indigo-200">
            beta
          </span>
        </div>
      </header>

      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-10 space-y-8">
        {/* Hero */}
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
            Describe your test in plain English
          </h1>
          <p className="text-zinc-500 text-base">
            Tell TestForge what you want to verify. It writes the Playwright
            code. You review, edit, and run it.
          </p>
        </div>

        {/* Input card */}
        <div className="bg-white rounded-2xl border border-zinc-200 shadow-sm p-6 space-y-5">
          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">
              Base URL
            </label>
            <input
              type="url"
              value={baseUrl}
              onChange={(e) => setBaseUrl(e.target.value)}
              placeholder="https://your-app.com"
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition"
            />
          </div>

          <div className="space-y-1.5">
            <label className="block text-sm font-medium text-zinc-700">
              What do you want to test?
            </label>
            <textarea
              rows={5}
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="E.g. Log in with valid credentials and verify the dashboard loads. Then try logging in with a wrong password and confirm the error message appears."
              className="w-full rounded-lg border border-zinc-200 bg-zinc-50 px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition resize-none"
            />
          </div>

          <button
            onClick={handleGenerate}
            disabled={!description.trim() || isGenerating || isRunning}
            className="flex items-center gap-2 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
          >
            {isGenerating ? (
              <>
                <Spinner />
                Generating…
              </>
            ) : (
              <>
                <svg
                  className="w-4 h-4"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M12 2L2 7l10 5 10-5-10-5z" />
                  <path d="M2 17l10 5 10-5" />
                  <path d="M2 12l10 5 10-5" />
                </svg>
                Generate test
              </>
            )}
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
            <strong>Error:</strong> {error}
          </div>
        )}

        {/* Code panel */}
        {hasCode && (
          <div className="bg-zinc-900 rounded-2xl border border-zinc-700 overflow-hidden shadow-lg">
            {/* toolbar */}
            <div className="flex items-center justify-between px-5 py-3 border-b border-zinc-700">
              <div className="flex items-center gap-2">
                <span className="w-3 h-3 rounded-full bg-red-500" />
                <span className="w-3 h-3 rounded-full bg-yellow-500" />
                <span className="w-3 h-3 rounded-full bg-green-500" />
              </div>
              <span className="text-xs text-zinc-400 font-mono">
                generated-test.spec.ts
              </span>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => setEditing((v) => !v)}
                  className="text-xs text-zinc-400 hover:text-white transition px-2 py-1 rounded hover:bg-zinc-700"
                >
                  {editing ? "View" : "Edit"}
                </button>
                <button
                  onClick={handleCopy}
                  className="text-xs text-zinc-400 hover:text-white transition px-2 py-1 rounded hover:bg-zinc-700"
                >
                  {copyLabel}
                </button>
              </div>
            </div>

            {editing ? (
              <textarea
                ref={codeRef}
                value={editedCode}
                onChange={(e) => setEditedCode(e.target.value)}
                className="w-full bg-zinc-900 text-green-300 font-mono text-sm px-5 py-5 focus:outline-none resize-none min-h-80"
                spellCheck={false}
                rows={editedCode.split("\n").length + 2}
              />
            ) : (
              <pre className="overflow-x-auto px-5 py-5 text-sm font-mono text-green-300 leading-relaxed whitespace-pre">
                {editedCode}
              </pre>
            )}

            {/* Run bar */}
            <div className="flex items-center justify-between px-5 py-3 border-t border-zinc-700 bg-zinc-800">
              <span className="text-xs text-zinc-400">
                Review the code above, edit if needed, then run it.
              </span>
              <button
                onClick={handleRun}
                disabled={isRunning}
                className="flex items-center gap-2 rounded-lg bg-emerald-600 px-4 py-2 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-50 disabled:cursor-not-allowed transition"
              >
                {isRunning ? (
                  <>
                    <Spinner />
                    Running…
                  </>
                ) : (
                  <>
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 24 24"
                      fill="currentColor"
                    >
                      <path d="M8 5v14l11-7z" />
                    </svg>
                    Run test
                  </>
                )}
              </button>
            </div>
          </div>
        )}

        {/* Results */}
        {result && (
          <div
            className={`rounded-2xl border ${
              result.passed
                ? "border-emerald-200 bg-emerald-50"
                : "border-red-200 bg-red-50"
            } overflow-hidden shadow-sm`}
          >
            <div
              className={`flex items-center gap-3 px-5 py-3 border-b ${
                result.passed
                  ? "border-emerald-200 bg-emerald-100"
                  : "border-red-200 bg-red-100"
              }`}
            >
              {result.passed ? (
                <svg
                  className="w-5 h-5 text-emerald-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M20 6L9 17l-5-5" />
                </svg>
              ) : (
                <svg
                  className="w-5 h-5 text-red-600"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                >
                  <path d="M18 6L6 18M6 6l12 12" />
                </svg>
              )}
              <span
                className={`font-semibold text-sm ${
                  result.passed ? "text-emerald-800" : "text-red-800"
                }`}
              >
                {result.passed ? "All tests passed" : "Tests failed"} &mdash;{" "}
                {result.duration}ms
              </span>
            </div>
            <pre className="px-5 py-4 text-xs font-mono text-zinc-700 whitespace-pre-wrap overflow-x-auto">
              {result.output}
            </pre>
          </div>
        )}
      </main>

      <footer className="border-t border-zinc-200 bg-white mt-auto">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center justify-between text-xs text-zinc-400">
          <span>TestForge — AI-native test automation</span>
          <span>Powered by Playwright &amp; OpenAI</span>
        </div>
      </footer>
    </div>
  );
}

function Spinner() {
  return (
    <svg
      className="animate-spin w-4 h-4"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
    >
      <path
        d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"
        strokeLinecap="round"
      />
    </svg>
  );
}
