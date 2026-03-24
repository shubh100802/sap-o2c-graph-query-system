Note: The dataset is large and not included in the repository. Please download it from the provided link and place it in /sap-o2c-data before running setup.

# Graph-Based Data Modeling and Query System (SAP O2C)

This project implements a **context graph system with an LLM-powered query interface** over SAP Order-to-Cash data.

## Submission Links

- Working Demo Link: `http://localhost:3000` (replace with deployed URL if hosted)
- Public GitHub Repository: `https://github.com/shubh100802/sap-o2c-graph-query-system`
- AI Coding Session Logs: [`AI_CODING_LOGS/`](./AI_CODING_LOGS)

## Problem Statement

Business process data is fragmented across multiple tables (orders, deliveries, invoices, journal entries, payments).  
This system unifies them into a graph and allows natural-language querying with dataset-grounded responses.

## What This System Builds

1. Dataset ingestion into MySQL
2. Graph abstraction (`nodes`, `edges`) from relational SAP entities
3. Interactive graph visualization UI
4. Conversational query interface (NL -> SQL -> execution -> grounded answer)
5. Domain guardrails for off-topic prompt rejection

## Tech Stack

- Backend: Node.js, Express, mysql2, dotenv, axios, cors
- Database: MySQL
- Data ingestion: JSONL/CSV parser with batch inserts
- Frontend: HTML/CSS/JS + Cytoscape.js
- LLM Providers: Groq or Gemini (via `.env`)

## Architecture Decisions

1. **Relational storage + graph API abstraction**
- SAP entities remain normalized in MySQL with foreign keys.
- Graph is generated via SQL joins and exposed as `nodes + edges`.
- This keeps ingestion and traceability robust while enabling graph UX.

2. **Deterministic templates + LLM fallback**
- Known business intents (required sample queries) are handled via SQL templates for reliability.
- Open-ended in-domain queries use LLM SQL generation with strict prompt constraints.

3. **Grounded answer generation**
- Responses are generated from SQL execution results only.
- API returns SQL, row count, and data sample for transparency.

## Data Model

### Core Flow Tables
- `sales_order_headers`
- `sales_order_items`
- `outbound_delivery_headers`
- `outbound_delivery_items`
- `billing_document_headers`
- `billing_document_items`
- `journal_entry_items_accounts_receivable`
- `payments_accounts_receivable`

### Supporting Tables
- `business_partners`
- `business_partner_addresses`
- `products`
- `product_descriptions`
- `plants`
- Additional dataset tables are also ingested.

### Graph Relationships
- Customer -> Sales Order
- Sales Order -> Delivery
- Delivery -> Billing Document
- Billing Document -> Journal Entry
- Journal Entry -> Payment

## Functional Requirement Mapping

### 1) Graph Construction
- Ingestion pipeline in [`src/utils/dataLoader.js`](./src/utils/dataLoader.js)
- Schema in [`src/schema/schemaSql.js`](./src/schema/schemaSql.js)
- Graph generation in [`src/services/graphService.js`](./src/services/graphService.js)

### 2) Graph Visualization
- UI in [`public/index.html`](./public/index.html), [`public/styles.css`](./public/styles.css), [`public/app.js`](./public/app.js)
- Supports:
  - node click + metadata inspection
  - node expansion
  - relation visualization
  - node search and highlighting

### 3) Conversational Query Interface
- Endpoint: `POST /api/query`
- Pipeline:
  - guardrail check
  - intent/template match OR LLM SQL generation
  - SQL safety validation
  - execution + grounded answer

### 4) Required Example Queries

Supported:
1. `Which products are associated with the highest number of billing documents?`
2. `Trace full flow for billing document 90504248`
3. `Identify sales orders that have broken or incomplete flows (delivered but not billed)`

### 5) Guardrails

Implemented:
- Domain keyword + ID pattern filtering
- Off-topic rejection response:
  - `"This system is designed to answer questions related to the provided dataset only."`
- SQL read-only enforcement:
  - single `SELECT` only
  - block DDL/DML keywords
  - block comment-based injection patterns

## API Reference

### `GET /health`
Returns service and DB connectivity status.

### `GET /api/graph?limit=900`
Returns graph payload:

```json
{
  "nodes": [{ "id": "customer:310000108", "label": "Customer Name", "type": "customer" }],
  "edges": [{ "source": "customer:...", "target": "sales_order:...", "relationship": "PLACED" }]
}
```

### `GET /api/graph/node/:type/:id`
Returns node metadata for inspector panel.

### `GET /api/graph/expand/:type/:id?limit=400`
Returns neighborhood graph for selected node.

### `POST /api/query`

Request:

```json
{ "query": "Trace full flow for billing document 90504248" }
```

Response:

```json
{
  "intent": "trace_billing_flow",
  "answer": "Billing document ...",
  "sql": "SELECT ...",
  "rowCount": 12,
  "data": [],
  "highlightNodeIds": ["invoice:90504248"]
}
```

## LLM Prompting Strategy

Prompt includes:
- explicit schema context
- SQL-only output instruction
- single SELECT constraint
- strict join correctness guidance
- enforced `LIMIT <= 200`

This reduces hallucinations and keeps generated SQL safe and executable.

## Setup and Run

1. Install dependencies:

```bash
npm install
```

2. Configure `.env`:
- `DB_HOST`, `DB_PORT`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`
- `LLM_PROVIDER=groq|gemini`
- `GROQ_API_KEY` or `GEMINI_API_KEY`

3. Initialize schema + load data:

```bash
npm run setup
```

4. Start app:

```bash
npm start
```

5. Open:
- `http://localhost:3000`

## Testing Checklist

1. `GET /health` returns DB connected.
2. Graph renders with non-zero nodes/edges.
3. Node click shows metadata.
4. Node expand adds neighborhood.
5. Required 3 sample queries return grounded responses.
6. Off-topic prompt is rejected by guardrail.

## Project Structure

```text
backend/
  public/
    index.html
    app.js
    styles.css
  src/
    config/
    constants/
    controllers/
    routes/
    schema/
    services/
    utils/
  AI_CODING_LOGS/
  server.js
```

## Notes

- No authentication is required (as requested).
- Data loader supports both `.jsonl` and `.csv`.
- For final submission, replace placeholder GitHub/demo links above with actual public URLs.
