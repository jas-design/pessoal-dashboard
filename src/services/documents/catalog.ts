import supabase from '../../lib/supabase/browser';

const METADATA_PAGE_SIZE = 1000;

const documentColumns = [
  'id', 'file_name', 'mime_type', 'file_size', 'source', 'category',
  'subcategory', 'processing_status', 'storage_bucket', 'storage_path',
  'google_web_url', 'source_path', 'source_web_url', 'source_created_at',
  'source_updated_at', 'source_modified_at', 'created_at', 'updated_at',
  'company_id', 'department', 'period_year', 'period_month', 'provider',
  'metadata', 'parent_folder_id', 'external_drive_id', 'is_deleted',
].join(',');

const documentFilterColumns = [
  'file_name', 'mime_type', 'source', 'provider', 'company_id', 'department',
  'period_year', 'period_month', 'processing_status', 'metadata',
].join(',');

export interface DocumentCatalogItem {
  id: string;
  file_name: string;
  mime_type: string | null;
  file_size: number | null;
  source: 'supabase' | 'google_drive' | 'onedrive' | string;
  category: string | null;
  subcategory: string | null;
  processing_status: string | null;
  storage_bucket: string | null;
  storage_path: string | null;
  google_web_url: string | null;
  source_path: string | null;
  source_web_url: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  source_modified_at: string | null;
  created_at: string;
  updated_at: string;
  company_id: string | null;
  department: string | null;
  period_year: number | null;
  period_month: number | null;
  provider: string | null;
  metadata: Record<string, unknown> | null;
  parent_folder_id: string | null;
  external_drive_id: string | null;
  is_deleted: boolean;
}

export interface OneDriveFolder {
  external_folder_id: string;
  external_parent_id: string | null;
  external_drive_id: string;
  folder_name: string;
}

export interface DocumentFilterItem {
  file_name: string;
  mime_type: string | null;
  source: string;
  provider: string | null;
  company_id: string | null;
  department: string | null;
  period_year: number | null;
  period_month: number | null;
  processing_status: string | null;
  metadata: Record<string, unknown> | null;
}

export type DocumentSourceFilter = 'all' | 'onedrive' | 'uploads';

export interface DocumentPageFilters {
  page?: number;
  pageSize?: number;
  source?: DocumentSourceFilter;
  search?: string;
  companyId?: string;
  department?: string;
  year?: string;
  month?: string;
  fileType?: string;
  processingStatus?: string;
  externalFolderId?: string;
  externalDriveId?: string;
}

export interface DocumentPage {
  items: DocumentCatalogItem[];
  total: number;
  page: number;
  pageSize: number;
}

export interface DocumentFilters {
  source?: 'supabase' | 'google_drive';
  category?: string;
  processingStatus?: string;
  search?: string;
}

function escapePostgrestSearch(value: string) {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/"/g, '\\"')
    .replace(/[%_]/g, (character) => `\\${character}`);
}

function isKnownFileType(fileType?: string) {
  return ['PDF', 'Excel', 'Word', 'ZIP', 'Outro'].includes(fileType ?? '');
}

