import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import path from "node:path";
import test from "node:test";

const repositoryRoot = process.cwd();
const stagingAuthorizationPath = path.join(
  repositoryRoot,
  "scripts/supabase/staging/10e1-financial-test-authorization.sql"
);
const stagingValidationPath = path.join(
  repositoryRoot,
  "scripts/supabase/staging/10e1-financial-test-authorization-validation.sql"
);
const productionReviewMigrationPath = path.join(
  repositoryRoot,
  "supabase/migrations/20261016121000_secure_financial_review_access.sql"
);

test("contrato operacional continua bloqueando documentos TESTE_", async () => {
  const migration = await readFile(productionReviewMigrationPath, "utf8");

  assert.match(migration, /file_name ~\* '\^TESTE_'/);
  assert.match(migration, /Arquivos de teste nao podem ser fontes primarias/);
  assert.match(migration, /Arquivos de teste nao podem ser aprovados/);
});

test("autorizacao sintetica fica fora das migrations remotas e usa allowlist exata", async () => {
  const sql = await readFile(stagingAuthorizationPath, "utf8");

  assert.match(stagingAuthorizationPath.replaceAll("\\", "/"), /scripts\/supabase\/staging\//);
  assert.doesNotMatch(stagingAuthorizationPath.replaceAll("\\", "/"), /supabase\/migrations\//);
  assert.match(sql, /create schema financial_test authorization postgres/i);
  assert.match(sql, /create table financial_test\.authorized_documents/i);
  assert.match(sql, /00000000-0000-4000-8000-0000000009e2/);
  assert.match(sql, /TESTE_FINANCEIRO_09B_SINTETICO\.xlsx/);
  assert.match(sql, /synthetic-local-sha256-2a5a4be80c428acf5c14c21bfc214d8020215ddbc95eb1f74c7161493de9e39a/);
  assert.match(sql, /7c32b6f51d5791c7219e68a1dea5596b/);
  assert.match(sql, /supabase_migrations\.schema_migrations/);
  assert.match(sql, /managed or remote migration history detected/);
  assert.doesNotMatch(sql, /https?:\/\//i);
});

test("RPCs locais preservam autorizacao, proveniencia e revisao", async () => {
  const sql = await readFile(stagingAuthorizationPath, "utf8");

  assert.match(sql, /create function financial_test\.authorize_primary_source/i);
  assert.match(sql, /create function financial_test\.approve_extracted_row/i);
  assert.match(sql, /security definer/gi);
  assert.match(sql, /member\.role = 'admin'/);
  assert.match(sql, /member\.role in \('admin', 'reviewer'\)/);
  assert.match(sql, /source_etag is distinct from v_allowed\.expected_source_etag/);
  assert.match(sql, /v_row\.company_id is distinct from v_document\.company_id/);
  assert.match(sql, /v_row\.review_status <> 'pending_review'/);
  assert.match(sql, /v_row\.review_revision <> p_expected_revision/);
  assert.match(sql, /contract_version <> 2/);
  assert.match(sql, /usage_role = 'primary'/);
  assert.match(sql, /financial_review_audit/);
});

test("excecao local nao fica acessivel ao navegador nem altera RPCs operacionais", async () => {
  const sql = await readFile(stagingAuthorizationPath, "utf8");

  assert.match(sql, /revoke all on schema financial_test from public, anon, authenticated, service_role/i);
  assert.match(sql, /grant usage on schema financial_test to service_role/i);
  assert.match(sql, /grant execute on function financial_test\.authorize_primary_source[\s\S]*to service_role/i);
  assert.match(sql, /grant execute on function financial_test\.approve_extracted_row[\s\S]*to service_role/i);
  assert.doesNotMatch(sql, /create\s+or\s+replace\s+function\s+(public|financial_private)\.finance_review/i);
  assert.doesNotMatch(sql, /grant execute[\s\S]*to authenticated/i);
});

test("validacao cobre allowlist, aprovacao, empresa divergente, legado e rollback", async () => {
  const sql = await readFile(stagingValidationPath, "utf8");

  assert.match(sql, /TESTE_FINANCEIRO_10E1_NAO_AUTORIZADO\.xlsx/);
  assert.match(sql, /non-allowlisted TESTE_ document was authorized/);
  assert.match(sql, /pending facts were published/);
  assert.match(sql, /cross-company row was approved/);
  assert.match(sql, /operational source classification accepted TESTE_/);
  assert.match(sql, /operational review accepted TESTE_/);
  assert.match(sql, /legacy financial metrics changed/);
  assert.match(sql, /rollback;\s*$/i);
});

test("scripts locais nao escrevem nos consolidados legados", async () => {
  const authorization = await readFile(stagingAuthorizationPath, "utf8");
  const validation = await readFile(stagingValidationPath, "utf8");
  const unsafeLegacyWrite = /(?:insert\s+into|update|delete\s+from|truncate|alter\s+table)\s+public\.financial_monthly_metrics\b/i;

  assert.doesNotMatch(authorization, unsafeLegacyWrite);
  assert.doesNotMatch(validation, unsafeLegacyWrite);
});
