// Phase 35 (TFP-133, Decision 3): the OWASP Top 10:2025 category and the
// ASVS 5.0 requirement IDs each passive security check is tagged with.
//
// Copied from the published sources, never written from memory:
// - OWASP Top 10:2025 - github.com/OWASP/Top10, branch master, commit
//   3a31f35346c3f4e90f350395124382fa53af2afe (2026-09-24; the 2025 edition has
//   no release tag), files 2025/docs/en/A01_2025-*.md … A10_2025-*.md. Each
//   title below is that file's first heading.
// - ASVS 5.0.0 - see ./asvs.ts (tag v5.0.0_release). Each requirement ID was
//   read from 5.0/en/0x12-V3, 0x21-V12, 0x22-V13, 0x23-V14 and 0x25-V16.
//
// How each check's category was chosen: the category whose own text names
// what the check finds, else the category whose "List of Mapped CWEs"
// contains the check's CWE. The reasoning sits beside each entry.

export const TOP10_SOURCE = "OWASP Top 10:2025, github.com/OWASP/Top10 master 3a31f35 (2025/docs/en)";

export const TOP10_2025 = {
    A01: "A01:2025 Broken Access Control",
    A02: "A02:2025 Security Misconfiguration",
    A04: "A04:2025 Cryptographic Failures",
    A06: "A06:2025 Insecure Design",
    A07: "A07:2025 Authentication Failures",
    A10: "A10:2025 Mishandling of Exceptional Conditions",
} as const;

export interface CheckStandard {
    category: string;
    asvs: string[];
    why: string;
}

export const PASSIVE_CHECK_STANDARDS = {
    // A02's text: "The server does not send security headers or directives,
    // or they are not set to secure values." ASVS 3.4.1 HSTS, 3.4.3 CSP,
    // 3.4.4 nosniff, 3.4.5 referrer policy, 3.4.6 frame-ancestors.
    headers: { category: TOP10_2025.A02, asvs: ["3.4.1", "3.4.3", "3.4.4", "3.4.5", "3.4.6"], why: "A02 text names missing security headers" },
    // CWE-614 (no Secure) and CWE-1004 (no HttpOnly) are mapped to A02.
    // ASVS 3.3.1 Secure, 3.3.3 host-only, 3.3.4 HttpOnly. Not 3.3.2
    // SameSite: Playwright reports an unset SameSite the same as an explicit
    // one, and the requirement asks for a judgement about the cookie's
    // purpose. (The Phase 36 expiry rule is CWE-613, mapped to A07; it is
    // reported in the same test and says so in its finding.)
    cookies: { category: TOP10_2025.A02, asvs: ["3.3.1", "3.3.3", "3.3.4"], why: "CWE-614 and CWE-1004 are mapped to A02" },
    // CWE-497 (sensitive system information) is mapped to A01; A02's text
    // does not name version disclosure. ASVS 13.4.6.
    version: { category: TOP10_2025.A01, asvs: ["13.4.6"], why: "CWE-497 is mapped to A01" },
    // CWE-319 (cleartext transmission) and CWE-523 (unprotected transport
    // of credentials) are mapped to A04. ASVS 12.2.1.
    transport: { category: TOP10_2025.A04, asvs: ["12.2.1"], why: "CWE-319 and CWE-523 are mapped to A04" },
    // CWE-598 (GET request with sensitive query strings) is mapped to A06.
    // ASVS 14.2.1.
    urlSecrets: { category: TOP10_2025.A06, asvs: ["14.2.1"], why: "CWE-598 is mapped to A06" },
    // CWE-209 (error message containing sensitive information) is mapped to
    // A10, whose references point to ASVS V16.5 Error Handling; A02's text
    // also names stack traces. ASVS 16.5.1.
    errorPage: { category: TOP10_2025.A10, asvs: ["16.5.1"], why: "CWE-209 is mapped to A10, which references ASVS V16.5" },
} satisfies Record<string, CheckStandard>;

/** `annotation` entries for a check: its category and each ASVS requirement. */
export function standardAnnotations(standard: CheckStandard): string {
    return [
        `{ type: 'category', description: '${standard.category}' }`,
        ...standard.asvs.map((id) => `{ type: 'asvs', description: '${id}' }`),
    ].join(", ");
}
