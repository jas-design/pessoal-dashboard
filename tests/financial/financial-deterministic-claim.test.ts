import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL(
  "../../supabase/migrations/20261102120000_financial_deterministic_document_claim.sql",
  import.meta.url,
);
const validationUrl = new URL(
  "../../scripts/supabase/staging/07c11/11d-financial-deterministic-claim-validation.sql",
  import.meta.url,
);

test("claim v2 seleciona somente a identidade exata do documento", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /finance_claim_document_v2\s*\(/i);
  assert.match(sql, /where id = p_document_id[\s\S]*for update/i);
  assert.match(sql, /v_doc\.company_id is distinct from p_company_id/i);
  assert.match(sql, /v_doc\.source_etag is distinct from p_source_etag/i);
  assert.match(sql, /v_doc\.period_year is distinct from extract\(year from p_period_month\)/i);
  assert.match(sql, /v_doc\.period_month is distinct from extract\(month from p_period_month\)/i);
  assert.doesNotMatch(sql, /order by[\s\S]*limit 1/i);
  assert.doesNotMatch(sql, /skip locked/i);
});

test("claim v2 restringe origem, XLSX, tamanho, empresa e concorrência", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /v_doc\.provider is distinct from 'onedrive'/i);
  assert.match(sql, /v_doc\.file_size not between 1 and 8388608/i);
  assert.match(sql, /v_doc\.file_name !~\* '\\\.xlsx\$'/i);
  assert.match(sql, /v_doc\.processing_status is distinct from 'pending'/i);
  assert.match(sql, /owner_id = v_doc\.owner_id[\s\S]*is_active = true/i);
  assert.match(sql, /pg_advisory_xact_lock/i);
  assert.match(sql, /Documento exato possui claim ativo/i);
});

test("claim v2 é service-role-only e não publica fatos", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /revoke all on function public\.finance_claim_document_v2\([\s\S]*from public, anon, authenticated, service_role/i,
  );
  assert.match(
    sql,
    /grant execute on function public\.finance_claim_document_v2\([\s\S]*to service_role/i,
  );
  assert.doesNotMatch(sql, /financial_monthly_metrics_published|finance_publish_monthly_metrics/i);
});

test("validação local usa isca, identidade inválida e rollback", async () => {
  const sql = await readFile(validationUrl, "utf8");

  assert.match(sql, /v_decoy_document_id/i);
  assert.match(sql, /wrong-etag/i);
  assert.match(sql, /2099-10-01/i);
  assert.match(sql, /decoy document was claimed/i);
  assert.match(sql, /active claim was replaced/i);
  assert.match(sql, /rollback;\s*$/i);
});
