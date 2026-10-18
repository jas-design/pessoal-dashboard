import { getCurrentSession } from "../../services/auth/auth";
import {
  getFinanceReviewHistory,
  listFinanceReviews,
  type FinanceReviewHistoryItem,
  type FinanceReviewRow,
  type FinanceReviewStatus,
  type FinanceSourceRole,
} from "../../services/financial/review";

const PAGE_SIZE = 20;
const UNLINKED_COMPANY = "__unlinked__";

const statusLabels = {
  pending_review: "Pendente",
  approved: "Aprovado",
  rejected: "Rejeitado",
} as const;

const roleLabels: Record<FinanceSourceRole, string> = {
  primary: "Fonte primária",
  supporting: "Documento de apoio",
  unclassified: "Não classificada",
};

type ReviewStatus = Exclude<FinanceReviewStatus, "all">;
type StatusState = "loading" | "error" | "denied" | "unauthenticated";

const state = {
  status: "pending_review" as ReviewStatus,
  page: 1,
  company: "",
  document: "",
  period: "",
  origin: "",
  total: 0,
  rows: [] as FinanceReviewRow[],
  selectedRow: null as FinanceReviewRow | null,
  userId: null as string | null,
  requestId: 0,
};

function query<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function element<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  className?: string,
  text?: string,
) {
  const result = document.createElement(tag);
  if (className) result.className = className;
  if (text !== undefined) result.textContent = text;
  return result;
}

function readUrlState() {
  const params = new URLSearchParams(window.location.search);
  const status = params.get("status");
  const page = Number(params.get("page"));

  if (status === "pending_review" || status === "approved" || status === "rejected") {
    state.status = status;
  }
  if (Number.isInteger(page) && page > 0) state.page = page;

  state.company = params.get("company") ?? "";
}

function writeUrlState() {
  const url = new URL(window.location.href);
  url.searchParams.set("status", state.status);
  url.searchParams.set("page", String(state.page));

  if (state.company) url.searchParams.set("company", state.company);
  else url.searchParams.delete("company");

  // Nomes de documentos e abas não vão para a URL, evitando exposição em logs e histórico.
  ["document", "period", "origin"].forEach((key) => url.searchParams.delete(key));

  window.history.replaceState({}, "", url);
}

function updateBackLink() {
  const link = query<HTMLAnchorElement>("[data-review-back-link]");
  if (!link) return;

  const currentUrl = new URL(window.location.href);
  const url = new URL("/financeiro", window.location.origin);

  ["company", "year", "month", "view"].forEach((key) => {
    const value = currentUrl.searchParams.get(key);
    if (value) url.searchParams.set(key, value);
  });

  link.href = `${url.pathname}${url.search}`;
}

function formatCurrency(amount: number | string, currency: string | null) {
  const value = typeof amount === "number" ? amount : Number(amount);
  const code = currency === "USD" || currency === "EUR" ? currency : "BRL";

  return Number.isFinite(value)
    ? value.toLocaleString("pt-BR", { style: "currency", currency: code })
    : "Valor indisponível";
}

function formatPeriod(period: string | null) {
  const match = period ? /^(\d{4})-(\d{2})/.exec(period) : null;
  if (!match) return period || "Competência não informada";

  return new Intl.DateTimeFormat("pt-BR", { month: "long", year: "numeric" })
    .format(new Date(Number(match[1]), Number(match[2]) - 1, 1));
}

