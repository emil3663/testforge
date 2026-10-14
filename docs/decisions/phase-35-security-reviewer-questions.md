# Phase 35 Security Research — Reviewer Questions (for Martin)

**Companion to:** `phase-35-security-testing-research.md`
**Date:** 2026-10-13
**Ask:** Mark up / answer the questions below. You don't need to read the full doc first — each question stands alone, with a pointer to the relevant section if you want context.

Background in one line: TestForge points at a **website** and runs reproducible test suites; Phase 35 adds a **security** area. "Standard" runs must be **non-intrusive**; "Comprehensive" runs may actively probe, behind a per-target authorisation gate. The questions below are the judgement calls where your experience matters more than mine.

---

## A. The key judgement calls

1. **nuclei in Standard?** Is nuclei's default/safe template set genuinely non-intrusive enough to run in a Standard (non-intrusive) pass on an unauthenticated target — or should *any* nuclei run be Comprehensive-only? If some templates are Standard-safe, how would you draw that line (tags, severity, a curated allowlist)?

2. **ZAP passive/active boundary.** We plan to run ZAP as a proxy behind the browser (passive) and optionally active-scan. Where exactly should passive end and active begin for our purposes? Anything ZAP calls "passive" that you'd still treat as intrusive?

3. **sqlmap — in or out of an automated product?** Does automated SQLi testing belong inside a product at all, or should it be a manual escalation a human kicks off? If in, what guardrails are non-negotiable (scope limits, techniques to disable, risk/level caps)?

## B. Standard vs Comprehensive placement

For each check, is our proposed placement right? (S = Standard/non-intrusive, C = Comprehensive/gated)

- Security headers + cookie flags (CSP, HSTS, Secure/HttpOnly/SameSite) — proposed **S**
- Retire.js (vulnerable JS libs on loaded pages) — proposed **S**
- testssl.sh / sslyze (TLS/cert grading) — proposed **S**
- nuclei (safe templates) — proposed **S** *(see A1)*
- ffuf / gobuster content discovery — proposed **C**
- ZAP active scan — proposed **C**
- sqlmap — proposed **C** *(see A3)*
- nmap light (common ports + TLS/cert NSE) — proposed **C**

## C. Open questions from the research

4. **ffuf vs gobuster** as the single content-discovery primary — preference?
5. **ZAP integration shape** — REST API + Automation Framework, the Playwright-proxy pattern, or both (proxy for passive, API for active)?
6. **Burp/Caido** — agree these stay optional "bring your own proxy," not a dependency?
7. **nmap overlap** — nuclei ships network/SSL templates and we have testssl; is nmap still worth it for port/service discovery, or redundant for our web-app scope?
8. **Authorisation gate** — what's the minimum acceptable control before any active check runs against a target?

## D. Anything missing?

9. Any check, tool or whole category we've under-weighted for web-app DAST? Anything in the full doc's "out of scope" list you'd argue back in?

---

*Full detail, tool-by-tool evaluation and build order are in the companion research doc. Nothing here is locked — this is pre-decision input.*
