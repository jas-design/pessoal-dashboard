import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

function readProjectFile(relativePath: string): string {
  return readFileSync(new URL(`../../${relativePath}`, import.meta.url), "utf8");
}

test("dashboard usa somente definições puras durante renderização estática", () => {
  const dashboard = readProjectFile("src/pages/dashboard.astro");
  const definitions = readProjectFile(
    "src/services/financial/dashboard-metric-cards.ts",
  );

  const frontmatter = dashboard.split("---", 3)[1] ?? "";

  assert.match(frontmatter, /dashboard-metric-cards/);
  assert.doesNotMatch(frontmatter, /dashboard-data/);
  assert.doesNotMatch(
    definitions,
    /supabase|import\.meta\.env|lib\/env|lib\/supabase|monthly-metrics|monthly-summary/i,
  );
});

test("dashboard-data preserva o reexport público dos cards", () => {
  const dashboardData = readProjectFile(
    "src/services/financial/dashboard-data.ts",
  );

  assert.match(
    dashboardData,
    /export \{ financialMetricCards \} from "\.\/dashboard-metric-cards"/,
  );
});