export async function getDocumentsPage(
  filters: DocumentPageFilters = {}
): Promise<DocumentPage> {
  const page = Math.max(1, Math.trunc(filters.page ?? 1));
  const pageSize = Math.min(
    100,
    Math.max(1, Math.trunc(filters.pageSize ?? 50))
  );
  const from = (page - 1) * pageSize;

  let query = supabase
    .from('documents')
    .select(documentColumns, { count: 'exact' })
    .eq('is_deleted', false)
    .order('created_at', { ascending: false })
    .range(from, from + pageSize - 1);

  if (filters.source === 'onedrive') {
    query = query.or('source.eq.onedrive,provider.eq.onedrive');
  } else if (filters.source === 'uploads') {
    query = query.eq('source', 'supabase');
  }

  if (filters.externalFolderId && filters.externalDriveId) {
    query = query
      .eq('parent_folder_id', filters.externalFolderId)
      .eq('external_drive_id', filters.externalDriveId);
  }

  if (filters.search?.trim()) {
    const search = escapePostgrestSearch(filters.search.trim());
    const pattern = `%${search}%`;
    query = query.or(
      `file_name.ilike."${pattern}",source_path.ilike."${pattern}",department.ilike."${pattern}"`
    );
  }

  if (filters.companyId) query = query.eq('company_id', filters.companyId);
  if (filters.department) query = query.eq('department', filters.department);
  if (filters.year) query = query.eq('period_year', Number(filters.year));
  if (filters.month) query = query.eq('period_month', Number(filters.month));
  if (filters.processingStatus) {
    query = query.eq('processing_status', filters.processingStatus);
  }

  if (filters.fileType === 'PDF') {
    query = query.or('mime_type.ilike.%pdf%,file_name.ilike.%.pdf');
  }

  if (filters.fileType === 'Excel') {
    query = query.or(
      'mime_type.ilike.%spreadsheet%,mime_type.ilike.%excel%,mime_type.ilike.%csv%,file_name.ilike.%.xls,file_name.ilike.%.xlsx,file_name.ilike.%.csv'
    );
  }

  if (filters.fileType === 'Word') {
    query = query.or(
      'mime_type.ilike.%word%,file_name.ilike.%.doc,file_name.ilike.%.docx'
    );
  }

  if (filters.fileType === 'ZIP') {
    query = query.or('mime_type.ilike.%zip%,file_name.ilike.%.zip');
  }

  if (filters.fileType === 'Outro') {
    query = query
      .not('file_name', 'ilike', '%.pdf')
      .not('file_name', 'ilike', '%.xls')
      .not('file_name', 'ilike', '%.xlsx')
      .not('file_name', 'ilike', '%.csv')
      .not('file_name', 'ilike', '%.doc')
      .not('file_name', 'ilike', '%.docx')
      .not('file_name', 'ilike', '%.zip');
  }

  if (filters.fileType && !isKnownFileType(filters.fileType)) {
    throw new Error('Tipo de arquivo inválido.');
  }

  const { data, error, count } = await query;

  if (error) {
    throw new Error(`Erro ao buscar documentos: ${error.message}`);
  }

  return {
    items: (data ?? []) as unknown as DocumentCatalogItem[],
    total: count ?? 0,
    page,
    pageSize,
  };
}

export async function getOneDriveFolders(): Promise<OneDriveFolder[]> {
  const folders: OneDriveFolder[] = [];
  let from = 0;
  let total: number | null = null;

  while (total === null || from < total) {
    const { data, error, count } = await supabase
      .from('onedrive_folders')
      .select(
        'external_folder_id, external_parent_id, external_drive_id, folder_name',
        { count: 'exact' }
      )
      .range(from, from + METADATA_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao buscar pastas do OneDrive: ${error.message}`);
    }

    const page = (data ?? []) as OneDriveFolder[];
    folders.push(...page);
    total = count ?? folders.length;

    if (page.length === 0) break;
    from += page.length;
  }

  return folders;
}

export async function getDocumentFilterItems(): Promise<DocumentFilterItem[]> {
  const items: DocumentFilterItem[] = [];
  let from = 0;
  let total: number | null = null;

  while (total === null || from < total) {
    const { data, error, count } = await supabase
      .from('documents')
      .select(documentFilterColumns, { count: 'exact' })
      .eq('is_deleted', false)
      .range(from, from + METADATA_PAGE_SIZE - 1);

    if (error) {
      throw new Error(`Erro ao preparar filtros de documentos: ${error.message}`);
    }

    const page = (data ?? []) as unknown as DocumentFilterItem[];
    items.push(...page);
    total = count ?? items.length;

    if (page.length === 0) break;
    from += page.length;
  }

  return items;
}

// Kept for the legacy DocumentsList component while the main page uses getDocumentsPage.
export async function getDocuments(
  filters: DocumentFilters = {}
): Promise<DocumentCatalogItem[]> {
  const items: DocumentCatalogItem[] = [];
  let from = 0;
  let total: number | null = null;

  while (total === null || from < total) {
    let query = supabase
      .from('documents')
      .select(documentColumns, { count: 'exact' })
      .eq('is_deleted', false)
      .order('created_at', { ascending: false })
      .range(from, from + METADATA_PAGE_SIZE - 1);

    if (filters.source) query = query.eq('source', filters.source);
    if (filters.category) query = query.eq('category', filters.category);
    if (filters.processingStatus) {
      query = query.eq('processing_status', filters.processingStatus);
    }
    if (filters.search?.trim()) {
      query = query.ilike('file_name', `%${filters.search.trim()}%`);
    }

    const { data, error, count } = await query;

    if (error) {
      throw new Error(`Erro ao buscar documentos: ${error.message}`);
    }

    const page = (data ?? []) as unknown as DocumentCatalogItem[];
    items.push(...page);
    total = count ?? items.length;

    if (page.length === 0) break;
    from += page.length;
  }

  return items;
}

export async function createDocumentDownloadUrl(
  bucket: string,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw new Error(`Não foi possível preparar o download: ${error.message}`);
  }

  return data.signedUrl;
}
