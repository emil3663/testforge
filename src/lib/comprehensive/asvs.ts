// OWASP Application Security Verification Standard 5.0.0 (May 2025): its
// chapters, and which of them a passive run can reach at all.
//
// Source (Phase 35 Decision 3: copied, never written from memory):
// github.com/OWASP/ASVS, tag v5.0.0_release, commit
// 5cf9b032440be53ce345ab3c130fda46ba1ce7a2 (2025-05-30), files
// 5.0/en/0x10-V1-Encoding-and-Sanitization.md through
// 5.0/en/0x26-V17-WebRTC.md; each id and name below is that file's first
// heading. Version from 5.0/en/0x00-Header.yaml: "Version 5.0.0", May 2025.
//
// "Reachable" is the passive level's design (Decision 3), stated per chapter
// with the requirement that puts it in reach, read from the same files.
// Whether a chapter was actually tested in a run is never taken from this
// table: it comes from the ASVS tags on the checks that ran (TFP-133).

export const ASVS_SOURCE = {
    standard: "OWASP ASVS",
    version: "5.0.0",
    published: "May 2025",
    repository: "github.com/OWASP/ASVS",
    tag: "v5.0.0_release",
    commit: "5cf9b032440be53ce345ab3c130fda46ba1ce7a2",
    files: "5.0/en/0x10-V1-Encoding-and-Sanitization.md … 5.0/en/0x26-V17-WebRTC.md",
} as const;

export interface AsvsChapter {
    id: string;
    name: string;
    /** Whether a passive run (page loads and one missing-page probe) can check any of it. */
    passiveReach: "in reach" | "out of reach";
    /** Why, in one line: the requirement in reach, or what reaching it needs. */
    why: string;
}

export const ASVS_CHAPTERS: readonly AsvsChapter[] = [
    { id: "V1", name: "Encoding and Sanitization", passiveReach: "out of reach", why: "needs input sent to the site (the active level)" },
    { id: "V2", name: "Validation and Business Logic", passiveReach: "out of reach", why: "needs input sent to the site (the active level)" },
    { id: "V3", name: "Web Frontend Security", passiveReach: "in reach", why: "security headers and cookie attributes are visible on every page load" },
    { id: "V4", name: "API and Web Service", passiveReach: "out of reach", why: "needs requests to the site's APIs (the active level)" },
    { id: "V5", name: "File Handling", passiveReach: "out of reach", why: "needs files uploaded (the active level)" },
    { id: "V6", name: "Authentication", passiveReach: "out of reach", why: "needs logging in (the authenticated level)" },
    { id: "V7", name: "Session Management", passiveReach: "out of reach", why: "needs logging in and out (the authenticated level)" },
    { id: "V8", name: "Authorization", passiveReach: "out of reach", why: "needs two accounts (the authenticated level)" },
    { id: "V9", name: "Self-contained Tokens", passiveReach: "out of reach", why: "needs the tokens a login issues (the authenticated level)" },
    { id: "V10", name: "OAuth and OIDC", passiveReach: "out of reach", why: "needs a login flow (the authenticated level)" },
    { id: "V11", name: "Cryptography", passiveReach: "out of reach", why: "server-side, not visible over HTTP" },
    { id: "V12", name: "Secure Communication", passiveReach: "in reach", why: "12.2.1: plain-HTTP pages and forms that carry a password are visible" },
    { id: "V13", name: "Configuration", passiveReach: "in reach", why: "13.4.6: backend version details in response headers are visible" },
    { id: "V14", name: "Data Protection", passiveReach: "in reach", why: "14.2.1: session tokens and passwords in URLs are visible" },
    { id: "V15", name: "Secure Coding and Architecture", passiveReach: "out of reach", why: "server-side, not visible over HTTP" },
    { id: "V16", name: "Security Logging and Error Handling", passiveReach: "in reach", why: "16.5.1: the missing-page probe shows whether an error page leaks internals" },
    { id: "V17", name: "WebRTC", passiveReach: "out of reach", why: "needs a WebRTC session (not in this slice)" },
];
