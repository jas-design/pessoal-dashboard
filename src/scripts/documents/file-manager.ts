import {
  createDocumentDownloadUrl,
  getDocuments,
  type DocumentCatalogItem,
} from "../../services/documents/catalog";

type SourceTab = "all" | "onedrive" | "uploads";
type FilterKey = "company" | "department" | "year" | "month" | "type" | "status";

interface FilterOption {
  value: string;
  label: string;
}

const statusLabels: Record<string, string> = {
  pending: "Pendente",
  processing: "Processando",
  processed: "Processado",
  completed: "Concluído",
  indexed: "Indexado",
  error: "Erro",
  failed: "Erro",
};

const monthLabels: Record<string, string> = {
  "1": "Jan",
  "2": "Fev",
  "3": "Mar",
  "4": "Abr",
  "5": "Mai",
  "6": "Jun",
  "7": "Jul",
  "8": "Ago",
  "9": "Set",
  "10": "Out",
  "11": "Nov",
  "12": "Dez",
};

let documents: DocumentCatalogItem[] = [];
// Temporary local folder tree until Microsoft Graph synchronization is implemented.
const expandedFolders = new Set(["root"]);
const state = {
  source: "all" as SourceTab,
  search: "",
  company: "",
  department: "",
  year: "",
  month: "",
  type: "",
  status: "",
};

