# Test cases: Health & Observability (HLT)

Section 3.1 of the [test plan](../../TEST_PLAN.md), which keeps the app overview, the feature status, the known limitations and the index of areas. Since TFP-253 each area's cases are in a file of their own; a ticket names the area it touches.

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| HLT-01 | `GET /api/health` (automated: `tests/regression/testforge.sections.spec.ts` — "reports health and observability metadata") | Response is `ok`; JSON body includes `status: "ok"`, `service: "testforge-next"`, a string `environment`, `mode: "local-in-process"` (TFP-031 — every route runs in-process since TFP-010/011 deleted the FastAPI proxy layer, so there is no other mode to report), a `siteUrl` containing `http`, and an ISO `timestamp`; response carries `X-Frame-Options: DENY`, `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, a `Permissions-Policy` restricting `camera`, and a `Content-Security-Policy` with `default-src 'self'`. | ✅ |