function formatDateTime(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Data inválida";

  return new Intl.DateTimeFormat("pt-BR", {
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

function formatMetric(metric: string) {
  const labels: Record<string, string> = {
    revenue: "Receita",
    income: "Receita",
    expense: "Despesa",
    expenses: "Despesa",
  };

  return labels[metric.toLowerCase()] ?? metric;
}

function companyLabel(row: FinanceReviewRow) {
  if (row.company_id) return row.company_name ?? "Empresa autorizada sem nome";
  return "Empresa não vinculada";
}

function sourceCompanyLabel(row: FinanceReviewRow) {
  return row.source_company_name
    ? `${row.source_company_name} (informada na extração)`
    : "Não informada";
}

function originLabel(row: FinanceReviewRow) {
  return row.sheet_name ? `Aba ${row.sheet_name}` : "Aba não informada";
}

function badge(text: string, tone: string) {
  const result = element("span", "financial-review-badge", text);
  result.dataset.tone = tone;
  return result;
}

function button(label: string, action: string, rowId: string, className = "button-small") {
  const result = element("button", className, label);
  result.type = "button";
  result.dataset.reviewRowAction = action;
  result.dataset.rowId = rowId;
  return result;
}

function appendActions(container: HTMLElement, row: FinanceReviewRow) {
  container.append(button("Detalhes", "details", row.id));

  if (row.review_status !== "pending_review") return;

  const reason = "A autorização de decisão não é informada pela RPC de listagem.";
  const approve = button("Aprovar", "locked", row.id, "button-small is-success");
  const reject = button("Rejeitar", "locked", row.id, "button-small is-danger");

  [approve, reject].forEach((action) => {
    action.disabled = true;
    action.title = reason;
    action.setAttribute("aria-label", `${action.textContent}. Bloqueado: ${reason}`);
  });

  container.append(approve, reject);
}

function appendValidationBadges(container: HTMLElement, row: FinanceReviewRow) {
  container.append(badge(
    row.source_version_current ? "Versão atual" : "Reextração necessária",
    row.source_version_current ? "valid" : "warning",
  ));
  container.append(badge(
    roleLabels[row.source_usage_role],
    row.source_usage_role === "primary" ? "valid" : "neutral",
  ));

  if (!row.company_id) container.append(badge("Sem vínculo empresarial", "warning"));
}

function tableRow(row: FinanceReviewRow) {
  const tr = element("tr");

  const company = element("td");
  company.append(
    element("strong", undefined, companyLabel(row)),
    element("small", undefined, formatPeriod(row.period_month)),
  );

  const source = element("td");
  source.append(
    element("strong", undefined, row.file_name),
    element("small", undefined, `${originLabel(row)} · linha ${row.source_row ?? "--"}`),
  );

  const value = element("td");
  value.append(
    element("strong", undefined, formatMetric(row.metric)),
    element("small", "financial-review__amount", formatCurrency(row.amount, row.currency)),
  );

  const validations = element("td", "financial-review__validations");
  appendValidationBadges(validations, row);

  const status = element("td");
  status.append(badge(statusLabels[row.review_status], row.review_status));

  const actions = element("td", "financial-review__actions");
  appendActions(actions, row);

  tr.append(company, source, value, validations, status, actions);
  return tr;
}

function card(row: FinanceReviewRow) {
  const article = element("article", "financial-review-card");
  const header = element("header");
  const heading = element("div");

  heading.append(
    element("h3", undefined, companyLabel(row)),
    element("p", undefined, formatPeriod(row.period_month)),
  );
  header.append(heading, badge(statusLabels[row.review_status], row.review_status));

  const value = element("div", "financial-review-card__value");
  value.append(
    element("span", undefined, formatMetric(row.metric)),
    element("strong", undefined, formatCurrency(row.amount, row.currency)),
  );

  const source = element("div", "financial-review-card__source");
  source.append(
    element("strong", undefined, row.file_name),
    element("small", undefined, `${originLabel(row)} · linha ${row.source_row ?? "--"}`),
  );

  const validations = element("div", "financial-review__validations");
  appendValidationBadges(validations, row);

  const actions = element("div", "financial-review__actions");
  appendActions(actions, row);

  article.append(header, value, source, validations, actions);
  return article;
}

function filteredRows() {
  const documentQuery = state.document.trim().toLocaleLowerCase("pt-BR");

  return state.rows.filter((row) => {
    const matchesCompany = !state.company
      || (state.company === UNLINKED_COMPANY ? !row.company_id : row.company_id === state.company);
    const matchesDocument = !documentQuery
      || row.file_name.toLocaleLowerCase("pt-BR").includes(documentQuery);
    const matchesPeriod = !state.period || row.period_month === state.period;
    const matchesOrigin = !state.origin || (row.sheet_name ?? "") === state.origin;

    return matchesCompany && matchesDocument && matchesPeriod && matchesOrigin;
  });
}

function replaceSelectOptions(
  select: HTMLSelectElement | null,
  firstLabel: string,
  values: Array<[string, string]>,
  selectedValue: string,
) {
  if (!select) return;

  const fragment = document.createDocumentFragment();
  const first = element("option", undefined, firstLabel);
  first.value = "";
  fragment.append(first);

  values.forEach(([value, label]) => {
    const option = element("option", undefined, label);
    option.value = value;
    fragment.append(option);
  });

  if (selectedValue && !values.some(([value]) => value === selectedValue)) {
    const unavailable = element("option", undefined, "Filtro fora da página atual");
    unavailable.value = selectedValue;
    fragment.append(unavailable);
  }

  select.replaceChildren(fragment);
  select.value = selectedValue;
}

function updateFilterOptions() {
  const companies = new Map<string, string>();
  const periods = new Map<string, string>();
  const origins = new Map<string, string>();
  let hasUnlinkedCompany = false;

  state.rows.forEach((row) => {
    if (row.company_id) companies.set(row.company_id, companyLabel(row));
    else hasUnlinkedCompany = true;
    if (row.period_month) periods.set(row.period_month, formatPeriod(row.period_month));
    if (row.sheet_name) origins.set(row.sheet_name, row.sheet_name);
  });

  const companyOptions = [...companies.entries()]
    .sort((a, b) => a[1].localeCompare(b[1], "pt-BR"));
  if (hasUnlinkedCompany) companyOptions.push([UNLINKED_COMPANY, "Empresa não vinculada"]);

  replaceSelectOptions(
    query<HTMLSelectElement>("[data-review-company]"),
    "Todas nesta página",
    companyOptions,
    state.company,
  );
  replaceSelectOptions(
    query<HTMLSelectElement>("[data-review-period]"),
    "Todas nesta página",
    [...periods.entries()].sort((a, b) => b[0].localeCompare(a[0])),
    state.period,
  );
  replaceSelectOptions(
    query<HTMLSelectElement>("[data-review-origin]"),
    "Todas as abas",
    [...origins.entries()].sort((a, b) => a[1].localeCompare(b[1], "pt-BR")),
    state.origin,
  );

  const documentInput = query<HTMLInputElement>("[data-review-document]");
  if (documentInput) documentInput.value = state.document;
}

function hasActiveFilters() {
  return Boolean(state.company || state.document.trim() || state.period || state.origin);
}

function renderRows() {
  const table = query<HTMLElement>("[data-review-table]");
  const cards = query<HTMLElement>("[data-review-cards]");
  const body = query<HTMLTableSectionElement>("[data-review-table-body]");
  const empty = query<HTMLElement>("[data-review-empty]");
  const pagination = query<HTMLElement>(".financial-review__pagination");

  if (!table || !cards || !body || !empty || !pagination) return;

  const rows = filteredRows();
  body.replaceChildren(...rows.map(tableRow));
  cards.replaceChildren(...rows.map(card));

  const hasRows = rows.length > 0;
  table.hidden = !hasRows;
  cards.hidden = !hasRows;
  empty.hidden = hasRows;
  pagination.hidden = state.rows.length === 0;

  const emptyMessage = query<HTMLElement>("[data-review-empty-message]");
  const emptyClear = query<HTMLButtonElement>("[data-review-empty-clear]");
  const clear = query<HTMLButtonElement>("[data-review-clear-filters]");

  if (emptyMessage) {
    emptyMessage.textContent = hasActiveFilters()
      ? "Nenhum item desta página corresponde aos filtros."
      : "Não há itens neste status.";
  }
  if (emptyClear) emptyClear.hidden = !hasActiveFilters();
  if (clear) clear.hidden = !hasActiveFilters();

  const start = (state.page - 1) * PAGE_SIZE + 1;
  const end = Math.min(start + state.rows.length - 1, state.total);
  const summary = query<HTMLElement>("[data-review-page-summary]");
  if (summary) {
    summary.textContent = state.total
      ? `${start}–${end} de ${state.total} registros · ${rows.length} visíveis nesta página`
      : "Nenhum registro autorizado";
  }

  const previous = query<HTMLButtonElement>("[data-review-previous]");
  const next = query<HTMLButtonElement>("[data-review-next]");
  if (previous) previous.disabled = state.page <= 1;
  if (next) next.disabled = state.page * PAGE_SIZE >= state.total;

  query<HTMLElement>("[data-review-status-message]")?.setAttribute("hidden", "");
}

function updateTabs() {
  document.querySelectorAll<HTMLButtonElement>("[data-review-status]").forEach((tab) => {
    tab.setAttribute("aria-pressed", String(tab.dataset.reviewStatus === state.status));
  });
}

function setStatus(message: string, viewState: StatusState) {
  const container = query<HTMLElement>("[data-review-status-message]");
  const text = query<HTMLElement>("[data-review-status-text]");
  const loader = query<HTMLElement>(".financial-review__loader");
  const retry = query<HTMLButtonElement>("[data-review-status-retry]");

  if (!container || !text || !loader || !retry) return;

  container.dataset.state = viewState;
  container.hidden = false;
  text.textContent = message;
  loader.hidden = viewState !== "loading";
  retry.hidden = viewState === "loading" || viewState === "unauthenticated";
}

function errorView(error: unknown) {
  if (error instanceof Error && error.name === "FinanceReviewAuthenticationError") {
    return {
      state: "unauthenticated" as const,
      message: "Sua sessão expirou. Entre novamente para acessar a revisão financeira.",
    };
  }
  if (error instanceof Error && error.name === "FinanceReviewAccessDeniedError") {
    return {
      state: "denied" as const,
      message: "Acesso negado. Sua sessão não possui permissão para consultar esta fila.",
    };
  }

  return {
    state: "error" as const,
    message: "Não foi possível carregar a fila. Nenhum dado parcial foi exibido.",
  };
}

async function loadCounts(requestId: number) {
  const statuses = ["pending_review", "approved", "rejected"] as const;
  const results = await Promise.allSettled(
    statuses.map((status) => listFinanceReviews(status, 1, 0)),
  );

  if (requestId !== state.requestId) return;

  results.forEach((result, index) => {
    const count = query<HTMLElement>(`[data-review-count="${statuses[index]}"]`);
    if (count) {
      count.textContent = result.status === "fulfilled"
        ? String(result.value.total)
        : "--";
    }
  });
}

async function loadRows() {
  const requestId = ++state.requestId;
  setStatus("Carregando registros autorizados...", "loading");
  query<HTMLElement>("[data-review-table]")?.setAttribute("hidden", "");
  query<HTMLElement>("[data-review-cards]")?.setAttribute("hidden", "");
  query<HTMLElement>("[data-review-empty]")?.setAttribute("hidden", "");
  query<HTMLElement>(".financial-review__pagination")?.setAttribute("hidden", "");

  try {
    const [result] = await Promise.all([
      listFinanceReviews(state.status, PAGE_SIZE, (state.page - 1) * PAGE_SIZE),
      loadCounts(requestId),
    ]);

    if (requestId !== state.requestId) return;

    state.total = result.total;
    state.rows = result.items;

    if (state.page > 1 && !state.rows.length && state.total > 0) {
      state.page -= 1;
      await loadRows();
      return;
    }

    updateFilterOptions();
    renderRows();
    writeUrlState();
  } catch (error) {
    if (requestId !== state.requestId) return;
    state.rows = [];
    state.total = 0;
    const view = errorView(error);
    setStatus(view.message, view.state);
  }
}

function addDetail(
  container: HTMLElement,
  label: string,
  value: string,
  tone?: string,
) {
  const group = element("div");
  const description = element("dd", undefined, value);
  if (tone) description.dataset.tone = tone;
  group.append(element("dt", undefined, label), description);
  container.append(group);
}

function addValidation(container: HTMLElement, message: string, tone: "success" | "warning") {
  const item = element("li", undefined, message);
  item.dataset.tone = tone;
  container.append(item);
}

function renderHistory(items: FinanceReviewHistoryItem[]) {
  const list = query<HTMLOListElement>("[data-review-history]");
  const status = query<HTMLElement>("[data-review-history-status]");
  if (!list || !status) return;

  list.replaceChildren();
  status.hidden = items.length > 0;
  status.textContent = items.length ? "" : "Nenhum evento registrado para esta linha.";

  const labels: Record<string, string> = {
    approve: "Registro aprovado",
    reject: "Registro rejeitado",
    classify_source: "Fonte reclassificada",
  };

  items.forEach((item) => {
    const entry = element("li");
    const header = element("div");
    header.append(
      element("strong", undefined, labels[item.event_type] ?? "Revisão atualizada"),
      element("time", undefined, formatDateTime(item.created_at)),
    );
    entry.append(
      header,
      element("p", undefined, item.reason),
      element("small", undefined, item.actor_id === state.userId ? "Você" : "Usuário autorizado"),
    );
    list.append(entry);
  });
}

async function openDetails(row: FinanceReviewRow) {
  state.selectedRow = row;

  const dialog = query<HTMLDialogElement>("[data-review-details-dialog]");
  const details = query<HTMLElement>("[data-review-details]");
  const trace = query<HTMLElement>("[data-review-trace]");
  const validations = query<HTMLUListElement>("[data-review-validations]");
  const title = query<HTMLElement>("[data-review-details-title]");
  const historyStatus = query<HTMLElement>("[data-review-history-status]");
  const historyList = query<HTMLOListElement>("[data-review-history]");

  if (!dialog || !details || !trace || !validations || !title || !historyStatus || !historyList) {
    return;
  }

  title.textContent = row.file_name;
  details.replaceChildren();
  trace.replaceChildren();
  validations.replaceChildren();

  addDetail(details, "Empresa autorizada", companyLabel(row));
  if (!row.company_id) addDetail(details, "Empresa informada", sourceCompanyLabel(row), "warning");
  addDetail(details, "Competência", formatPeriod(row.period_month));
  addDetail(details, "Métrica", formatMetric(row.metric));
  addDetail(details, "Valor", formatCurrency(row.amount, row.currency));
  addDetail(details, "Status", `${statusLabels[row.review_status]} · revisão ${row.review_revision}`);
  if (row.review_note) addDetail(details, "Justificativa da revisão", row.review_note);
  if (row.reviewed_at) addDetail(details, "Revisado em", formatDateTime(row.reviewed_at));

  addDetail(trace, "Documento", row.file_name);
  addDetail(trace, "ID do documento", row.document_id);
  addDetail(trace, "ETag da extração", row.source_etag ?? "Não informado");
  addDetail(trace, "Origem no XLSX", `${originLabel(row)} · linha ${row.source_row ?? "--"}`);
  addDetail(trace, "Extraído em", formatDateTime(row.created_at));
  addDetail(trace, "Classificação da fonte", roleLabels[row.source_usage_role]);

  addValidation(
    validations,
    row.source_version_current
      ? "A versão extraída coincide com a versão atual do documento."
      : "A versão do documento mudou; é necessária nova extração.",
    row.source_version_current ? "success" : "warning",
  );
  addValidation(
    validations,
    row.is_deleted
      ? "O documento de origem está marcado como excluído."
      : "O documento de origem está disponível.",
    row.is_deleted ? "warning" : "success",
  );
  addValidation(
    validations,
    row.company_id
      ? "O registro está vinculado a uma empresa retornada pela consulta autorizada."
      : "A empresa ainda não está vinculada; o nome extraído é apenas contexto.",
    row.company_id ? "success" : "warning",
  );
  addValidation(
    validations,
    row.source_usage_role === "primary"
      ? "O documento está classificado como fonte primária."
      : `Classificação atual: ${roleLabels[row.source_usage_role]}.`,
    row.source_usage_role === "primary" ? "success" : "warning",
  );

  historyList.replaceChildren();
  historyStatus.hidden = false;
  historyStatus.textContent = "Carregando histórico...";
  dialog.showModal();

  try {
    const history = await getFinanceReviewHistory(row.id);
    if (state.selectedRow?.id === row.id) renderHistory(history);
  } catch (error) {
    if (state.selectedRow?.id !== row.id) return;
    const view = errorView(error);
    historyStatus.textContent = view.state === "denied"
      ? "Histórico indisponível para esta sessão."
      : "Não foi possível carregar o histórico.";
  }
}

function applyFilters() {
  renderRows();
  writeUrlState();
}

function clearFilters() {
  state.company = "";
  state.document = "";
  state.period = "";
  state.origin = "";
  updateFilterOptions();
  renderRows();
  writeUrlState();
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>("[data-review-status]").forEach((tab) => {
    tab.addEventListener("click", () => {
      state.status = tab.dataset.reviewStatus as ReviewStatus;
      state.page = 1;
      updateTabs();
      void loadRows();
    });
  });

  query<HTMLSelectElement>("[data-review-company]")?.addEventListener("change", (event) => {
    state.company = (event.currentTarget as HTMLSelectElement).value;
    applyFilters();
  });
  query<HTMLInputElement>("[data-review-document]")?.addEventListener("input", (event) => {
    state.document = (event.currentTarget as HTMLInputElement).value;
    applyFilters();
  });
  query<HTMLSelectElement>("[data-review-period]")?.addEventListener("change", (event) => {
    state.period = (event.currentTarget as HTMLSelectElement).value;
    applyFilters();
  });
  query<HTMLSelectElement>("[data-review-origin]")?.addEventListener("change", (event) => {
    state.origin = (event.currentTarget as HTMLSelectElement).value;
    applyFilters();
  });

  query<HTMLButtonElement>("[data-review-refresh]")?.addEventListener("click", () => {
    void loadRows();
  });
  query<HTMLButtonElement>("[data-review-status-retry]")?.addEventListener("click", () => {
    void loadRows();
  });
  query<HTMLButtonElement>("[data-review-clear-filters]")?.addEventListener("click", clearFilters);
  query<HTMLButtonElement>("[data-review-empty-clear]")?.addEventListener("click", clearFilters);

  query<HTMLButtonElement>("[data-review-previous]")?.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    void loadRows();
  });
  query<HTMLButtonElement>("[data-review-next]")?.addEventListener("click", () => {
    if (state.page * PAGE_SIZE >= state.total) return;
    state.page += 1;
    void loadRows();
  });

  query<HTMLElement>("[data-financial-review-page]")?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const actionButton = target.closest<HTMLButtonElement>("[data-review-row-action]");
    if (!actionButton || actionButton.dataset.reviewRowAction !== "details") return;

    const row = state.rows.find((item) => item.id === actionButton.dataset.rowId);
    if (row) void openDetails(row);
  });

  query<HTMLButtonElement>("[data-review-details-close]")?.addEventListener("click", () => {
    query<HTMLDialogElement>("[data-review-details-dialog]")?.close();
  });
}

export async function loadFinancialReviewPage() {
  if (!query("[data-financial-review-page]")) return;

  readUrlState();
  updateBackLink();
  updateTabs();
  bindEvents();

  try {
    const session = await getCurrentSession();
    if (!session) {
      setStatus(
        "Entre na sua conta para acessar a revisão financeira.",
        "unauthenticated",
      );
      return;
    }

    state.userId = session.user.id;
    await loadRows();
  } catch {
    setStatus(
      "Não foi possível validar sua sessão. Entre novamente para continuar.",
      "unauthenticated",
    );
  }
}
