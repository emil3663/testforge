# Phase 35 — Security Testing: Tool & Capability Research

**Status:** Research / pre-decision (nothing locked)
**Date:** 2026-10-13
**Context:** Feeds Phase 35 ("Comprehensive testing"), security area — the first Comprehensive area by the locked area order (security → SEO → highest-risk areas).
**Author model:** Drafted in chat under Emil's direction; implementation and commits to route through Claude Code per standing workflow rule.

---

## 1. Purpose

Emil compiled a list of ~26 pentesting / OSINT / red-team tools (from various videos) and asked whether TestForge could call them or replicate their functionality during testing. This document evaluates that list against TestForge's actual scope, recommends what to build, flags what to exclude and why, and proposes a build order and design constraints.

## 2. Scoping principle (the thing that decides everything)

TestForge is a tool you point at a **website** to map paths and run reproducible suites. Its security area is therefore **authorised web-application security testing (DAST)** — not infrastructure pentesting, not OSINT, not red-teaming.

Two consequences drive every verdict below:

- **The target is a web app reachable by URL.** Tools that need a shell on the host, domain credentials, cloud keys, or that target *people* rather than *the app* are out of scope by construction — TestForge will never have that access from a URL.
- **Standard must not be intrusive (locked).** Passive/read-only checks can live in Standard. Anything that actively probes, fuzzes, or attacks belongs in **Comprehensive**, behind an explicit per-target authorisation gate, off by default.

Anything that crosses from *testing* into *exploitation* (gaining access, cracking credentials, escalating privilege) is excluded regardless of technical feasibility — it changes the product's legal and ethical footprint entirely.

## 3. Evaluation of the source list

Name corrections applied: cnesys → Censys, "exif metadat" → ExifTool, bloohound → BloodHound, mao → nmap. "grams" dropped (defunct dark-web market search, ~2017).

Verdict key: ✅ core · 🔧 helper/replicate · ⚠️ optional/gated · ⛔ out of scope

| Tool | What it is | Integration path | Verdict |
|---|---|---|---|
| **nuclei** | Template-based vuln scanner, severity-tagged, large community template set | CLI, JSONL, rate-limitable, tag/severity scoping | ✅ Core — highest-value single add |
| **ffuf** | Fast web content/parameter fuzzer | CLI, clean JSON | ✅ Core |
| **gobuster** | Directory/DNS/vhost brute-forcing | CLI | ✅ Core (overlaps ffuf — one as primary) |
| **ExifTool** | File/image metadata extraction | CLI, JSON | 🔧 Helper (info-leakage checks), low risk |
| **CyberChef** | Data transform swiss-army knife (decode/encode/hash/JWT) | Node library, embed in-process | 🔧 Helper, low risk |
| **FOCA** | Document-metadata harvester | Windows GUI, not automatable | 🔧 Replicate useful part with ExifTool/parsers; don't call |
| **nmap** | Port/service/version scanner + NSE scripts | CLI `-oX`, parse via python-libnmap | ⚠️ Optional, Comprehensive-only — active, infra-focused; narrow web-app value |
| **Burp Suite** | Intercepting proxy + scanner | Community=GUI only; Pro=Java ext API; Enterprise=REST/GraphQL (paid) | ⚠️ Gated — only Enterprise cleanly automatable |
| **Caido** | Lighter modern Burp alternative | Scriptable workflows + plugin SDK, interaction-centric | ⚠️ Gated/partial |
| **Shodan** | Internet-exposed-service search (passive, 3rd-party DB) | REST/Python API, paid tiers | ⚠️ Optional passive recon, scope-adjacent |
| **Censys** | Internet asset/cert search (passive, 3rd-party DB) | REST API, free + paid | ⚠️ Optional passive recon, scope-adjacent |
| **SpiderFoot** | OSINT automation framework | Web UI + REST API | ⛔ Recon platform — scope creep |
| **recon-ng** | Modular recon framework | Interactive; resource-file scriptable | ⛔ Recon platform — scope creep |
| **bbot** | Modern async recon engine | CLI + Python API, NDJSON | ⛔ Recon platform — scope creep |
| **Ahmia** | Clearnet search for Tor hidden services | HTTP query | ⛔ Irrelevant to web-app QA |
| **Sherlock** | Username enumeration across sites | CLI, JSON | ⛔ People-targeting — privacy risk |
| **PhoneInfoga** | Phone-number OSINT | CLI + REST API | ⛔ People-targeting |
| **Metasploit** | Exploitation framework | RPC API (automatable) | ⛔ Exploitation ≠ QA (legal line) |
| **Hydra** | Online login brute-forcer | CLI | ⛔ Intrusive; pointless vs lockout-exempt automation accounts |
| **Hashcat** | Offline hash cracking | CLI, needs hashes + GPU | ⛔ No web-testing fit |
| **LinPEAS / WinPEAS** | Local priv-esc enumeration | Require a shell on target | ⛔ Post-exploitation |
| **BloodHound** | Active Directory attack-path mapping | Needs domain creds + collector | ⛔ Internal AD pentest |
| **CloudFox** | AWS/Azure/GCP attack-surface enumeration | Needs cloud credentials | ⛔ Different product area |
| **netcat** | Generic connect/listen/transfer primitive | CLI | ⛔ Trivially replaced by code; mostly an exploitation primitive |

