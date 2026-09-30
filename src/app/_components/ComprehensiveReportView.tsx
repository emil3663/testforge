import type { ComprehensiveReport } from "@/lib/report/types";

// Phase 35 (TFP-132, Decision 7): a Comprehensive run's report shows its one
// area: the summary, a per-page table, failures and findings by category,
// the local model's section, then what the run did not test.
export function ComprehensiveReportView({ report }: { report: ComprehensiveReport }) {
    return (
        <div className="space-y-6" data-testid="comprehensive-report">
            <div className="rounded-[28px] border border-indigo-100 bg-indigo-50/60 p-6">
                <div className="text-xs font-semibold uppercase tracking-[0.22em] text-indigo-600">{report.label}</div>
                <h2 className="mt-2 text-xl font-semibold text-zinc-950">{report.summary.headline}</h2>
                <p className="mt-2 text-sm text-zinc-600">
                    {report.summary.pages} pages, {report.summary.tests} checks: {report.summary.passed} passed, {report.summary.failed} failed,{" "}
                    {report.summary.findings} findings, {report.summary.notRun} not run.
                </p>
                <p className="mt-1 text-xs text-zinc-500">{report.workerNote} Page cap {report.pageCap}.</p>
            </div>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">Pages</h3>
                <div className="mt-3 overflow-x-auto">
                    <table className="w-full text-left text-sm">
                        <thead className="text-xs uppercase text-zinc-500">
                            <tr><th className="py-2">Page</th><th>Checks</th><th>Passed</th><th>Failed</th><th>Findings</th><th>Not run</th></tr>
                        </thead>
                        <tbody>
                            {report.pages.map((row) => (
                                <tr key={row.path} className="border-t border-zinc-100">
                                    <td className="py-2 font-mono text-xs">{row.path}</td>
                                    <td>{row.tests}</td>
                                    <td>{row.passed}</td>
                                    <td className={row.failed > 0 ? "font-semibold text-rose-700" : ""}>{row.failed}</td>
                                    <td>{row.findings}</td>
                                    <td>{row.notRun}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">Failures and findings</h3>
                {report.groups.length === 0 ? (
                    <p className="mt-2 text-sm text-zinc-500">No failures or findings.</p>
                ) : (
                    report.groups.map((group) => (
                        <div key={group.category} className="mt-4">
                            <div className="text-sm font-medium text-zinc-800">{group.category}</div>
                            <ul className="mt-1 space-y-1 text-sm">
                                {group.failures.map((issue, index) => (
                                    <li key={`f-${index}`} className="text-rose-700">
                                        Failure · <span className="font-mono text-xs">{issue.page}</span> · {issue.title}: {issue.detail}
                                    </li>
                                ))}
                                {group.findings.map((issue, index) => (
                                    <li key={`n-${index}`} className="text-amber-800">
                                        Finding · <span className="font-mono text-xs">{issue.page}</span> · {issue.title}: {issue.detail}
                                    </li>
                                ))}
                            </ul>
                        </div>
                    ))
                )}
            </section>

            <section className="rounded-[28px] border border-zinc-200 bg-white p-5">
                <h3 className="text-sm font-semibold text-zinc-900">Local model scenarios</h3>
                <p className="mt-2 text-sm text-zinc-600">{report.model.note}</p>
            </section>

            <section className="rounded-[28px] border border-amber-200 bg-amber-50/60 p-5">
                <h3 className="text-sm font-semibold text-zinc-900">What this run did not test</h3>
                <div className="mt-2 space-y-2 text-sm text-zinc-700">
                    {report.notTested.statements.map((statement) => <p key={statement}>{statement}</p>)}
                    {report.notTested.pagesNotCovered ? <p>{report.notTested.pagesNotCovered}</p> : null}
                </div>
                {report.notTested.asvs ? (
                    <div className="mt-4 overflow-x-auto">
                        <p className="text-xs text-zinc-500">Chapters from {report.notTested.asvs.source}.</p>
                        <table className="mt-2 w-full text-left text-sm">
                            <thead className="text-xs uppercase text-zinc-500">
                                <tr><th className="py-2">Chapter</th><th>Passive reach</th><th>Tested in this run</th><th>Why</th></tr>
                            </thead>
                            <tbody>
                                {report.notTested.asvs.chapters.map((chapter) => (
                                    <tr key={chapter.id} className="border-t border-amber-100">
                                        <td className="py-2">{chapter.id} {chapter.name}</td>
                                        <td>{chapter.passiveReach}</td>
                                        <td>{chapter.testedInRun ? "yes" : "no"}</td>
                                        <td className="text-xs text-zinc-600">{chapter.why}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                ) : null}
            </section>
        </div>
    );
}