function getElement<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function getMetadataText(item: DocumentCatalogItem, key: string) {
  const value = item.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function getCompanyValue(item: DocumentCatalogItem) {
  return item.company_id || getMetadataText(item, "company_id") || getMetadataText(item, "company");
}

function getCompanyLabel(item: DocumentCatalogItem) {
  return getMetadataText(item, "company_name") || getMetadataText(item, "company") || getCompanyValue(item);
}

function getDepartment(item: DocumentCatalogItem) {
  return item.department || item.subcategory || getMetadataText(item, "department");
}

function getYear(item: DocumentCatalogItem) {
  return item.period_year ?? getMetadataText(item, "period_year");
}

function getMonth(item: DocumentCatalogItem) {
  return item.period_month ?? getMetadataText(item, "period_month");
}

function getPath(item: DocumentCatalogItem) {
  return item.source_path || item.storage_path || getMetadataText(item, "path");
}

function isOneDriveDocument(item: DocumentCatalogItem) {
  const source = item.source.toLowerCase();
  const provider = item.provider?.toLowerCase() ?? "";

  return source === "onedrive" || provider === "onedrive";
}

function isUploadDocument(item: DocumentCatalogItem) {
  return item.source.toLowerCase() === "supabase";
}

function formatFileSize(size: number | null) {
  if (size === null) {
    return "Não informado";
  }

  if (size === 0) {
    return "0 B";
  }

  if (size < 1024 * 1024) {
    return `${Math.ceil(size / 1024)} KB`;
  }

  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string | null) {
  if (!value) {
    return "Não informado";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Não informado";
  }

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getModifiedDate(item: DocumentCatalogItem) {
  return item.source_updated_at ?? item.updated_at ?? item.source_created_at ?? item.created_at;
}

function getSourceLabel(item: DocumentCatalogItem) {
  if (isOneDriveDocument(item)) {
    return "OneDrive";
  }

  if (item.source === "google_drive") {
    return "Google Drive";
  }

  if (item.source === "supabase") {
    return "Uploads";
  }

  return item.source;
}

function getFileType(item: DocumentCatalogItem) {
  const mimeType = item.mime_type?.toLowerCase() ?? "";
  const extension = item.file_name.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType.includes("pdf") || extension === "pdf") {
    return "PDF";
  }

  if (mimeType.includes("spreadsheet") || ["xls", "xlsx", "csv"].includes(extension)) {
    return "Excel";
  }

  if (mimeType.includes("word") || ["doc", "docx"].includes(extension)) {
    return "Word";
  }

  if (mimeType.includes("zip") || extension === "zip") {
    return "ZIP";
  }

  return "Outro";
}

function getStatusLabel(item: DocumentCatalogItem) {
  const status = item.processing_status;

  if (!status) {
    return "Não informado";
  }

  return statusLabels[status] ?? status;
}

function getStatusClass(item: DocumentCatalogItem) {
  const status = item.processing_status ?? "";

  if (["processed", "completed", "indexed"].includes(status)) {
    return "is-success";
  }

  if (["error", "failed"].includes(status)) {
    return "is-error";
  }

  if (status === "processing") {
    return "is-processing";
  }

  return "is-pending";
}

function createCell(className: string, text: string) {
  const cell = document.createElement("td");
  cell.className = className;
  cell.textContent = text;
  return cell;
}

function createFileCell(item: DocumentCatalogItem) {
  const cell = document.createElement("td");
  const wrapper = document.createElement("div");
  const icon = document.createElement("span");
  const copy = document.createElement("span");
  const name = document.createElement("strong");
  const meta = document.createElement("small");

  wrapper.className = "documents-file-name";
  icon.className = "documents-file-name__icon";
  icon.textContent = getFileType(item).slice(0, 1);
  name.textContent = item.file_name;
  meta.textContent = item.mime_type ?? getFileType(item);

  copy.append(name, meta);
  wrapper.append(icon, copy);
  cell.append(wrapper);

  return cell;
}

function createCheckboxCell() {
  const cell = document.createElement("td");
  const checkbox = document.createElement("input");

  checkbox.type = "checkbox";
  checkbox.setAttribute("aria-label", "Selecionar documento");
  checkbox.dataset.documentsRowCheckbox = "true";
  cell.append(checkbox);

  return cell;
}

function createStatusCell(item: DocumentCatalogItem) {
  const cell = document.createElement("td");
  const badge = document.createElement("span");

  badge.className = `documents-status ${getStatusClass(item)}`;
  badge.textContent = getStatusLabel(item);
  cell.append(badge);

  return cell;
}

function showDocumentDetails(item: DocumentCatalogItem) {
  const dialog = getElement<HTMLDialogElement>("[data-documents-details-dialog]");
  const list = getElement<HTMLElement>("[data-documents-details-list]");

  if (!dialog || !list) {
    return;
  }

  const details = [
    ["Arquivo", item.file_name],
    ["Origem", getSourceLabel(item)],
    ["Tipo", getFileType(item)],
    ["Status", getStatusLabel(item)],
    ["Modificado em", formatDate(getModifiedDate(item))],
    ["Tamanho", formatFileSize(item.file_size)],
    ["Área/Departamento", getDepartment(item)],
    ["Caminho", getPath(item)],
  ].filter(([, value]) => value);

  list.replaceChildren(
    ...details.map(([label, value]) => {
      const row = document.createElement("div");
      const term = document.createElement("dt");
      const description = document.createElement("dd");

      term.textContent = label;
      description.textContent = String(value);
      row.append(term, description);

      return row;
    })
  );

  dialog.showModal();
}

function createActionsCell(item: DocumentCatalogItem) {
  const cell = document.createElement("td");
  const actions = document.createElement("div");
  const detailsButton = document.createElement("button");

  actions.className = "documents-actions";
  detailsButton.type = "button";
  detailsButton.className = "button-small";
  detailsButton.textContent = "Ver detalhes";
  detailsButton.addEventListener("click", () => showDocumentDetails(item));

  if (item.source === "supabase" && item.storage_bucket && item.storage_path) {
    const openButton = document.createElement("button");

    openButton.type = "button";
    openButton.className = "button-small";
    openButton.textContent = "Abrir";
    openButton.addEventListener("click", async () => {
      openButton.disabled = true;
      openButton.textContent = "Abrindo...";

      try {
        const signedUrl = await createDocumentDownloadUrl(item.storage_bucket!, item.storage_path!);
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error(error);
        window.alert(
          error instanceof Error ? error.message : "Não foi possível abrir o arquivo."
        );
      } finally {
        openButton.disabled = false;
        openButton.textContent = "Abrir";
      }
    });

    actions.append(openButton);
  }

  if (isOneDriveDocument(item)) {
    const webUrl = item.source_web_url || getMetadataText(item, "web_url");

    if (webUrl) {
      const link = document.createElement("a");
      link.className = "button-small";
      link.href = webUrl;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = "Abrir no OneDrive";
      actions.append(link);
    }
  }

  actions.append(detailsButton);
  cell.append(actions);

  return cell;
}

function createDocumentRow(item: DocumentCatalogItem) {
  const row = document.createElement("tr");

  row.append(
    createCheckboxCell(),
    createFileCell(item),
    createCell("documents-source", getSourceLabel(item)),
    createCell("documents-type", getFileType(item)),
    createCell("documents-date", formatDate(getModifiedDate(item))),
    createCell("documents-size", formatFileSize(item.file_size)),
    createStatusCell(item),
    createActionsCell(item)
  );

  return row;
}

function matchesSearch(item: DocumentCatalogItem) {
  if (!state.search) {
    return true;
  }

  const searchableText = [item.file_name, getDepartment(item), getPath(item)]
    .join(" ")
    .toLowerCase();

  return searchableText.includes(state.search);
}

function matchesFilters(item: DocumentCatalogItem) {
  if (state.source === "onedrive" && !isOneDriveDocument(item)) {
    return false;
  }

  if (state.source === "uploads" && !isUploadDocument(item)) {
    return false;
  }

  if (state.company && String(getCompanyValue(item)) !== state.company) {
    return false;
  }

  if (state.department && String(getDepartment(item)) !== state.department) {
    return false;
  }

  if (state.year && String(getYear(item)) !== state.year) {
    return false;
  }

  if (state.month && String(getMonth(item)) !== state.month) {
    return false;
  }

  if (state.type && getFileType(item) !== state.type) {
    return false;
  }

  if (state.status && item.processing_status !== state.status) {
    return false;
  }

  return true;
}

function getFilteredDocuments() {
  return documents.filter((item) => matchesFilters(item) && matchesSearch(item));
}

function setVisibility(selector: string, isVisible: boolean) {
  const element = getElement<HTMLElement>(selector);

  if (element) {
    element.hidden = !isVisible;
  }
}

function updateEmptyState() {
  const title = getElement<HTMLElement>("[data-documents-empty-title]");
  const message = getElement<HTMLElement>("[data-documents-empty-message]");
  const hasSearch = Boolean(state.search);
  const hasFilters = ["company", "department", "year", "month", "type", "status"].some((key) => state[key as FilterKey]);
  const hasOneDriveDocuments = documents.some(isOneDriveDocument);

  if (!title || !message) {
    return;
  }

  if (state.source === "onedrive" && !hasOneDriveDocuments) {
    title.textContent = "Nenhum arquivo do OneDrive sincronizado.";
    message.textContent = "A integração OneDrive será configurada depois.";
    return;
  }

  if (hasSearch) {
    title.textContent = "Nenhum documento encontrado.";
    message.textContent = "Tente buscar por outro nome de arquivo, pasta ou departamento.";
    return;
  }

  if (hasFilters) {
    title.textContent = "Nenhum documento encontrado.";
    message.textContent = "Limpe os filtros para ver a lista completa novamente.";
    return;
  }

  title.textContent = "Nenhum documento encontrado";
  message.textContent = "Os arquivos enviados pelo dashboard ou sincronizados futuramente aparecerão aqui.";
}

function applyFilters() {
  const tableBody = getElement<HTMLTableSectionElement>("[data-documents-table-body]");
  const selectAll = getElement<HTMLInputElement>("[data-documents-select-all]");
  const items = getFilteredDocuments();

  if (!tableBody) {
    return;
  }

  tableBody.replaceChildren(...items.map(createDocumentRow));
  if (selectAll) {
    selectAll.checked = false;
  }
  updateEmptyState();
  setVisibility("[data-documents-empty]", items.length === 0);
  setVisibility("[data-documents-table]", items.length > 0);
}

function getUniqueOptions(getValue: (item: DocumentCatalogItem) => string | number | null | undefined) {
  return Array.from(
    new Set(
      documents
        .map(getValue)
        .filter((value): value is string | number => value !== null && value !== undefined && value !== "")
        .map(String)
    )
  ).sort((current, next) => current.localeCompare(next, "pt-BR", { numeric: true }));
}

function getCompanyOptions() {
  const options = new Map<string, string>();

  documents.forEach((item) => {
    const value = getCompanyValue(item);

    if (value) {
      options.set(String(value), String(getCompanyLabel(item)));
    }
  });

  return Array.from(options, ([value, label]) => ({ value, label })).sort((current, next) =>
    current.label.localeCompare(next.label, "pt-BR", { numeric: true })
  );
}

function toOptions(values: string[], labels: Record<string, string> = {}) {
  return values.map((value) => ({
    value,
    label: labels[value] ?? value,
  }));
}

function fillSelect(key: FilterKey, options: FilterOption[]) {
  const select = getElement<HTMLSelectElement>(`[data-documents-filter="${key}"]`);
  const firstOption = select?.querySelector("option");

  if (!select || !firstOption) {
    return;
  }

  select.replaceChildren(firstOption);

  options.forEach((option) => {
    select.append(new Option(option.label, option.value));
  });
}

function fillFilters() {
  fillSelect("company", getCompanyOptions());
  fillSelect("department", toOptions(getUniqueOptions(getDepartment)));
  fillSelect("year", toOptions(getUniqueOptions(getYear).sort((current, next) => Number(next) - Number(current))));
  fillSelect("month", toOptions(getUniqueOptions(getMonth), monthLabels));
  fillSelect("type", toOptions(getUniqueOptions(getFileType)));
  fillSelect(
    "status",
    toOptions(getUniqueOptions((item) => item.processing_status), statusLabels)
  );
}

function bindFilters() {
  getElement<HTMLInputElement>("[data-documents-search]")?.addEventListener("input", (event) => {
    state.search = event.currentTarget instanceof HTMLInputElement ? event.currentTarget.value.trim().toLowerCase() : "";
    applyFilters();
  });

  document.querySelectorAll<HTMLSelectElement>("[data-documents-filter]").forEach((select) => {
    select.addEventListener("change", () => {
      const key = select.dataset.documentsFilter as FilterKey | undefined;

      if (key) {
        state[key] = select.value;
      }

      applyFilters();
    });
  });

  getElement<HTMLButtonElement>("[data-documents-clear-filters]")?.addEventListener("click", () => {
    const searchInput = getElement<HTMLInputElement>("[data-documents-search]");

    if (searchInput) {
      searchInput.value = "";
    }

    document.querySelectorAll<HTMLSelectElement>("[data-documents-filter]").forEach((select) => {
      select.value = "";
    });
    state.search = "";
    state.company = "";
    state.department = "";
    state.year = "";
    state.month = "";
    state.type = "";
    state.status = "";
    selectSource("all");
    applyFilters();
  });
}

function selectSource(source: SourceTab) {
  state.source = source;

  document.querySelectorAll<HTMLButtonElement>("[data-source-tab]").forEach((tab) => {
    const isActive = tab.dataset.sourceTab === source;
    tab.classList.toggle("is-active", isActive);
    tab.setAttribute("aria-selected", String(isActive));
  });
}

function bindSourceTabs() {
  document.querySelectorAll<HTMLButtonElement>("[data-source-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      selectSource((button.dataset.sourceTab as SourceTab | undefined) ?? "all");
      applyFilters();
    });
  });
}

