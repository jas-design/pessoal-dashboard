import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  getFinancialDataMessage,
  getFinancialValueStatus,
  resolveFinancialOverview,
} from "../../src/services/financial/financial-calculations";
import type { MonthlyFinancialMetrics } from "../../src/services/financial/monthly-metrics";

function metrics(
  overrides: Partial<MonthlyFinancialMetrics> = {},
): MonthlyFinancialMetrics {
  return {
    id: "00000000-0000-4000-8000-0000000010c0",
    company_id: "00000000-0000-4000-8000-0000000010c1",
    period_month: "2026-09-01",
    year: 2026,
    month: 9,
    revenue: 120.25,
    expenses: 0,
    net_profit: -75.15,
    net_margin: null,
    cash_balance: 350.8,
    cash_inflows: null,
    cash_outflows: null,
    net_revenue: null,
    costs: null,
    operating_expenses: null,
    financial_expenses: null,
    data_state: "approved",
    source_document_id: "00000000-0000-4000-8000-0000000010c2",
    source_etag: "synthetic-10c-etag",
    approved_at: "2026-10-30T12:00:00.000Z",
    published_at: "2026-10-30T12:05:00.000Z",
    created_at: "2026-10-30T12:05:00.000Z",
    updated_at: "2026-10-30T12:05:00.000Z",
    ...overrides,
  };
}

test("valores publicados preservam zero aprovado, resultado negativo e NULL", () => {
  const overview = resolveFinancialOverview(metrics());

  assert.equal(overview.revenue, 120.25);
  assert.equal(overview.expenses, 0);
  assert.equal(overview.netProfit, -75.15);
  assert.equal(overview.netMargin, null);
  assert.equal(overview.cashBalance, 350.8);
  assert.equal(getFinancialValueStatus(metrics(), 0), "Aprovado e publicado");
  assert.equal(
    getFinancialValueStatus(metrics(), null),
    "Não informado na fonte aprovada",
  );
});

test("estado pendente não usa totais de transações como publicação", () => {
  const pending = metrics({
    id: "",
    revenue: null,
    expenses: null,
    net_profit: null,
    cash_balance: null,
    data_state: "pending",
  });
  const overview = resolveFinancialOverview(pending, {
    incomeTotal: 999,
    incomeCount: 3,
    expenseTotal: 500,
    expenseCount: 2,
    transactionCount: 5,
  });

  assert.equal(overview.revenue, null);
  assert.equal(overview.expenses, null);
  assert.match(getFinancialDataMessage(pending), /aguardando publicação/i);
});

test("legado permanece separado e rotulado como não verificado", () => {
  const legacy = metrics({
    company_id: null,
    data_state: "unverified",
    source_document_id: null,
    source_etag: null,
    approved_at: null,
    published_at: null,
  });

  assert.equal(getFinancialValueStatus(legacy, legacy.revenue), "Origem não verificada");
  assert.match(getFinancialDataMessage(legacy), /legados sem empresa/i);
});

test("Dashboard e Financeiro usam o mesmo resolvedor financeiro", async () => {
  const dashboard = await readFile(
    new URL("../../src/services/financial/dashboard-data.ts", import.meta.url),
    "utf8",
  );
  const financeiro = await readFile(
    new URL("../../src/services/financial/financeiro-page.ts", import.meta.url),
    "utf8",
  );

  assert.match(dashboard, /resolveFinancialOverview\(metrics\)/);
  assert.match(financeiro, /resolveFinancialOverview\(metrics, transactionSummary\)/);
});