**Net from the source list:** the genuinely useful web-app pieces are **nuclei, ffuf/gobuster, ExifTool, CyberChef**, with **nmap / Burp-Caido / Shodan-Censys** as optional, mostly-paid or infra-adjacent extras. The majority of the list is full-scope pentest/OSINT tooling that belongs to a *different* product with a different authorisation model, not a feature of a web-app tester.

## 4. Recommended additions (not on the original list)

The source list was weighted toward popular red-team tooling and missing the automation-first DAST tools that actually fit a URL-driven tester.

| Addition | What it adds | Integration | Where it fits |
|---|---|---|---|
| **OWASP ZAP** | Full DAST — passive + active web scanning | Docker + REST API + Automation Framework YAML; or proxy-mode behind Playwright | **Core.** Passive = Standard-safe; active = Comprehensive |
| **Security-header + cookie checks** | CSP, HSTS, X-Frame-Options, Secure/HttpOnly/SameSite | None — responses already captured via Playwright; pure code | Standard-safe, zero new dependency |
| **Retire.js** | Flags known-vulnerable JS libraries on loaded pages | Node lib / CLI, runs on already-loaded pages | Standard-safe, passive |
| **testssl.sh** / **sslyze** | TLS/cert configuration grading | CLI, JSON | Standard-safe-ish (one connection) |
| **sqlmap** | Automated SQL-injection testing | CLI, scriptable | Comprehensive-only, heavily gated; matches "break fields with bad data" |
| **Nikto** | Quick web-server misconfig / known-file scan | CLI, noisy, fast | Comprehensive, optional (ZAP overlaps most) |
| **SecLists** | Standard wordlist/payload corpus | Data, not a tool — feeds ffuf/gobuster/nuclei | Dependency for fuzzing tools |

### 4.1 Highlight: the ZAP + Playwright proxy pattern

The strongest single idea in this research. TestForge already crawls, maps journeys (Phase 19) and tests the authenticated state (Phase 20). Run **ZAP as a proxy behind Playwright**: the browser drives the app exactly as it already does, ZAP passively scans every request/response the browser touches, then optionally active-scans.

Why it matters:
- Turns TestForge's existing crawling/journey strength into a security engine essentially for free.
- Works on the **authenticated, JS-rendered** app — reaching areas pure-HTTP scanners (nuclei/ffuf against raw URLs) cannot.
- Passive mode is non-intrusive → qualifies for Standard; active mode → Comprehensive.

This is a differentiator, not just another scanner bolted on.

## 5. Structural backbone: OWASP ASVS

Rather than "we ran five scanners," map every check/tool to the **OWASP ASVS** requirements it covers (~250 structured web-security requirements). This produces, for security, the same thing Phase 42 is building for functional testing: a **security coverage map** with honest gaps, indexed to drive test selection and allocation. It gives the security area a spine that matches TestForge's existing "what's tested / not tested / why" philosophy.

## 6. AI skills (the AI-native angle)

Scanners produce noise; triage is the hard part, and this is where TestForge's AI layer earns its place.

- **Findings-triage skill** — ingests raw ZAP/nuclei/etc. JSON, dedupes across tools, ranks by real exploitability (not just scanner CVSS), explains each finding in plain English, emits in TestForge's report format. This is the layer that makes the output usable instead of a raw scanner dump.
- **Per-field injection-payload skill** — for Comprehensive's "break fields with bad data" framing: inspects each detected field (type, name, context) and generates targeted payloads — XSS for text, SQLi for query params, path traversal for file inputs. Slots directly into the Sep 28 decision to add security sourcing into the template generator itself.