function toggleFolder(folderId: string) {
  const button = getElement<HTMLButtonElement>(`[data-folder-id="${folderId}"]`);
  const childList = getElement<HTMLUListElement>(`[data-parent-id="${folderId}"]`);

  if (!button || !childList) {
    return;
  }

  if (expandedFolders.has(folderId)) {
    expandedFolders.delete(folderId);
  } else {
    expandedFolders.add(folderId);
  }

  const isExpanded = expandedFolders.has(folderId);

  childList.hidden = !isExpanded;
  button.classList.toggle("is-expanded", isExpanded);
  button.setAttribute("aria-expanded", String(isExpanded));
}

function formatFolderBreadcrumb(folderPath: string) {
  return folderPath
    .split("|")
    .map((part) => part.trim())
    .filter(Boolean)
    .join(" > ");
}

function bindFolderTree() {
  const breadcrumb = getElement<HTMLElement>("[data-documents-breadcrumb]");

  document.querySelectorAll<HTMLButtonElement>("[data-folder-path]").forEach((button) => {
    button.addEventListener("click", () => {
      const folderPath = button.dataset.folderPath ?? "Todas as pastas";
      const folderId = button.dataset.folderId;

      document.querySelectorAll<HTMLButtonElement>("[data-folder-path]").forEach((folder) => {
        folder.classList.toggle("is-active", folder === button);
      });

      if (button.hasAttribute("data-folder-toggle") && folderId) {
        toggleFolder(folderId);
      }

      if (breadcrumb) {
        breadcrumb.textContent = formatFolderBreadcrumb(folderPath);
      }
    });
  });
}

