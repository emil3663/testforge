export function pluralize(value: number, singular: string, plural: string) {
    return value === 1 ? singular : plural;
}

export function escapeReportHtml(value: string) {
    return value
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/\"/g, "&quot;")
        .replace(/'/g, "&#39;");
}

/** TFP-257: the report's last line, from the run's own stamp, so a saved report says what made it, not what reads it. */
export function buildVersionFooterHtml(producedBy: { version: string; commit: string | null } | undefined) {
    const made = producedBy
        ? `TestForge ${escapeReportHtml(producedBy.version)}${producedBy.commit ? ` (${escapeReportHtml(producedBy.commit)})` : ""}`
        : "TestForge version not recorded";
    return `<footer style="max-width: 1140px; margin: 0 auto; padding: 0 16px 24px; font-size: 12px; color: #71717a;">${made}</footer>`;
}

export function formatMilliseconds(value: number) {
    if (value >= 60000) {
        return `${(value / 60000).toFixed(1)}m`;
    }

    if (value >= 1000) {
        return `${(value / 1000).toFixed(1)}s`;
    }

    return `${value}ms`;
}

export function stripAnsi(text: string) {
    return text
        .replace(/\u001B\[[0-9;?]*[ -/]*[@-~]/g, "")
        .replace(/\u001B\][^\u0007]*(?:\u0007|\u001B\\)/g, "");
}

export function sanitizeDiagnosticText(value: string) {
    return stripAnsi(value)
        .replace(/\s+/g, " ")
        .replace(/\s+([.,;:!?])/g, "$1")
        .trim();
}

export function toTitleCase(value: string) {
    return value
        .split(/\s+/)
        .filter(Boolean)
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
}

export function normalizeExecutionTitle(title: string) {
    return title
        .replace(/^navigation link health:\s*/i, "")
        .replace(/^api link response:\s*/i, "")
        .replace(/^navigation element check:\s*/i, "")
        .replace(/^api element check:\s*/i, "")
        .replace(/^form element check:\s*/i, "")
        .replace(/^action element check:\s*/i, "")
        .trim();
}

export function simplifyExecutionTarget(title: string) {
    const normalized = normalizeExecutionTitle(title)
        .replace(/^keeps\s+/i, "")
        .replace(/^shows\s+/i, "")
        .replace(/^does not show\s+/i, "")
        .replace(/^exposes\s+/i, "")
        .replace(/^publishes\s+/i, "")
        .replace(/^link health:\s*/i, "")
        .replace(/^navigation destination:\s*/i, "")
        .replace(/^link types:\s*/i, "")
        .trim();

    return normalized || "the expected behavior";
}

export function classifyFailureReason(message: string) {
    const normalized = sanitizeDiagnosticText(message).toLowerCase();

    if (/tohaveattribute|attribute/.test(normalized)) {
        return "required attribute values did not match the expected result";
    }

    if (/tohavetitle|title/.test(normalized)) {
        return "the page title did not match the expected value";
    }

    if (/tocontaintext|text content|not to contain text|tocontain/.test(normalized)) {
        return "the expected page text did not match the expected content";
    }

    if (/tobevisible|not found|locator/.test(normalized)) {
        return "the expected element was not visible to the user";
    }

    if (/tohaveurl|url/.test(normalized)) {
        return "navigation finished on a different URL than expected";
    }

    if (/timeout/.test(normalized)) {
        return "the check timed out before the expected state was reached";
    }

    if (/toequal|tobe\(|expected/.test(normalized)) {
        return "the observed result did not match the expected assertion";
    }

    return "the automated check did not reach the expected result";
}
