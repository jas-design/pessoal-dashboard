import supabase from "../../lib/supabase/browser";
import {
  initializeThemePreference,
  readThemePreference,
  setThemePreference,
  type ThemePreference,
} from "./theme";

type IntegrationStatus = "Conectado" | "Nao conectado" | "Configuracao pendente";
type DefaultFinancialPeriod = "current_month" | "latest_with_data";

interface SafeIntegration {
  id: string;
  name: string | null;
  provider: string | null;
  status: string | null;
  is_active: boolean | null;
  last_sync_at: string | null;
}

interface Profile {
  id: string;
  full_name: string | null;
  email: string | null;
  role: string | null;
  status: string | null;
  updated_at: string | null;
}

interface UserPreference {
  theme: ThemePreference | null;
  default_company_id: string | null;
  default_financial_period: DefaultFinancialPeriod | null;
  updated_at: string | null;
}

interface Company {
  id: string;
  name: string | null;
  legal_name: string | null;
  status: string | null;
  updated_at: string | null;
}

const periodPreferenceStorageKey = "dashboard-default-financial-period";
const defaultFinancialPeriod: DefaultFinancialPeriod = "current_month";

const state = {
  userId: null as string | null,
  preferences: null as UserPreference | null,
  supportsUserPreferences: false,
  supportsDefaultFinancialPeriod: false,
  supportsDefaultCompany: false,
};

function isThemePreference(value: string | null | undefined): value is ThemePreference {
  return value === "system" || value === "light" || value === "dark";
}

function isDefaultFinancialPeriod(
  value: string | null | undefined
): value is DefaultFinancialPeriod {
  return value === "current_month" || value === "latest_with_data";
}

function formatDateTime(value: string | null | undefined) {
  if (!value) {
    return "Nao informado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Nao informado";
  }

  return date.toLocaleString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function normalizeProfileRole(value: string | null | undefined) {
  const role = value?.toLowerCase();

  if (role === "admin") {
    return "Administrador";
  }

  if (role === "user") {
    return "Usuario";
  }

  return value || "Nao informado";
}

function normalizeProfileStatus(value: string | null | undefined) {
  const status = value?.toLowerCase();

  if (status === "active") {
    return "Ativo";
  }

  if (status === "inactive") {
    return "Inativo";
  }

  if (status === "pending") {
    return "Pendente";
  }

  return value || "Nao informado";
}

function setValue(key: string, value: string) {
  document.querySelectorAll<HTMLElement>(`[data-settings-value="${key}"]`).forEach(
    (element) => {
      element.textContent = value;
    }
  );
}

function setPreferenceStatus(message: string, stateName: "neutral" | "success" | "error") {
  const element = document.querySelector<HTMLElement>("[data-preference-status]");

  if (!element) {
    return;
  }

  element.textContent = message;
  element.dataset.state = stateName;
}

function setBadge(key: string, status: IntegrationStatus) {
  const element = document.querySelector<HTMLElement>(`[data-settings-status="${key}"]`);

  if (!element) {
    return;
  }

  element.textContent = status;
  element.dataset.state =
    status === "Conectado"
      ? "connected"
      : status === "Nao conectado"
        ? "disconnected"
        : "pending";
}

function readStoredPeriodPreference(): DefaultFinancialPeriod {
  const saved = localStorage.getItem(periodPreferenceStorageKey);

  return isDefaultFinancialPeriod(saved) ? saved : defaultFinancialPeriod;
}

function writeStoredPeriodPreference(value: DefaultFinancialPeriod) {
  localStorage.setItem(periodPreferenceStorageKey, value);
}

async function getCurrentProfile(): Promise<Profile | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();

  if (!session?.user) {
    return null;
  }

  state.userId = session.user.id;

  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, role, status, updated_at")
    .eq("id", session.user.id)
    .maybeSingle();

  if (error) {
    return {
      id: session.user.id,
      full_name: session.user.user_metadata?.full_name ?? null,
      email: session.user.email ?? null,
      role: null,
      status: null,
      updated_at: null,
    };
  }

  return data as Profile | null;
}