## 7. Cross-cutting design constraints

These matter more than the individual tool picks:

- **Authorisation gating as a first-class control.** A per-target "I am authorised to test this" gate; anything active/intrusive off by default. Mirrors the existing automation-account setup precondition pattern.
- **Containerisation / Windows reality.** Nearly all of these are Linux CLIs; on the MSI workstation they'll need Docker/WSL. Normalise them behind one adapter — "run tool → parse JSON → emit TestForge finding" — so each new tool is a config, not bespoke wiring.
- **Cost & keys.** Shodan, Censys, Burp Enterprise are paid. Fits the established bring-your-own-key stance (Phase 20 / Phase 21 cost model) rather than a hosted default.
- **Standard vs Comprehensive placement** is a security property, not a convenience: passive→Standard, active→Comprehensive-gated. Keep it explicit per check.

## 8. Recommended build order

1. **Passive, zero-dependency wins first:** security-header + cookie checks, Retire.js. Pure code over responses already captured. Standard-safe.
2. **nuclei** as the security engine — passive/safe templates by default, intrusive severities behind opt-in. Severity-tagged findings straight into the structured report.
3. **ZAP passive via the Playwright-proxy pattern** — the key architectural piece.
4. **ffuf** (or gobuster) for content discovery.
5. **testssl/sslyze** for TLS grading (Standard candidate).
6. **ExifTool + CyberChef** as embedded helpers.
7. **Comprehensive, gated:** ZAP active scan, sqlmap, nmap (light: common ports + TLS/cert NSE), Nikto (optional).
8. **AI skills** (triage, payloads) layered over the above.
9. **ASVS coverage map** wrapping the whole area.

Note: nuclei ships network + SSL templates that overlap a light nmap pass and testssl, so sequence to avoid paying for the same coverage twice — nmap earns its place mainly for port/service discovery.

## 9. Explicitly out of scope (and why)

- **OSINT / recon platforms** (SpiderFoot, recon-ng, bbot, Shodan/Censys as a *platform*, Ahmia): target infrastructure and people, operate under rules-of-engagement, not URL-scoped. A separate product with its own authorisation model if ever wanted.
- **People-targeting OSINT** (Sherlock, PhoneInfoga): privacy risk, no web-app-QA value.
- **Exploitation & post-exploitation** (Metasploit, Hydra, Hashcat, LinPEAS/WinPEAS, netcat): crosses from testing into attack; needs access TestForge won't have.
- **Infra/cloud/AD** (BloodHound, CloudFox, nmap-as-infra-sweep): different access model and product area.
- **SAST / dependency / supply-chain scanners** (semgrep, trivy, gitleaks): need source or filesystem access, not a URL. Only relevant if TestForge grows a "scan my own repo" mode — park as a distinct future shape.

## 10. Open questions / decisions still needed

- ffuf vs gobuster as the single content-discovery primary.
- Whether ZAP integrates via REST API + Automation Framework, or the Playwright-proxy pattern, or both (proxy for passive, API for active).
- Which checks are confirmed Standard-safe enough to run by default on an unauthenticated target.
- Burp/Caido: confirm "bring your own proxy" as optional-later rather than a dependency.
- The third-party AI-security-agent landscape moves fast and current knowledge may be stale — worth a current-landscape search before committing if that direction is pursued.

## 11. Suggested next tickets (draft — to confirm/lock, not locked here)

Proposed for Phase 35 security area, pending Emil's approval and the usual decision-record + observable-acceptance-criteria treatment:

- Passive header/cookie/Retire.js checks (Standard).
- nuclei integration + adapter (run → parse → finding).
- ZAP Playwright-proxy passive integration.
- ffuf/gobuster content discovery.
- testssl/sslyze TLS grading.
- Comprehensive gated set: ZAP active, sqlmap, nmap-light.
- Findings-triage AI skill.
- Per-field payload-generation AI skill.
- ASVS coverage map + index.
- Authorisation-gate control + containerisation adapter (cross-cutting prerequisites).

---

*Research only. No code changes or commits made from this doc; implementation routes through Claude Code per standing workflow.*
