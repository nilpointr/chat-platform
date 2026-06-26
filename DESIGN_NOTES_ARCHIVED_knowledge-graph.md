# Local Knowledge Graph + Runtime Topology Tool — Design Notes

## Goal
A local tool (MCP server + CLI) for Claude CLI that combines:
1. Code-level knowledge graph (à la CodeGraphContext)
2. Runtime/deployment topology — cross-service relationships that don't
   exist in any single codebase's AST (e.g. Service A calls Service B
   over HTTP when handling a user-initiated request)

## Reference project
CodeGraphContext (github.com/CodeGraphContext/CodeGraphContext)
- MCP server + CLI, indexes code into a graph via tree-sitter
- Supports multiple embedded/server graph backends: KuzuDB, FalkorDB
  Lite, LadybugDB, Neo4j (Docker/external)
- KuzuDB or FalkorDB Lite are the recommended default for local/desktop
  use — zero-config, embedded, fast. Reserve Neo4j for cases needing
  Neo4j Browser visualization or massive graphs.
- We're leveraging its indexing approach but plan to diverge in design.

## Key design decisions so far

### 1. Database choice
- Prefer embedded (KuzuDB or similar) over a Neo4j server process for
  local single-user use — avoids JVM/Docker lifecycle management.
- Keep Neo4j as an option for visualization/debugging if needed.

### 2. Two distinct edge "universes" — must stay typed separately
- **Static/code edges** (verified by parsing): `CALLS`, `IMPORTS`,
  `INHERITS`, etc. — this is what CGC-style indexing already gives you.
- **Runtime/topology edges** (asserted or inferred): `CALLS_AT_RUNTIME`,
  `INVOKES_HTTP`, `DEPLOYS_TO`, etc.
- Do NOT let these collapse into a single edge type. Conflating
  "calls in-process" with "calls over the network at runtime" produces
  wrong answers about latency, blast radius, failure domains.

### 3. Runtime topology ingestion — phased approach
Order of preference, basic → ground truth:
1. **Manual YAML manifest** (build this first, to iron out graph schema)
2. **Derived from existing infra config** — docker-compose.yml, k8s
   manifests, OpenAPI/AsyncAPI specs (avoid reinventing what already
   exists; consider import/parsing support instead of pure hand-authoring)
3. **Heuristic from code** — detect HTTP client calls, env vars like
   `SERVICE_B_URL`, etc.
4. **Telemetry-derived (real source of truth)** — OTel traces / APM
   spans give caller, callee, protocol, operation, sync/async,
   volume/timing. This is the eventual ground truth but a bigger
   integration lift — deliberately deferred until manual schema is
   validated.

### 4. Manifest schema (draft, designed to map cleanly onto future trace data)
```yaml
service: service-a
calls:
  - target: service-b
    protocol: http
    operation: POST /payments
    trigger: "user-initiated checkout request"
    sync: true
```
Rationale: trace spans naturally produce `target`, `protocol`,
`operation`, `sync` — so manual and telemetry-derived edges should
share this shape from day one to avoid a schema migration later.

### 5. Provenance tagging (do this from day one, even manual-only phase)
- Every edge gets a `source` field: `manual`, `static-inferred`,
  `otel-trace`, etc.
- Enables future confidence-weighted queries and reconciliation
  between manual and telemetry-derived edges without ambiguity.
- Reconciliation behavior (override vs. append vs. flag-conflict)
  should be decided in principle now, even if not built yet — avoids
  silent duplicate-edge buildup later.

### 6. Scope discipline for the manual manifest
- Keep it narrow initially: caller, callee, protocol, trigger, sync/async.
- Resist adding expressiveness (conditionals, environments, traffic %)
  until the basic shape is validated against real query patterns.
- Naming candidates: `topology.yaml` / `runtime-manifest.yaml`
  (avoid generic "service manifest" — tends to accumulate unrelated config).

## Open items / not yet decided
- Exact node/edge schema for the graph DB (labels, properties) —
  was offered but deferred; revisit once manifest schema is used in
  a few real queries.
- MCP tool surface for this layer (e.g. constrained tools like
  `add_runtime_edge`, `query_topology` vs. raw query access) —
  not yet discussed in detail, same caution as for the original
  knowledge-graph MCP design applies (constrained > raw query exposure).
- Entity resolution across services (same service referenced by
  different names in manifest vs. docker-compose vs. code) — not
  yet addressed.

## General principles carried over from earlier KG design discussion
- Constrained MCP tools > raw query execution exposed to Claude
- Idempotent upserts, not naive inserts, to avoid duplicate edges
- Subgraph/result-size limiting for context budget
- Decide global vs. per-project graph scope early