async function getUserPreference(): Promise<UserPreference | null> {
  if (!state.userId) {
    return null;
  }

  const { data, error } = await supabase
    .from("user_preferences")
    .select("theme, updated_at")
    .eq("user_id", state.userId)
    .maybeSingle();

  if (error) {
    state.supportsUserPreferences = false;
    state.supportsDefaultCompany = false;
    return null;
  }

  state.supportsUserPreferences = true;

  const basePreference = data as Pick<UserPreference, "theme" | "updated_at"> | null;
  const preference: UserPreference = {
    theme: isThemePreference(basePreference?.theme) ? basePreference.theme : null,
    default_company_id: null,
    default_financial_period: null,
    updated_at: basePreference?.updated_at ?? null,
  };

  const { data: periodData, error: periodError } = await supabase
    .from("user_preferences")
    .select("default_financial_period, updated_at")
    .eq("user_id", state.userId)
    .maybeSingle();

  state.supportsDefaultFinancialPeriod = !periodError;

  if (!periodError) {
    const periodPreference = periodData as Pick<
      UserPreference,
      "default_financial_period" | "updated_at"
    > | null;

    preference.default_financial_period = isDefaultFinancialPeriod(
      periodPreference?.default_financial_period
    )
      ? periodPreference.default_financial_period
      : null;
    preference.updated_at = periodPreference?.updated_at ?? preference.updated_at;
  }

  const { data: companyData, error: companyError } = await supabase
    .from("user_preferences")
    .select("default_company_id, updated_at")
    .eq("user_id", state.userId)
    .maybeSingle();

  state.supportsDefaultCompany = !companyError;

  if (!companyError) {
    const companyPreference = companyData as Pick<
      UserPreference,
      "default_company_id" | "updated_at"
    > | null;

    preference.default_company_id = companyPreference?.default_company_id ?? null;
    preference.updated_at = companyPreference?.updated_at ?? preference.updated_at;
  }

  return preference;
}

async function getCompanies(): Promise<Company[] | null> {
  const { data, error } = await supabase
    .from("companies")
    .select("id, name, legal_name, status, updated_at")
    .order("name", { ascending: true });

  if (error) {
    return null;
  }

  return (data ?? []) as Company[];
}

async function getSafeIntegrations(): Promise<SafeIntegration[] | null> {
  const { data, error } = await supabase
    .from("integrations")
    .select("id, name, provider, status, is_active, last_sync_at")
    .order("created_at", { ascending: true });

  if (error) {
    return null;
  }

  return (data ?? []) as SafeIntegration[];
}

function renderProfile(profile: Profile | null) {
  setValue("profile_name", profile?.full_name || "Nao informado");
  setValue("profile_email", profile?.email || "Nao informado");
  setValue("profile_role", normalizeProfileRole(profile?.role));
  setValue("profile_status", normalizeProfileStatus(profile?.status));
  setValue("profile_updated_at", formatDateTime(profile?.updated_at));
  setValue("auth_status", profile ? "Sessao autenticada" : "Sessao nao encontrada");
}

function renderCompanies(companies: Company[] | null) {
  const body = document.querySelector<HTMLTableSectionElement>("[data-settings-companies-body]");
  const empty = document.querySelector<HTMLElement>("[data-settings-companies-empty]");

  if (!body || !empty) {
    return;
  }

  body.replaceChildren();

  if (!companies?.length) {
    empty.hidden = false;
    return;
  }

  empty.hidden = true;
  body.replaceChildren(
    ...companies.map((company) => {
      const row = document.createElement("tr");
      const name = document.createElement("td");
      const legalName = document.createElement("td");
      const status = document.createElement("td");
      const updatedAt = document.createElement("td");

      name.textContent = company.name || "Nao informado";
      legalName.textContent = company.legal_name || "Nao informado";
      status.textContent = normalizeProfileStatus(company.status);
      updatedAt.textContent = formatDateTime(company.updated_at);
      row.append(name, legalName, status, updatedAt);

      return row;
    })
  );
}

function findIntegration(integrations: SafeIntegration[] | null, names: string[]) {
  return integrations?.find((integration) => {
    const searchable = [integration.name, integration.provider].join(" ").toLowerCase();

    return names.some((name) => searchable.includes(name));
  });
}

function getIntegrationStatus(integration: SafeIntegration | undefined): IntegrationStatus {
  if (!integration) {
    return "Configuracao pendente";
  }

  if (integration.is_active || integration.status === "connected") {
    return "Conectado";
  }

  if (integration.status === "disconnected") {
    return "Nao conectado";
  }

  return "Configuracao pendente";
}

function renderIntegrations(integrations: SafeIntegration[] | null) {
  setBadge("supabase", "Conectado");
  setValue("integration_supabase_detail", "Autenticacao e banco de dados ativos via Supabase.");

  const n8n = findIntegration(integrations, ["n8n"]);
  const onedrive = findIntegration(integrations, ["onedrive", "one drive", "microsoft"]);

  setBadge("n8n", getIntegrationStatus(n8n));
  setValue(
    "integration_n8n_detail",
    n8n ? `Ultima sincronizacao: ${formatDateTime(n8n.last_sync_at)}` : "Aguardando configuracao."
  );
  setBadge("onedrive", getIntegrationStatus(onedrive));
  setValue(
    "integration_onedrive_detail",
    onedrive
      ? `Ultima sincronizacao: ${formatDateTime(onedrive.last_sync_at)}`
      : "Conexao sera ativada em uma etapa futura."
  );
}

