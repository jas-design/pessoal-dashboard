import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { resolveSupabaseConnectionStatus } from "../../src/services/settings/connection-status";

function readProjectFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("status Supabase diferencia configuracao, sessao e servico verificado", () => {
  assert.deepEqual(resolveSupabaseConnectionStatus("loading"), {
    label: "Verificando",
    detail: "Cliente configurado; verificando sessão e acesso ao serviço.",
    badgeState: "neutral",
  });
  assert.equal(resolveSupabaseConnectionStatus("session_missing").label, "Sem sessão");
  assert.equal(
    resolveSupabaseConnectionStatus("service_verified").label,
    "Serviço verificado",
  );
  assert.equal(
    resolveSupabaseConnectionStatus("verification_error").label,
    "Não verificado",
  );
});

test("sidebar nao publica ambiente, uso ou identidade ficticios", () => {
  const sidebar = readProjectFile("src/components/layout/Sidebar.astro");
  const frontmatter = sidebar.split("---", 3)[1] ?? "";

  assert.doesNotMatch(sidebar, /Producao|Produção|Uso do Sistema|2\.4 GB|48%|Andres Braun/);
  assert.doesNotMatch(frontmatter, /supabase|lib\/env|import\.meta\.env/i);
  assert.match(sidebar, /data-sidebar-user-name/);
  assert.match(sidebar, /initializeSidebarSession/);
});

test("configuracoes nao declara Supabase conectado pela inicializacao do cliente", () => {
  const settings = readProjectFile("src/services/settings/settings-page.ts");

  assert.doesNotMatch(settings, /setBadge\(["']supabase["'],\s*["']Conectado["']/);
  assert.match(settings, /renderSupabaseConnection\(serviceVerified/);
  assert.match(settings, /onAuthStateChange/);
});
