import {
  createDocumentDownloadUrl,
  getDocumentFilterItems,
  getDocumentsPage,
  getOneDriveFolders,
  type DocumentCatalogItem,
  type DocumentFilterItem,
  type DocumentSourceFilter,
  type OneDriveFolder,
} from "../../services/documents/catalog";

type FilterKey = "company" | "department" | "year" | "month" | "type" | "status";

interface FilterOption {
  value: string;
  label: string;
}

const PAGE_SIZE = 50;

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
let filterItems: DocumentFilterItem[] = [];
let folders: OneDriveFolder[] = [];
let documentRequestId = 0;
let searchTimer: number | undefined;
let searchIsComposing = false;

const foldersByKey = new Map<string, OneDriveFolder>();
const childFoldersByParentKey = new Map<string, OneDriveFolder[]>();
const expandedFolders = new Set<string>();

const state = {
  source: "all" as DocumentSourceFilter,
  search: "",
  company: "",
  department: "",
  year: "",
  month: "",
  type: "",
  status: "",
  page: 1,
  total: 0,
  selectedFolderKey: null as string | null,
};

function getElement<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function setVisibility(selector: string, isVisible: boolean) {
  const element = getElement<HTMLElement>(selector);

  if (element) {
    element.hidden = !isVisible;
  }
}

