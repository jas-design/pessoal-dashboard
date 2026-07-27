import supabase from '../../lib/supabase/browser';

export interface DocumentFilters {
  source?: 'supabase' | 'google_drive';
  category?: string;
  processingStatus?: string;
  search?: string;
}

export async function getDocuments(
  filters: DocumentFilters = {}
) {
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

  return data ?? [];
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
