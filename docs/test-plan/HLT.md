# Test cases: Health & Observability (HLT)

Section 3.1 of the [test plan](../../TEST_PLAN.md), which keeps the app overview, the feature status, the known limitations and the index of areas. Since TFP-253 each area's cases are in a file of their own; a ticket names the area it touches.

| ID | Test | Expected Result | Status |
|----|------|-----------------|--------|
| HLT-01 | `GET /api/health` | `status: "ok"`, the service, environment, mode, site URL and timestamp; the security headers, `default-src 'self'` among them. [Evidence](../decisions/phase-16-implementation-backlog.md#hlt-01-evidence). | ✅ |
