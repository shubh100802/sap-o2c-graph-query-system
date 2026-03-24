# AI Coding Session Log

Date: 2026-03-23 (IST)  
Tooling: Codex CLI assistant + terminal commands

## Objective

Build a complete graph-based SAP O2C query system with:
- ingestion
- graph API
- chat query API
- guardrails
- visualization UI

## Iteration Summary

1. Scanned dataset folder structure and sampled records.
- Discovered dataset is JSONL (not CSV-only).
- Adapted ingestion to support both JSONL and CSV.

2. Built backend foundation.
- Express server, DB config, schema initialization, data loader.
- Core APIs: `/health`, `/api/graph`, `/api/query`.

3. Validated setup and fixed DB bootstrap issues.
- Added setup scripts (`setup`, `check-db`).
- Corrected schema-init/check execution order.

4. Diagnosed empty billing/invoice result issue.
- Root cause: foreign key constraints + ingestion order.
- Fix: dependency-aware folder load order + temporary FK check disable during ingestion.

5. Upgraded query pipeline.
- Added template intents for required business questions.
- Added data-grounded natural-language answer generation.
- Added LLM fallback path for open-ended supported questions.

6. Added graph exploration APIs.
- `/api/graph/node/:type/:id`
- `/api/graph/expand/:type/:id`

7. Built frontend.
- Single-page graph explorer + chat interface.
- Cytoscape visualization, node inspection, graph expansion, highlight nodes from query responses.

8. Ran end-to-end smoke tests.
- Graph APIs healthy.
- Required example query classes return grounded answers.

## Notable Commands Executed

- `npm install`
- `npm run init-db`
- `npm run load-data`
- `npm run setup`
- custom node/mysql sanity scripts for row counts and query validation
- endpoint smoke tests via `Invoke-WebRequest`

## Debugging Highlights

- Resolved MySQL auth/config blockers.
- Resolved ingestion ordering causing FK-related skipped inserts.
- Added deterministic query templates to ensure required examples are consistently answered.

## Final State

- Full-stack local app available at `http://localhost:3000`
- Dataset-backed graph visualization + conversational query interface
- Guardrails and SQL safety checks implemented
