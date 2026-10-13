import { describeCoverageMap, describeCoverageMapType } from "./coverage-map-text";
import { escapeReportHtml as e } from "./text";
import type { CoverageMap } from "./types";

/**
 * Phase 42 (TFP-192, Decision 3): the coverage map in an HTML export - per
 * page type, what the tests touch, and each element, link or flow that no
 * test touches, named.
 */
export function buildCoverageMapHtmlSection(map: CoverageMap | undefined): string {
    if (!map) return "";
    return `
        <section id="coverage-map" style="background:white;border:1px solid #e4e4e7;border-radius:20px;padding:20px;margin-top:16px">
            <h2 style="font-size:17px;margin:0 0 8px">Coverage map</h2>
            <p style="font-weight:600">${e(describeCoverageMap(map))}</p>
            <table style="width:100%;border-collapse:collapse;font-size:13px">
                <thead><tr><th style="text-align:left">Page type</th><th style="text-align:left">Touched by a test</th><th style="text-align:left">Touched by none</th></tr></thead>
                <tbody>${map.types.map((type) => `
                    <tr style="vertical-align:top"><td>${e(type.pattern)}</td><td>${e(describeCoverageMapType(type))}</td><td>${type.uncovered.length > 0 ? type.uncovered.map((item) => e(item)).join("<br>") : "-"}</td></tr>`).join("")}</tbody>
            </table>
        </section>`;
}
