import {
  createDocumentDownloadUrl,
  getDocuments,
  type DocumentCatalogItem,
} from "./catalog";

type SourceTab = "all" | "onedrive" | "uploads";
type FilterKey = "company" | "department" | "year" | "month" | "type" | "status";

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
  "1": "Janeiro",
  "2": "Fevereiro",
  "3": "Março",
  "4": "Abril",
  "5": "Maio",
  "6": "Junho",
  "7": "Julho",
  "8": "Agosto",
  "9": "Setembro",
  "10": "Outubro",
  "11": "Novembro",
  "12": "Dezembro",
};

let documents: DocumentCatalogItem[] = [];
let activeSource: SourceTab = "all";

function getElement<T extends Element>(selector: string) {
  return document.querySelector<T>(selector);
}

function getFilterValue(key: FilterKey) {
  const element = getElement<HTMLSelectElement>(`[data-documents-filter="${key}"]`);
  return element?.value ?? "";
}

function getSearchValue() {
  return getElement<HTMLInputElement>("[data-documents-search]")?.value.trim().toLowerCase() ?? "";
}

function getMetadataText(item: DocumentCatalogItem, key: string) {
  const value = item.metadata?.[key];
  return typeof value === "string" ? value : "";
}

function getCompany(item: DocumentCatalogItem) {
  return item.company_id || getMetadataText(item, "company") || getMetadataText(item, "company_id");
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
  return item.storage_path || getMetadataText(item, "path");
}

function isOneDriveDocument(item: DocumentCatalogItem) {
  const source = item.source.toLowerCase();
  const provider = item.provider?.toLowerCase() ?? "";

  return source === "onedrive" || provider === "onedrive";
}

function isUploadDocument(item: DocumentCatalogItem) {
  return item.source === "supabase";
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

  if (mimeType.includes("folder")) {
    return "Pasta";
  }

  return extension ? extension.toUpperCase() : "Arquivo";
}

function getStatusLabel(item: DocumentCatalogItem) {
  const status = item.processing_status ?? "pending";
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
  const details = [
    `Arquivo: ${item.file_name}`,
    `Origem: ${getSourceLabel(item)}`,
    `Tipo: ${getFileType(item)}`,
    `Status: ${getStatusLabel(item)}`,
  ];

  window.alert(details.join("\n"));
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
    const webUrl = getMetadataText(item, "web_url");

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

function getFilteredDocuments() {
  const search = getSearchValue();
  const company = getFilterValue("company");
  const department = getFilterValue("department");
  const year = getFilterValue("year");
  const month = getFilterValue("month");
  const type = getFilterValue("type");
  const status = getFilterValue("status");

  return documents.filter((item) => {
    if (activeSource === "onedrive" && !isOneDriveDocument(item)) {
      return false;
    }

    if (activeSource === "uploads" && !isUploadDocument(item)) {
      return false;
    }

    if (company && String(getCompany(item)) !== company) {
      return false;
    }

    if (department && String(getDepartment(item)) !== department) {
      return false;
    }

    if (year && String(getYear(item)) !== year) {
      return false;
    }

    if (month && String(getMonth(item)) !== month) {
      return false;
    }

    if (type && getFileType(item) !== type) {
      return false;
    }

    if (status && (item.processing_status ?? "pending") !== status) {
      return false;
    }

    if (!search) {
      return true;
    }

    const searchableText = [
      item.file_name,
      getCompany(item),
      getDepartment(item),
      getPath(item),
      item.mime_type ?? "",
    ]
      .join(" ")
      .toLowerCase();

    return searchableText.includes(search);
  });
}

function setVisibility(selector: string, isVisible: boolean) {
  const element = getElement<HTMLElement>(selector);

  if (element) {
    element.hidden = !isVisible;
  }
}

function renderDocuments() {
  const tableBody = getElement<HTMLTableSectionElement>("[data-documents-table-body]");
  const items = getFilteredDocuments();

  if (!tableBody) {
    return;
  }

  tableBody.replaceChildren(...items.map(createDocumentRow));
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

function fillSelect(key: FilterKey, values: string[], labels: Record<string, string> = {}) {
  const select = getElement<HTMLSelectElement>(`[data-documents-filter="${key}"]`);
  const firstOption = select?.querySelector("option");

  if (!select || !firstOption) {
    return;
  }

  select.replaceChildren(firstOption);

  values.forEach((value) => {
    select.append(new Option(labels[value] ?? value, value));
  });
}

function fillFilters() {
  fillSelect("company", getUniqueOptions(getCompany));
  fillSelect("department", getUniqueOptions(getDepartment));
  fillSelect("year", getUniqueOptions(getYear).sort((current, next) => Number(next) - Number(current)));
  fillSelect("month", getUniqueOptions(getMonth), monthLabels);
  fillSelect("type", getUniqueOptions(getFileType));
  fillSelect(
    "status",
    getUniqueOptions((item) => item.processing_status ?? "pending"),
    statusLabels
  );
}

function bindFilters() {
  getElement<HTMLInputElement>("[data-documents-search]")?.addEventListener("input", renderDocuments);

  document.querySelectorAll<HTMLSelectElement>("[data-documents-filter]").forEach((select) => {
    select.addEventListener("change", renderDocuments);
  });

  getElement<HTMLButtonElement>("[data-documents-clear-filters]")?.addEventListener("click", () => {
    const searchInput = getElement<HTMLInputElement>("[data-documents-search]");

    if (searchInput) {
      searchInput.value = "";
    }

    document.querySelectorAll<HTMLSelectElement>("[data-documents-filter]").forEach((select) => {
      select.value = "";
    });
    renderDocuments();
  });
}

function bindSourceTabs() {
  document.querySelectorAll<HTMLButtonElement>("[data-source-tab]").forEach((button) => {
    button.addEventListener("click", () => {
      activeSource = (button.dataset.sourceTab as SourceTab | undefined) ?? "all";

      document.querySelectorAll<HTMLButtonElement>("[data-source-tab]").forEach((tab) => {
        const isActive = tab === button;
        tab.classList.toggle("is-active", isActive);
        tab.setAttribute("aria-selected", String(isActive));
      });

      renderDocuments();
    });
  });
}

function bindFolderTree() {
  const breadcrumb = getElement<HTMLElement>("[data-documents-breadcrumb]");

  document.querySelectorAll<HTMLButtonElement>("[data-folder-path]").forEach((button) => {
    button.addEventListener("click", () => {
      if (breadcrumb) {
        breadcrumb.textContent = button.dataset.folderPath ?? "Todas as pastas";
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

export async function loadDocumentsFileManager() {
  const loading = getElement<HTMLElement>("[data-documents-loading]");
  const errorMessage = getElement<HTMLElement>("[data-documents-error]");

  bindFilters();
  bindSourceTabs();
  bindFolderTree();
  bindSyncButton();

  try {
    documents = await getDocuments();
    fillFilters();
    renderDocuments();
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
