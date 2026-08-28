import supabase from '../../lib/supabase/browser';

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
  source_path?: string | null;
  source_web_url?: string | null;
  source_created_at: string | null;
  source_updated_at: string | null;
  created_at: string;
  updated_at: string;
  company_id?: string | null;
  department?: string | null;
  period_year?: number | null;
  period_month?: number | null;
  provider?: string | null;
  metadata?: Record<string, unknown> | null;
}

export interface DocumentFilters {
  source?: 'supabase' | 'google_drive';
  category?: string;
  processingStatus?: string;
  search?: string;
}

export async function getDocuments(
  filters: DocumentFilters = {}
): Promise<DocumentCatalogItem[]> {
  let query = supabase
    .from('documents')
    .select('*')
    .order('created_at', { ascending: false });

  if (filters.source) {
    query = query.eq('source', filters.source);
  }

  if (filters.category) {
    query = query.eq('category', filters.category);
  }

  if (filters.processingStatus) {
    query = query.eq(
      'processing_status',
      filters.processingStatus
    );
  }

  if (filters.search?.trim()) {
    query = query.ilike(
      'file_name',
      `%${filters.search.trim()}%`
    );
  }

  const { data, error } = await query;

  if (error) {
    throw new Error(
      `Erro ao buscar documentos: ${error.message}`
    );
  }

  return (data ?? []) as DocumentCatalogItem[];
}


export async function createDocumentDownloadUrl(
  bucket: string,
  storagePath: string
) {
  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(storagePath, 60);

  if (error) {
    throw new Error(
      `Não foi possível preparar o download: ${error.message}`
    );
  }

  return data.signedUrl;
}