function getMetadataText(
  item: DocumentCatalogItem | DocumentFilterItem,
  key: string
) {
  const value = item.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function getCompanyValue(item: DocumentCatalogItem | DocumentFilterItem) {
  return item.company_id ?? "";
}

function getCompanyLabel(item: DocumentCatalogItem | DocumentFilterItem) {
  return (
    getMetadataText(item, "company_name") ||
    getMetadataText(item, "company") ||
    getCompanyValue(item)
  );
}

function getDepartment(item: DocumentCatalogItem | DocumentFilterItem) {
  const subcategory = "subcategory" in item ? item.subcategory : null;
  return item.department || subcategory || getMetadataText(item, "department");
}

function getYear(item: DocumentCatalogItem | DocumentFilterItem) {
  return item.period_year ?? getMetadataText(item, "period_year");
}

function getMonth(item: DocumentCatalogItem | DocumentFilterItem) {
  return item.period_month ?? getMetadataText(item, "period_month");
}

function getPath(item: DocumentCatalogItem) {
  return item.source_path || item.storage_path || getMetadataText(item, "path");
}

function isOneDriveDocument(
  item: Pick<DocumentCatalogItem, "source" | "provider">
) {
  const source = item.source.toLowerCase();
  const provider = item.provider?.toLowerCase() ?? "";
  return source === "onedrive" || provider === "onedrive";
}

function formatFileSize(size: number | null) {
  if (size === null) return "Não informado";
  if (size === 0) return "0 B";
  if (size < 1024 * 1024) return `${Math.ceil(size / 1024)} KB`;
  return `${(size / 1024 / 1024).toFixed(2)} MB`;
}

function formatDate(value: string | null) {
  if (!value) return "Não informado";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Não informado";

  return date.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function getModifiedDate(item: DocumentCatalogItem) {
  if (isOneDriveDocument(item)) {
    return (
      item.source_modified_at ??
      item.source_updated_at ??
      item.source_created_at ??
      item.created_at
    );
  }

  return (
    item.source_modified_at ??
    item.source_updated_at ??
    item.updated_at ??
    item.source_created_at ??
    item.created_at
  );
}

function getSourceLabel(item: DocumentCatalogItem) {
  if (isOneDriveDocument(item)) return "OneDrive";
  if (item.source === "google_drive") return "Google Drive";
  if (item.source === "supabase") return "Uploads";
  return item.source;
}

function getFileType(
  item: Pick<DocumentCatalogItem | DocumentFilterItem, "file_name" | "mime_type">
) {
  const mimeType = item.mime_type?.toLowerCase() ?? "";
  const extension = item.file_name.split(".").pop()?.toLowerCase() ?? "";

  if (mimeType.includes("pdf") || extension === "pdf") return "PDF";
  if (
    mimeType.includes("spreadsheet") ||
    mimeType.includes("excel") ||
    mimeType.includes("csv") ||
    ["xls", "xlsx", "csv"].includes(extension)
  ) {
    return "Excel";
  }
  if (mimeType.includes("word") || ["doc", "docx"].includes(extension)) {
    return "Word";
  }
  if (mimeType.includes("zip") || extension === "zip") return "ZIP";
  return "Outro";
}

function getStatusLabel(item: DocumentCatalogItem) {
  const status = item.processing_status;
  return status ? statusLabels[status] ?? status : "Não informado";
}

function getStatusClass(item: DocumentCatalogItem) {
  const status = item.processing_status ?? "";

  if (["processed", "completed", "indexed"].includes(status)) return "is-success";
  if (["error", "failed"].includes(status)) return "is-error";
  if (status === "processing") return "is-processing";
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

  if (!dialog || !list) return;

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

function showDocumentsError(message: string) {
  const error = getElement<HTMLElement>("[data-documents-error]");
  const errorMessage = getElement<HTMLElement>("[data-documents-error-message]");

  if (errorMessage) errorMessage.textContent = message;
  if (error) error.hidden = false;
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

      try {
        const signedUrl = await createDocumentDownloadUrl(
          item.storage_bucket!,
          item.storage_path!
        );
        window.open(signedUrl, "_blank", "noopener,noreferrer");
      } catch (error) {
        console.error(error);
        showDocumentsError(
          error instanceof Error
            ? error.message
            : "Não foi possível abrir o arquivo."
        );
      } finally {
        openButton.disabled = false;
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

function hasActiveFilters() {
  return ["company", "department", "year", "month", "type", "status"].some(
    (key) => state[key as FilterKey]
  );
}

function updateEmptyState() {
  const title = getElement<HTMLElement>("[data-documents-empty-title]");
  const message = getElement<HTMLElement>("[data-documents-empty-message]");

  if (!title || !message) return;

  if (state.selectedFolderKey) {
    title.textContent = "Nenhum documento nesta pasta.";
    message.textContent =
      "Selecione outra pasta ou limpe os filtros para continuar.";
    return;
  }

  if (state.search) {
    title.textContent = "Nenhum documento encontrado.";
    message.textContent =
      "Tente buscar por outro nome de arquivo, pasta ou departamento.";
    return;
  }

  if (hasActiveFilters()) {
    title.textContent = "Nenhum documento encontrado.";
    message.textContent =
      "Limpe os filtros para ver a lista completa novamente.";
    return;
  }

  if (state.source === "onedrive") {
    title.textContent = "Nenhum arquivo do OneDrive encontrado.";
    message.textContent =
      "Selecione outra pasta ou verifique a sincronização do OneDrive.";
    return;
  }

  if (state.source === "uploads") {
    title.textContent = "Nenhum upload privado encontrado.";
    message.textContent =
      "Use “Enviar arquivos” para adicionar um documento privado.";
    return;
  }

  title.textContent = "Nenhum documento encontrado";
  message.textContent =
    "Os arquivos enviados ou sincronizados com o OneDrive aparecerão aqui.";
}

function updatePagination() {
  const pagination = getElement<HTMLElement>("[data-documents-pagination]");
  const summary = getElement<HTMLElement>("[data-documents-page-summary]");
  const pageLabel = getElement<HTMLElement>("[data-documents-page-label]");
  const previous = getElement<HTMLButtonElement>(
    "[data-documents-page-previous]"
  );
  const next = getElement<HTMLButtonElement>("[data-documents-page-next]");
  const totalPages = Math.max(1, Math.ceil(state.total / PAGE_SIZE));

  if (!pagination || !summary || !pageLabel || !previous || !next) return;

  pagination.hidden = state.total === 0;
  if (state.total === 0) return;

  const first = (state.page - 1) * PAGE_SIZE + 1;
  const last = Math.min(state.page * PAGE_SIZE, state.total);

  summary.textContent = `${first}–${last} de ${state.total} documentos`;
  pageLabel.textContent = `Página ${state.page} de ${totalPages}`;
  previous.disabled = state.page <= 1;
  next.disabled = state.page >= totalPages;
}

function renderDocuments() {
  const tableBody = getElement<HTMLTableSectionElement>(
    "[data-documents-table-body]"
  );
  const selectAll = getElement<HTMLInputElement>("[data-documents-select-all]");

  if (!tableBody) return;

  tableBody.replaceChildren(...documents.map(createDocumentRow));
  if (selectAll) selectAll.checked = false;

  updateEmptyState();
  updatePagination();
  setVisibility("[data-documents-empty]", documents.length === 0);
  setVisibility("[data-documents-table]", documents.length > 0);
}

async function loadDocumentsPage() {
  const requestId = ++documentRequestId;
  const loading = getElement<HTMLElement>("[data-documents-loading]");
  const error = getElement<HTMLElement>("[data-documents-error]");
  const previous = getElement<HTMLButtonElement>(
    "[data-documents-page-previous]"
  );
  const next = getElement<HTMLButtonElement>("[data-documents-page-next]");
  const selectedFolder = state.selectedFolderKey
    ? foldersByKey.get(state.selectedFolderKey)
    : null;

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;
  if (previous) previous.disabled = true;
  if (next) next.disabled = true;

  try {
    const result = await getDocumentsPage({
      page: state.page,
      pageSize: PAGE_SIZE,
      source: state.source,
      search: state.search,
      companyId: state.company,
      department: state.department,
      year: state.year,
      month: state.month,
      fileType: state.type,
      processingStatus: state.status,
      externalFolderId: selectedFolder?.external_folder_id,
      externalDriveId: selectedFolder?.external_drive_id,
    });

    if (requestId !== documentRequestId) return;

    documents = result.items;
    state.total = result.total;
    renderDocuments();
  } catch (error) {
    if (requestId !== documentRequestId) return;

    console.error(error);
    documents = [];
    state.total = 0;
    setVisibility("[data-documents-empty]", false);
    setVisibility("[data-documents-table]", false);
    setVisibility("[data-documents-pagination]", false);
    showDocumentsError(
      error instanceof Error
        ? error.message
        : "Não foi possível carregar os documentos."
    );
  } finally {
    if (requestId === documentRequestId && loading) {
      loading.hidden = true;
    }
  }
}

function getUniqueOptions(
  getValue: (item: DocumentFilterItem) => string | number | null | undefined
) {
  return Array.from(
    new Set(
      filterItems
        .map(getValue)
        .filter(
          (value): value is string | number =>
            value !== null && value !== undefined && value !== ""
        )
        .map(String)
    )
  ).sort((current, next) =>
    current.localeCompare(next, "pt-BR", { numeric: true })
  );
}

function getCompanyOptions() {
  const options = new Map<string, string>();

  filterItems.forEach((item) => {
    const value = getCompanyValue(item);
    if (value) options.set(String(value), String(getCompanyLabel(item)));
  });

  return Array.from(options, ([value, label]) => ({ value, label })).sort(
    (current, next) =>
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
  const select = getElement<HTMLSelectElement>(
    `[data-documents-filter="${key}"]`
  );
  const firstOption = select?.querySelector("option");

  if (!select || !firstOption) return;

  const currentValue = select.value;
  select.replaceChildren(firstOption);

  options.forEach((option) => {
    select.append(new Option(option.label, option.value));
  });

  select.value = currentValue;
}

function fillFilters() {
  fillSelect("company", getCompanyOptions());
  fillSelect("department", toOptions(getUniqueOptions(getDepartment)));
  fillSelect(
    "year",
    toOptions(
      getUniqueOptions(getYear).sort(
        (current, next) => Number(next) - Number(current)
      )
    )
  );
  fillSelect("month", toOptions(getUniqueOptions(getMonth), monthLabels));
  fillSelect("type", toOptions(getUniqueOptions(getFileType)));
  fillSelect(
    "status",
    toOptions(
      getUniqueOptions((item) => item.processing_status),
      statusLabels
    )
  );
}

async function loadFilterOptions() {
  try {
    filterItems = await getDocumentFilterItems();
    fillFilters();
  } catch (error) {
    console.error(error);
  }
}

function folderKey(driveId: string, folderId: string) {
  return `${encodeURIComponent(driveId)}::${encodeURIComponent(folderId)}`;
}

function getFolderKey(folder: OneDriveFolder) {
  return folderKey(folder.external_drive_id, folder.external_folder_id);
}

function getFolderParentKey(folder: OneDriveFolder) {
  return folder.external_parent_id
    ? folderKey(folder.external_drive_id, folder.external_parent_id)
    : null;
}

function sortFolders(items: OneDriveFolder[]) {
  return items.sort((current, next) =>
    current.folder_name.localeCompare(next.folder_name, "pt-BR", {
      numeric: true,
    })
  );
}

function indexFolders() {
  foldersByKey.clear();
  childFoldersByParentKey.clear();

  folders.forEach((folder) => {
    foldersByKey.set(getFolderKey(folder), folder);
  });

  folders.forEach((folder) => {
    const parentKey = getFolderParentKey(folder);
    if (!parentKey || !foldersByKey.has(parentKey)) return;

    const children = childFoldersByParentKey.get(parentKey) ?? [];
    children.push(folder);
    childFoldersByParentKey.set(parentKey, children);
  });

  childFoldersByParentKey.forEach(sortFolders);
}

function getRootFolders() {
  return sortFolders(
    folders.filter((folder) => {
      const parentKey = getFolderParentKey(folder);
      return !parentKey || !foldersByKey.has(parentKey);
    })
  );
}

function createFolderNode(folder: OneDriveFolder) {
  const key = getFolderKey(folder);
  const children = childFoldersByParentKey.get(key) ?? [];
  const item = document.createElement("li");
  const button = document.createElement("button");
  const arrow = document.createElement("span");
  const label = document.createElement("span");

  button.type = "button";
  button.dataset.folderKey = key;
  button.classList.toggle("is-active", state.selectedFolderKey === key);
  arrow.setAttribute("aria-hidden", "true");
  arrow.textContent = children.length ? "›" : "";
  arrow.className = children.length ? "" : "documents-folder-spacer";
  label.textContent = folder.folder_name;
  label.className = "documents-folder-label";
  button.append(arrow, label);

  if (children.length) {
    const childList = document.createElement("ul");
    const isExpanded = expandedFolders.has(key);

    button.dataset.folderToggle = "true";
    button.setAttribute("aria-expanded", String(isExpanded));
    button.classList.toggle("is-expanded", isExpanded);
    childList.dataset.folderChildren = key;
    childList.hidden = !isExpanded;

    if (isExpanded) {
      childList.replaceChildren(...children.map(createFolderNode));
      childList.dataset.rendered = "true";
    }

    item.append(button, childList);
  } else {
    item.append(button);
  }

  return item;
}

function createAllFoldersNode() {
  const item = document.createElement("li");
  const button = document.createElement("button");
  const spacer = document.createElement("span");
  const label = document.createElement("span");

  button.type = "button";
  button.dataset.folderAll = "true";
  button.classList.toggle("is-active", state.selectedFolderKey === null);
  spacer.className = "documents-folder-spacer";
  spacer.setAttribute("aria-hidden", "true");
  label.className = "documents-folder-label";
  label.textContent = "Todas as pastas";
  button.append(spacer, label);
  item.append(button);
  return item;
}

function renderFolderTree() {
  const root = getElement<HTMLUListElement>("[data-documents-folder-root]");
  const empty = getElement<HTMLElement>("[data-documents-folders-empty]");

  if (!root || !empty) return;

  const rootFolders = getRootFolders();
  root.replaceChildren(
    createAllFoldersNode(),
    ...rootFolders.map(createFolderNode)
  );
  root.hidden = false;
  empty.hidden = folders.length > 0;
}

function updateTreeSelection() {
  document
    .querySelectorAll<HTMLButtonElement>(
      "[data-folder-key], [data-folder-all]"
    )
    .forEach((button) => {
      const isAll = button.hasAttribute("data-folder-all");
      const isActive = isAll
        ? state.selectedFolderKey === null
        : button.dataset.folderKey === state.selectedFolderKey;
      button.classList.toggle("is-active", isActive);
    });
}

function updateBreadcrumb(folder?: OneDriveFolder) {
  const breadcrumb = getElement<HTMLElement>("[data-documents-breadcrumb]");
  if (!breadcrumb) return;

  if (!folder) {
    breadcrumb.textContent = "Todas as pastas";
    return;
  }

  const path = [folder.folder_name];
  const visited = new Set<string>([getFolderKey(folder)]);
  let current = folder;

  while (current.external_parent_id) {
    const parentKey = folderKey(
      current.external_drive_id,
      current.external_parent_id
    );
    const parent = foldersByKey.get(parentKey);

    if (!parent || visited.has(parentKey)) break;
    visited.add(parentKey);
    path.unshift(parent.folder_name);
    current = parent;
  }

  breadcrumb.textContent = ["OneDrive", ...path].join(" > ");
}

function selectSource(source: DocumentSourceFilter) {
  state.source = source;

  document
    .querySelectorAll<HTMLButtonElement>("[data-source-tab]")
    .forEach((tab) => {
      const isActive = tab.dataset.sourceTab === source;
      tab.classList.toggle("is-active", isActive);
      tab.setAttribute("aria-selected", String(isActive));
    });
}

function clearFolderSelection() {
  state.selectedFolderKey = null;
  updateBreadcrumb();
  updateTreeSelection();
}

function selectFolder(folder: OneDriveFolder) {
  state.selectedFolderKey = getFolderKey(folder);
  state.page = 1;
  selectSource("onedrive");
  updateBreadcrumb(folder);
  updateTreeSelection();
  void loadDocumentsPage();
}

function toggleFolder(button: HTMLButtonElement, key: string) {
  const childList = button.parentElement?.querySelector<HTMLUListElement>(
    ":scope > [data-folder-children]"
  );
  const children = childFoldersByParentKey.get(key) ?? [];

  if (!childList || children.length === 0) return;

  const isExpanded = !expandedFolders.has(key);
  if (isExpanded) {
    expandedFolders.add(key);
  } else {
    expandedFolders.delete(key);
  }

  if (isExpanded && childList.dataset.rendered !== "true") {
    childList.replaceChildren(...children.map(createFolderNode));
    childList.dataset.rendered = "true";
  }

  childList.hidden = !isExpanded;
  button.classList.toggle("is-expanded", isExpanded);
  button.setAttribute("aria-expanded", String(isExpanded));
}

function bindFolderTree() {
  const tree = getElement<HTMLElement>("[data-documents-folder-tree]");

  tree?.addEventListener("click", (event) => {
    const target = event.target;
    if (!(target instanceof Element)) return;

    const button = target.closest<HTMLButtonElement>(
      "[data-folder-key], [data-folder-all]"
    );
    if (!button) return;

    if (button.hasAttribute("data-folder-all")) {
      clearFolderSelection();
      selectSource("all");
      state.page = 1;
      void loadDocumentsPage();
      return;
    }

    const key = button.dataset.folderKey;
    const folder = key ? foldersByKey.get(key) : null;
    if (!key || !folder) return;

    selectFolder(folder);
    if (button.hasAttribute("data-folder-toggle")) {
      toggleFolder(button, key);
    }
  });
}

async function loadFolders() {
  const loading = getElement<HTMLElement>("[data-documents-folders-loading]");
  const error = getElement<HTMLElement>("[data-documents-folders-error]");
  const errorMessage = getElement<HTMLElement>(
    "[data-documents-folders-error-message]"
  );
  const root = getElement<HTMLElement>("[data-documents-folder-root]");

  if (loading) loading.hidden = false;
  if (error) error.hidden = true;
  if (root) root.hidden = true;

  try {
    folders = await getOneDriveFolders();
    indexFolders();
    renderFolderTree();
  } catch (caughtError) {
    console.error(caughtError);
    if (errorMessage) {
      errorMessage.textContent =
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível carregar as pastas do OneDrive.";
    }
    if (error) error.hidden = false;
  } finally {
    if (loading) loading.hidden = true;
  }
}

function queueSearch(value: string) {
  const clearButton = getElement<HTMLButtonElement>(
    "[data-documents-search-clear]"
  );

  if (clearButton) clearButton.hidden = value.length === 0;
  if (searchTimer !== undefined) window.clearTimeout(searchTimer);

  searchTimer = window.setTimeout(() => {
    state.search = value.trim();
    state.page = 1;
    void loadDocumentsPage();
  }, 300);
}

function bindFilters() {
  const searchInput = getElement<HTMLInputElement>("[data-documents-search]");
  const clearSearch = getElement<HTMLButtonElement>(
    "[data-documents-search-clear]"
  );

  searchInput?.addEventListener("compositionstart", () => {
    searchIsComposing = true;
  });
  searchInput?.addEventListener("compositionend", () => {
    searchIsComposing = false;
    queueSearch(searchInput.value);
  });
  searchInput?.addEventListener("input", () => {
    if (!searchIsComposing) queueSearch(searchInput.value);
  });

  clearSearch?.addEventListener("click", () => {
    if (!searchInput) return;
    if (searchTimer !== undefined) window.clearTimeout(searchTimer);
    searchInput.value = "";
    state.search = "";
    state.page = 1;
    clearSearch.hidden = true;
    searchInput.focus();
    void loadDocumentsPage();
  });

  document
    .querySelectorAll<HTMLSelectElement>("[data-documents-filter]")
    .forEach((select) => {
      select.addEventListener("change", () => {
        const key = select.dataset.documentsFilter as FilterKey | undefined;
        if (key) state[key] = select.value;
        state.page = 1;
        void loadDocumentsPage();
      });
    });

  getElement<HTMLButtonElement>(
    "[data-documents-clear-filters]"
  )?.addEventListener("click", () => {
    if (searchTimer !== undefined) window.clearTimeout(searchTimer);
    if (searchInput) searchInput.value = "";
    if (clearSearch) clearSearch.hidden = true;

    document
      .querySelectorAll<HTMLSelectElement>("[data-documents-filter]")
      .forEach((select) => {
        select.value = "";
      });

    state.search = "";
    state.company = "";
    state.department = "";
    state.year = "";
    state.month = "";
    state.type = "";
    state.status = "";
    state.page = 1;
    clearFolderSelection();
    selectSource("all");
    void loadDocumentsPage();
  });
}

function bindSourceTabs() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-source-tab]")
    .forEach((button) => {
      button.addEventListener("click", () => {
        const source =
          (button.dataset.sourceTab as DocumentSourceFilter | undefined) ??
          "all";
        clearFolderSelection();
        selectSource(source);
        state.page = 1;
        void loadDocumentsPage();
      });
    });
}

function bindPagination() {
  getElement<HTMLButtonElement>(
    "[data-documents-page-previous]"
  )?.addEventListener("click", () => {
    if (state.page <= 1) return;
    state.page -= 1;
    void loadDocumentsPage();
  });

  getElement<HTMLButtonElement>(
    "[data-documents-page-next]"
  )?.addEventListener("click", () => {
    const totalPages = Math.ceil(state.total / PAGE_SIZE);
    if (state.page >= totalPages) return;
    state.page += 1;
    void loadDocumentsPage();
  });
}

function bindSyncButton() {
  const button = getElement<HTMLButtonElement>("[data-documents-sync]");
  const note = getElement<HTMLElement>("[data-documents-sync-note]");

  button?.addEventListener("click", () => {
    if (note) note.hidden = false;
  });
}

function bindDetailsDialog() {
  const dialog = getElement<HTMLDialogElement>(
    "[data-documents-details-dialog]"
  );

  getElement<HTMLButtonElement>(
    "[data-documents-details-close]"
  )?.addEventListener("click", () => {
    dialog?.close();
  });
}

function bindSelection() {
  getElement<HTMLInputElement>(
    "[data-documents-select-all]"
  )?.addEventListener("change", (event) => {
    const checked =
      event.currentTarget instanceof HTMLInputElement &&
      event.currentTarget.checked;

    document
      .querySelectorAll<HTMLInputElement>("[data-documents-row-checkbox]")
      .forEach((checkbox) => {
        checkbox.checked = checked;
      });
  });
}

export function loadDocumentsFileManager() {
  bindFilters();
  bindSourceTabs();
  bindFolderTree();
  bindPagination();
  bindSyncButton();
  bindDetailsDialog();
  bindSelection();

  getElement<HTMLButtonElement>(
    "[data-documents-retry]"
  )?.addEventListener("click", () => {
    void loadDocumentsPage();
  });

  getElement<HTMLButtonElement>(
    "[data-documents-folders-retry]"
  )?.addEventListener("click", () => {
    void loadFolders();
  });

  void loadDocumentsPage();
  void loadFolders();
  void loadFilterOptions();
}
