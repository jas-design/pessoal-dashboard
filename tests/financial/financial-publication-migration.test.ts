import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261030120000_financial_monthly_publication.sql",
  import.meta.url,
);
const validationUrl = new URL(
  "../../scripts/supabase/staging/10c-financial-publication-validation.sql",
  import.meta.url,
);

test("migration cria uma camada publicada por empresa sem alterar tabelas legadas", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /create table public\.financial_monthly_metrics_published/i);
  assert.match(sql, /unique \(company_id, period_month\)/i);
  assert.match(sql, /approved_extracted_row_ids uuid\[\] not null/i);
  assert.match(sql, /source_digest text not null/i);
  assert.match(sql, /source_document_id uuid not null/i);
  assert.match(sql, /source_etag text not null/i);
  assert.doesNotMatch(
    sql,
    /(insert into|update|delete from|alter table) public\.financial_monthly_metrics\b/i,
  );
  assert.doesNotMatch(sql, /financial_monthly_summary/i);
});

test("RPC publica somente fatos v2 aprovados e preserva métricas ausentes", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /v_row\.contract_version <> 2/i);
  assert.match(sql, /v_row\.review_status <> 'approved'/i);
  assert.match(sql, /v_row\.metric not in \('revenue', 'expense', 'net_result', 'cash_available'\)/i);
  assert.match(sql, /v_net_profit := v_row\.amount/i);
  assert.match(sql, /v_expenses := v_row\.amount/i);
  assert.match(sql, /v_has_expenses boolean := false/i);
  assert.match(sql, /v_net_profit,[\s\S]*null,[\s\S]*v_cash_balance/i);
  assert.doesNotMatch(sql, /v_net_margin\s*:=|v_revenue\s*-\s*v_expenses/i);
});

test("RPC valida autorização, empresa, ETag e fonte primária", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /member\.role in \('admin', 'reviewer'\)/i);
  assert.match(sql, /v_document\.company_id is distinct from p_company_id/i);
  assert.match(sql, /v_document\.source_etag is distinct from v_source_etag/i);
  assert.match(sql, /policy\.usage_role = 'primary'/i);
  assert.match(sql, /security definer[\s\S]*set search_path = ''/i);
});

test("publicação é idempotente, conflitante com segurança e server-side only", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /source_digest = v_source_digest/i);
  assert.match(sql, /'status', 'unchanged'/i);
  assert.match(sql, /Conflito de publicacao/i);
  assert.match(
    sql,
    /revoke all on function public\.finance_publish_monthly_metrics\(uuid,date,uuid\[\],uuid\)[\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.finance_publish_monthly_metrics\(uuid,date,uuid\[\],uuid\)[\s\S]*to service_role/i,
  );
});

test("validação staging cobre os cenários financeiros e termina em rollback", async () => {
  const sql = await readFile(validationUrl, "utf8");

  for (const evidence of [
    "-75.15",
    "approved zero",
    "missing metrics",
    "pending fact",
    "rejected fact",
    "changed ETag",
    "identical retry",
    "conflicting publication",
    "cross-company",
    "publication RLS",
  ]) {
    assert.match(sql, new RegExp(evidence, "i"));
  }

  assert.match(sql, /rollback;\s*$/i);
});
