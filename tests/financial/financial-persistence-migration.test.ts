import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261028120000_financial_extraction_persistence_v2.sql",
  import.meta.url,
);
const validationUrl = new URL(
  "../../scripts/supabase/staging/07c11/09c-financial-persistence-v2-validation.sql",
  import.meta.url,
);

async function migrationSql() {
  return readFile(migrationUrl, "utf8");
}

test("migration v2 é aditiva e mantém o contrato v1", async () => {
  const sql = await migrationSql();

  assert.match(sql, /add column logical_key text/i);
  assert.match(sql, /add column source_cell text/i);
  assert.match(sql, /add column contract_version smallint not null default 1/i);
  assert.match(sql, /create or replace function public\.finance_complete_document_v2\(/i);
  assert.doesNotMatch(sql, /drop function\s+public\.finance_complete_document/i);
  assert.doesNotMatch(
    sql,
    /create or replace function public\.finance_complete_document\s*\(/i,
  );
  assert.doesNotMatch(sql, /drop table|truncate table|delete from/i);
});

test("migration suporta os quatro códigos e sinal negativo somente no resultado", async () => {
  const sql = await migrationSql();

  for (const metric of ["revenue", "expense", "net_result", "cash_available"]) {
    assert.match(sql, new RegExp(`'${metric}'`));
  }

  assert.match(sql, /metric = 'net_result'\s+or amount >= 0/i);
  assert.match(sql, /v_metric <> 'net_result' and v_amount < 0/i);
});

test("migration implementa identidade lógica, retry idempotente e conflito seguro", async () => {
  const sql = await migrationSql();

  assert.match(sql, /financial_extracted_rows_v2_logical_identity_uidx/i);
  assert.match(sql, /document_id, source_etag, logical_key/i);
  assert.match(sql, /v_expected_logical_key := concat_ws/i);
  assert.match(sql, /group by row_item\.value->>'logical_key'[\s\S]*having count\(\*\) > 1/i);
  assert.match(sql, /Reimportacao conflitante para chave logica v2/i);
  assert.match(sql, /v_unchanged := v_unchanged \+ 1/i);
  assert.doesNotMatch(
    sql,
    /do update set[\s\S]*review_status\s*=\s*'pending_review'/i,
  );
});

test("migration mantém separação de empresa e estado de revisão", async () => {
  const sql = await migrationSql();

  assert.match(sql, /v_company_id is distinct from v_doc\.company_id/i);
  assert.match(sql, /where id = v_doc\.company_id[\s\S]*owner_id = v_doc\.owner_id/i);
  assert.match(sql, /review_status[\s\S]*'pending_review'/i);
  assert.match(sql, /approved or rejected[\s\S]*never reset/i);
  assert.doesNotMatch(sql, /disable row level security/i);
  assert.doesNotMatch(sql, /enable row level security/i);
});

test("RPC v2 não fica acessível a usuários do navegador", async () => {
  const sql = await migrationSql();
  const validationSql = await readFile(validationUrl, "utf8");

  assert.match(
    sql,
    /revoke all on function public\.finance_complete_document_v2\([\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.finance_complete_document_v2\([\s\S]*to service_role/i,
  );
  assert.doesNotMatch(
    sql,
    /grant execute on function public\.finance_complete_document_v2\([\s\S]*to (anon|authenticated)/i,
  );
  assert.doesNotMatch(sql, /financial_monthly_metrics|financial_monthly_summary/i);
  assert.match(validationSql, /set local role authenticated/i);
  assert.match(validationSql, /set local role anon/i);
  assert.match(
    validationSql,
    /from public\.financial_extracted_rows[\s\S]*where contract_version = 2/i,
  );
  assert.match(validationSql, /rollback;\s*$/i);
});
