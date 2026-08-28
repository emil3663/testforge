export function escapeForSingleQuotedString(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
}

export function escapeForDoubleQuotedSelector(value: string) {
    return value.replace(/\\/g, "\\\\").replace(/"/g, '\\"');
}

export function escapeForRegExpLiteral(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function escapeRegExp(value: string) {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

export function toSentenceCase(value: string) {
    if (!value) {
        return "Generated scenario";
    }

    return value.charAt(0).toUpperCase() + value.slice(1);
}

export function summarizeDescription(description: string) {
    const cleaned = description.replace(/\s+/g, " ").trim();
    if (!cleaned) {
        return "Generated scenario";
    }

    return cleaned.length > 80 ? `${cleaned.slice(0, 77)}...` : cleaned;
}

export function includesAny(text: string, keywords: string[]) {
    return keywords.some((keyword) => {
        if (/^[a-z0-9]+$/i.test(keyword)) {
            return new RegExp(`\\b${escapeRegExp(keyword)}\\b`, "i").test(text);
        }

        return text.includes(keyword);
    });
}
