import { EmptyState } from "@/app/_components/EmptyState";
import { coverageClasses } from "@/app/_lib/format";
import type { CoverageMatrixItem } from "@/lib/report/types";

export function CoverageTable({ matrix }: { matrix: CoverageMatrixItem[] }) {
    return matrix.length > 0 ? (
        <div className="overflow-x-auto rounded-2xl border border-zinc-200">
            <table className="min-w-full divide-y divide-zinc-200 text-left text-sm">
                <thead className="bg-zinc-50 text-xs uppercase tracking-[0.16em] text-zinc-500">
                    <tr>
                        <th className="px-4 py-3 font-medium">Requirement</th>
                        <th className="px-4 py-3 font-medium">Status</th>
                        <th className="px-4 py-3 font-medium">Linked Tests</th>
                    </tr>
                </thead>
                <tbody className="divide-y divide-zinc-100 bg-white text-zinc-600">
                    {matrix.map((item) => (
                        <tr key={item.requirement}>
                            <td className="px-4 py-3 align-top font-medium text-zinc-900">
                                {item.requirement}
                            </td>
                            <td className="px-4 py-3 align-top">
                                <span
                                    className={`inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${coverageClasses(
                                        item.status
                                    )}`}
                                >
                                    {item.status}
                                </span>
                            </td>
                            <td className="px-4 py-3 align-top text-xs leading-5 text-zinc-500">
                                {item.tests.length > 0 ? (
                                    <ul className="space-y-2">
                                        {item.tests.map((testName) => (
                                            <li
                                                key={`${item.requirement}-${testName}`}
                                                className="rounded-xl border border-zinc-200 bg-zinc-50 px-3 py-2 text-sm leading-5 text-zinc-700"
                                            >
                                                {testName}
                                            </li>
                                        ))}
                                    </ul>
                                ) : (
                                    "No tests mapped"
                                )}
                            </td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    ) : (
        <EmptyState message="No coverage matrix was produced for this run." />
    );
}

