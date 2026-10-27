> **Historical (April 2026).** This describes the consolidation from the FastAPI backend to Next.js. Phase 16 (2026-08-28) deleted the FastAPI backend, the backend-proxy layer and the legacy UI this plan refers to; nothing here describes TestForge today. Kept for history only — see [`README.md`](README.md).

# Phase 2 - API Contract (Canonical)

Goal: lock stable request/response contracts for the Next.js UI workflow while the backend implementation is migrated.

Scope for this phase:

- Document canonical endpoint contracts used by the Next.js UI.
- Define lifecycle/status semantics.
- Define backward-compatibility rules during migration.
- No runtime behavior changes in this phase.

## Canonical Surface

Base path: same-origin Next.js API routes under /api/*

- POST /api/generate
- POST /api/introspect
- POST /api/crawl
- GET /api/crawl?crawlId=...
- DELETE /api/crawl
- POST /api/run
- GET /api/run?runId=...
- DELETE /api/run
- POST /api/save-suite

## Shared Conventions

- Content-Type: application/json for request/response payloads.
- Success responses: HTTP 200 with JSON body.
- Validation failures: HTTP 400 with { "error": string }.
- Unknown runtime failures: HTTP 500 with { "error": string }.
- Contract rule: existing keys in successful responses are additive-only (no removals/renames) during migration.

## 1) Generate Contract

Endpoint: POST /api/generate

Request body:

{
  "baseUrl": "string (url)",
  "description": "string (required)",
  "selectedPractices": [
    "functional|cross-browser|responsive/mobile|performance/load|security|accessibility|usability|seo/content|cookie/session|database"
  ],
  "auditMode": "fast|deep",
  "contentRules": {
    "paths": ["/"],
    "requiredHeadings": ["string"],
    "requiredText": ["string"],
    "forbiddenText": ["string"]
  },
  "contentProfile": {
    "scannedAt": "ISO datetime",
    "baseUrl": "string",
    "pages": [
      {
        "path": "string",
        "url": "string",
        "title": "string",
        "metaDescription": "string",
        "headings": ["string"],
        "buttons": ["string"],
        "links": ["string"],
        "actionableElements": [],
        "linkDetails": [],
        "visibleTextSnippets": ["string"]
      }
    ],
    "warnings": ["string"]
  }
}

Response body:

{
  "code": "string"
}

Notes:

- description is required.
- baseUrl normalizes to default when omitted/empty.
- selectedPractices and content sections are optional inputs with normalization defaults.
- Phase 34 TFP-122: with no `contentProfile`, the route inspects the pages
  itself (the `contentRules.paths`, or the base URL's own path) and adds
  `"generatedBy"` (`"template"` unless another generator set it) and
  `"pageInspection": { "status": "inspected" | "failed", "paths": [...],
  "pages": n, "warnings": [...], "reason"?: "string" }` to the response. A
  failed inspection never blocks generation. Send `"autoInspect": false` to opt
  out; the response is then exactly as before.

## 2) Introspect Contract

Endpoint: POST /api/introspect

Request body:

{
  "baseUrl": "string (url)",
  "paths": ["/", "/about"]
}

Response body:

{
  "scannedAt": "ISO datetime",
  "baseUrl": "string",
  "pages": [
    {
      "path": "string",
      "url": "string",
      "title": "string",
      "metaDescription": "string",
      "headings": ["string"],
      "buttons": ["string"],
      "links": ["string"],
      "actionableElements": [],
      "linkDetails": [],
      "embeddedLinkDetails": [],
      "visibleTextSnippets": ["string"]
    }
  ],
  "warnings": ["string"]
}

## 3) Crawl Contracts

### 3.1 Start crawl

Endpoint: POST /api/crawl

Request body:

{
  "baseUrl": "string (url)"
}

Response body:

{
  "crawlId": "string",
  "crawlStatus": "running|completed|failed|cancelled",
  "duration": 0,
  "progress": {
    "maxPages": 100,
    "visitedUrls": 0,
    "queuedUrls": 0,
    "discoveredPages": 0,
    "warningsCount": 0,
    "currentUrl": null,
    "currentPath": null,
    "currentTitle": null,
    "lastCompletedPath": null,
    "lastCompletedTitle": null
  },
  "result": {
    "crawledAt": "ISO datetime",
    "baseUrl": "string",
    "pageCount": 0,
    "pages": [
      {
        "path": "string",
        "url": "string",
        "title": "string",
        "discoveredFrom": "string|null"
      }
    ],
    "warnings": ["string"]
  },
  "error": "string"
}

### 3.2 Poll crawl

Endpoint: GET /api/crawl?crawlId=...

Response body: same shape as start crawl snapshot.

### 3.3 Cancel crawl

Endpoint: DELETE /api/crawl

Request body:

{
  "crawlId": "string"
}

Response body: same snapshot shape with cancellationRequested reflected via crawlStatus progression to cancelled.

## 4) Run Contracts

### 4.1 Start run

Endpoint: POST /api/run

Request body:

{
  "code": "string (required)",
  "selectedPractices": ["string"],
  "auditMode": "fast|deep",
  "baseUrl": "string",
  "excludeTestTitles": ["string"],
  "includeTestTitles": ["string"]
}

Response body:

{
  "runId": "string",
  "runStatus": "queued|running|passed|failed|cancelled",
  "duration": 0,
  "cancellationRequested": false,
  "progress": {
    "totalTests": 0,
    "completedTests": 0,
    "passed": 0,
    "failed": 0,
    "blocked": 0,
    "flaky": 0,
    "runningTestTitle": null,
    "plannedExecutions": []
  },
  "result": {
    "runId": "string",
    "passed": false,
    "output": "string",
    "duration": 0,
    "report": {
      "summary": {},
      "execution": [],
      "defects": {},
      "coverage": {},
      "performance": {},
      "usability": {},
      "seo": {}
    },
    "progress": {
      "totalTests": 0,
      "completedTests": 0
    }
  }
}

### 4.2 Poll run

Endpoint: GET /api/run?runId=...

Response body: same run snapshot shape.

### 4.3 Cancel run

Endpoint: DELETE /api/run

Request body:

{
  "runId": "string"
}

Response body: same run snapshot shape with cancellationRequested / runStatus transition.

## 5) Save Suite Contract

Endpoint: POST /api/save-suite

Request body:

{
  "code": "string (required)",
  "description": "string (required)"
}

Response body:

{
  "fileName": "string",
  "filePath": "string",
  "suiteTitles": ["string"]
}

## Lifecycle Status Semantics

Run statuses:

- queued: accepted and waiting to execute.
- running: active execution in progress.
- passed: execution complete and no failing assertions.
- failed: execution complete with one or more failures.
- cancelled: user cancellation accepted; run terminated before completion.

Crawl statuses:

- running: active crawl in progress.
- completed: crawl finished successfully.
- failed: crawl terminated by runtime failure.
- cancelled: user cancellation accepted.

## Backward Compatibility Rules During Migration

- Keep all current Next.js response keys intact.
- New fields are allowed only as additive optional keys.
- Error response remains { "error": string } for all endpoints.
- UI must not require backend-only migration flags to function.
- Any schema-breaking change requires a dedicated review and a separate migration phase.

## Validation Gates For Next Phase

Before Phase 3 implementation starts:

- lint passes
- build passes
- existing regression/self tests pass
- no API response key removals detected for covered endpoints