function bindSyncButton() {
  const button = getElement<HTMLButtonElement>("[data-documents-sync]");
  const note = getElement<HTMLElement>("[data-documents-sync-note]");

  button?.addEventListener("click", () => {
    if (note) {
      note.hidden = false;
    }
  });
}

function bindDetailsDialog() {
  const dialog = getElement<HTMLDialogElement>("[data-documents-details-dialog]");

  getElement<HTMLButtonElement>("[data-documents-details-close]")?.addEventListener("click", () => {
    dialog?.close();
  });
}

function bindSelection() {
  getElement<HTMLInputElement>("[data-documents-select-all]")?.addEventListener("change", (event) => {
    const checked = event.currentTarget instanceof HTMLInputElement && event.currentTarget.checked;

    document.querySelectorAll<HTMLInputElement>("[data-documents-row-checkbox]").forEach((checkbox) => {
      checkbox.checked = checked;
    });
  });
}

export async function loadDocumentsFileManager() {
  const loading = getElement<HTMLElement>("[data-documents-loading]");
  const errorMessage = getElement<HTMLElement>("[data-documents-error]");

  bindFilters();
  bindSourceTabs();
  bindFolderTree();
  bindSyncButton();
  bindDetailsDialog();
  bindSelection();

  try {
    documents = await getDocuments();
    fillFilters();
    applyFilters();
  } catch (error) {
    console.error(error);

    if (errorMessage) {
      errorMessage.hidden = false;
      errorMessage.textContent =
        error instanceof Error ? error.message : "Não foi possível carregar os documentos.";
    }
  } finally {
    if (loading) {
      loading.hidden = true;
    }
  }
}
