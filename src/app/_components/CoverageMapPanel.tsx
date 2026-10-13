import { ReportPanel } from "@/app/_components/ReportPanel";
import { describeCoverageMap, describeCoverageMapType } from "@/lib/report/coverage-map-text";
import type { RunReport } from "@/lib/report/types";

// Phase 42 (TFP-192, Decision 3): per page type, what the tests touch, and
// each element, link or flow the inspection found that no test touches.
export function CoverageMapPanel({ report }: { report: RunReport }) {
    const map = report.coverageMap;
    if (!map) return null;
    return (
        <ReportPanel
            eyebrow="Coverage Map"
            title="What the tests touch"
            description="Each element, link and flow the inspection found, by page type, and what no test touches."
        >
            <p className="text-sm font-semibold leading-6 text-zinc-900" data-testid="coverage-map-headline">{describeCoverageMap(map)}</p>
            <div className="mt-3 overflow-x-auto">
                <table className="w-full text-left text-sm">
                    <thead className="text-xs uppercase text-zinc-500">
                        <tr><th className="px-3 py-2">Page type</th><th className="px-3 py-2">Touched by a test</th><th className="px-3 py-2">Touched by none</th></tr>
                    </thead>
                    <tbody>
                        {map.types.map((type) => (
                            <tr key={type.pattern} className="border-t border-zinc-100 align-top">
                                <td className="px-3 py-2 font-mono text-xs text-zinc-900">{type.pattern}</td>
                                <td className="px-3 py-2">{describeCoverageMapType(type)}</td>
                                <td className="px-3 py-2 text-zinc-600">{type.uncovered.length > 0 ? type.uncovered.map((item) => <div key={item}>{item}</div>) : "-"}</td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </ReportPanel>
    );
}