function fillDefaultCompanySelect(companies: Company[] | null) {
  const group = document.querySelector<HTMLElement>("[data-preference-company-group]");
  const select = document.querySelector<HTMLSelectElement>("[data-preference-company]");

  if (!group || !select) {
    return;
  }

  const canUseDefaultCompany =
    state.supportsDefaultCompany && Boolean(companies?.length);

  group.hidden = !canUseDefaultCompany;

  if (!canUseDefaultCompany) {
    return;
  }

  select.replaceChildren(new Option("Nenhuma empresa padrao", ""));

  companies?.forEach((company) => {
    select.append(new Option(company.name || company.legal_name || "Empresa sem nome", company.id));
  });

  select.value = state.preferences?.default_company_id ?? "";
}

function renderPreferenceForm(preference: UserPreference | null, companies: Company[] | null) {
  const themeSelect = document.querySelector<HTMLSelectElement>("[data-preference-theme]");
  const periodSelect = document.querySelector<HTMLSelectElement>("[data-preference-period]");

  state.preferences = preference;

  if (themeSelect) {
    themeSelect.value = preference?.theme ?? readThemePreference();
  }

  if (preference?.theme) {
    setThemePreference(preference.theme);
  }

  if (periodSelect) {
    periodSelect.value =
      preference?.default_financial_period ?? readStoredPeriodPreference();
  }

  fillDefaultCompanySelect(companies);

  if (state.supportsUserPreferences) {
    setPreferenceStatus("Preferencias prontas para sincronizar com sua conta.", "neutral");
    return;
  }

  setPreferenceStatus(
    "Tema e periodo serao salvos neste navegador ate a sincronizacao da conta estar disponivel.",
    "neutral"
  );
}

function readPreferenceForm() {
  const themeSelect = document.querySelector<HTMLSelectElement>("[data-preference-theme]");
  const periodSelect = document.querySelector<HTMLSelectElement>("[data-preference-period]");
  const companySelect = document.querySelector<HTMLSelectElement>("[data-preference-company]");

  const theme = isThemePreference(themeSelect?.value) ? themeSelect.value : "system";
  const defaultFinancialPeriod = isDefaultFinancialPeriod(periodSelect?.value)
    ? periodSelect.value
    : "current_month";
  const defaultCompanyId =
    state.supportsDefaultCompany && companySelect && !companySelect.closest("[hidden]")
      ? companySelect.value || null
      : null;

  return { theme, defaultFinancialPeriod, defaultCompanyId };
}

async function savePreferences() {
  const values = readPreferenceForm();

  setThemePreference(values.theme);
  writeStoredPeriodPreference(values.defaultFinancialPeriod);

  if (!state.userId || !state.supportsUserPreferences) {
    setPreferenceStatus("Preferencias salvas neste navegador.", "success");
    return;
  }

  const payload: Record<string, string | null> = {
    user_id: state.userId,
    theme: values.theme,
    updated_at: new Date().toISOString(),
  };

  if (state.supportsDefaultFinancialPeriod) {
    payload.default_financial_period = values.defaultFinancialPeriod;
  }

  if (state.supportsDefaultCompany) {
    payload.default_company_id = values.defaultCompanyId;
  }

  const { error } = await supabase
    .from("user_preferences")
    .upsert(payload, { onConflict: "user_id" });

  if (error) {
    setPreferenceStatus(
      "Nao foi possivel sincronizar com a conta. As preferencias foram salvas neste navegador.",
      "error"
    );
    return;
  }

  setPreferenceStatus(
    state.supportsDefaultFinancialPeriod
      ? "Preferencias salvas na sua conta."
      : "Tema salvo na sua conta. Periodo salvo neste navegador.",
    "success"
  );
}

function bindPreferenceForm() {
  const form = document.querySelector<HTMLFormElement>("[data-preference-form]");
  const themeSelect = document.querySelector<HTMLSelectElement>("[data-preference-theme]");

  themeSelect?.addEventListener("change", () => {
    const value = isThemePreference(themeSelect.value) ? themeSelect.value : "system";

    setThemePreference(value);
  });

  window.addEventListener("dashboard-theme-change", (event) => {
    if (!(event instanceof CustomEvent) || !themeSelect) {
      return;
    }

    if (isThemePreference(event.detail?.preference)) {
      themeSelect.value = event.detail.preference;
    }
  });

  form?.addEventListener("submit", async (event) => {
    event.preventDefault();
    await savePreferences();
  });
}

export async function loadSettingsPage() {
  initializeThemePreference();

  const [profile, companies, integrations] = await Promise.all([
    getCurrentProfile(),
    getCompanies(),
    getSafeIntegrations(),
  ]);
  const preference = await getUserPreference();

  renderProfile(profile);
  renderCompanies(companies);
  renderIntegrations(integrations);
  renderPreferenceForm(preference, companies);
  bindPreferenceForm();
}
