# Incremental financial intake

Candidate subworkflow: `n8n/workflows/14-financial-incremental-intake.json`.
Requires parser 12A.3 from this PR. Not installed or executed remotely.

## Contract

Call using Execute Sub-workflow, once with all items, wait for completion.
Each input item contains only `{ "document_id": "UUID" }`, 1–10 items per call.
Deduplicates IDs; derives company, period, ETag and source from catalog, never
from user-supplied amounts. One supported canonical management XLSX at a time,
maximum 8 MiB. Other documents are isolated. This is not a generic OCR/CSV flow.

Pipeline: input -> catalog -> existing facts -> deduplication -> Graph download
-> private worker -> validation -> deterministic claim -> atomic completion.
Four canonical facts enter pending review: revenue, expense, net result, cash.
No approval/publication or financial transaction fabrication. Same-version
facts skip download; partial/conflicting facts are isolated, never overwritten.
Older accumulated facts need a separate audited correction, not this intake.

Monthly provenance permits non-B columns, one common column for the combined
metrics, and revenue row 23/24. Parser 12A.3 proves the column matches the month;
the workflow requires its exact version and five successful reconciliations.
The database claim revalidates identity/ETag before persistence. A document
changed during processing must be retried with current metadata, never patched.

## Private installation

1. Deploy and validate worker 12A.3 using a real authorized XLSX privately.
2. Import this subworkflow once. Set company UUID/name and sourceRoot in
   `Define approved batch inventory`; replace CONFIGURE_PROJECT_REF in HTTP URLs.
   Select existing Supabase, Microsoft Graph and worker credentials in n8n.
   Restrict workflow callers to the intended Delta Sync workflow in n8n settings.
3. Enable the configuration flag only after configuration and a manual pilot.
   Run one eligible document twice: first call returns pending_review; repeat
   returns already_processed with no additional facts. Test a stale worker,
   missing file, partial facts and ETag race. Check RPC state after any timeout.
4. Connect the existing Delta Sync after catalog upsert, passing database document
   UUIDs (not Graph IDs), chunks <=10. Preserve the existing sync workflow until
   the pilot passes. Do not guess its output field mapping.
5. Inspect every returned result; `isolated` is a failure requiring follow-up,
   not success. A returned summary does not by itself prove successful ingestion.

## Recovery and operational limits

GET transport retries: up to 3, 2s interval. HTTP error responses are validated
and isolated; no automatic retry of claim/completion writes. On timeout inspect
claim/job and facts first; replay same IDs only through the idempotent contract.
Network exceptions stop execution rather than silently discard documents.
A failed child must not prevent original catalog synchronization from being
recorded; but its document IDs must be durably queued before advancing Delta
cursor, or captured for replay by the parent. This PR does not add that durable
outbox or change the parent. Before scheduling unattended operation, implement
and verify that recovery contract against the live Delta Sync workflow. Do not
rely on execution payload retention: it is disabled to avoid retaining financial
content. Set a sanitized error notification in the private parent (IDs/status,
no spreadsheet contents). Request correlation is n8n execution ID; claim_id is
provided by the existing database RPC and passed to completion.

## Validation

Local tests compile Code nodes, check links, configuration gate, catalog period,
version deduplication, partial-version isolation, and company/path boundary.
These checks are not a substitute for execution on the installed n8n version.
No new MCP, schema migration or external paid AI service is required by this
candidate. No live n8n connector was available during preparation.
