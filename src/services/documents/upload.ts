import supabase from '../../lib/supabase/client';

const BUCKET_NAME = 'financial-files';
const MAX_FILE_SIZE = 10 * 1024 * 1024;

const ALLOWED_EXTENSIONS = [
  'pdf',
  'csv',
  'xls',
  'xlsx',
];

export interface UploadFinancialFilesOptions {
  files: File[];
  category: string;
  subcategory?: string;
}

export interface FileUploadResult {
  fileName: string;
  success: boolean;
  error?: string;
}

function getFileExtension(fileName: string) {
  return fileName
    .split('.')
    .pop()
    ?.toLowerCase() ?? '';
}

function sanitizeFileName(fileName: string) {
  return fileName
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9._-]/g, '-')
    .replace(/-+/g, '-');
}

function validateFile(file: File) {
  const extension = getFileExtension(file.name);

  if (!ALLOWED_EXTENSIONS.includes(extension)) {
    return `Formato não permitido: ${file.name}`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `O arquivo ${file.name} ultrapassa 10 MB.`;
  }

  return null;
}

async function getAuthenticatedUser() {
  const {
    data: { session },
    error: sessionError,
  } = await supabase.auth.getSession();

  if (sessionError) {
    throw new Error(
      `Erro ao verificar a sessão: ${sessionError.message}`
    );
  }

  if (!session) {
    throw new Error(
      'Sua sessão expirou. Faça login novamente.'
    );
  }

  const {
    data: { user },
    error: userError,
  } = await supabase.auth.getUser();

  if (userError) {
    throw new Error(
      `Não foi possível identificar o usuário: ${userError.message}`
    );
  }

  if (!user) {
    throw new Error(
      'Usuário não identificado. Faça login novamente.'
    );
  }

  return user;
}

async function uploadSingleFile(
  file: File,
  userId: string,
  category: string,
  subcategory: string | undefined,
  batchId: string
) {
  const validationError = validateFile(file);

  if (validationError) {
    throw new Error(validationError);
  }

  const safeFileName = sanitizeFileName(file.name);

  const storagePath = [
    userId,
    category,
    batchId,
    safeFileName,
  ].join('/');

  const { error: uploadError } = await supabase.storage
    .from(BUCKET_NAME)
    .upload(storagePath, file, {
      cacheControl: '3600',
      upsert: false,
      contentType: file.type || undefined,
    });

  if (uploadError) {
    throw new Error(
      `Erro ao enviar ${file.name}: ${uploadError.message}`
    );
  }

  const { error: documentError } = await supabase
    .from('documents')
    .insert({
      owner_id: userId,
      source: 'supabase',
      category,
      subcategory: subcategory || null,
      file_name: file.name,
      mime_type: file.type || null,
      file_size: file.size,
      storage_bucket: BUCKET_NAME,
      storage_path: storagePath,
      sensitivity: 'restricted',
      processing_status: 'pending',
      indexed_for_ai: false,
      metadata: {
        batch_id: batchId,
        original_file_name: file.name,
      },
    });

  if (documentError) {
    await supabase.storage
      .from(BUCKET_NAME)
      .remove([storagePath]);

    throw new Error(
      `Erro ao registrar ${file.name}: ${documentError.message}`
    );
  }

  return {
    fileName: file.name,
    storagePath,
  };
}

export async function uploadFinancialFiles({
  files,
  category,
  subcategory,
}: UploadFinancialFilesOptions): Promise<FileUploadResult[]> {
  if (!files.length) {
    throw new Error(
      'Selecione pelo menos um arquivo.'
    );
  }

  if (!category.trim()) {
    throw new Error(
      'Selecione uma categoria.'
    );
  }

  const user = await getAuthenticatedUser();
  const batchId = crypto.randomUUID();

  const results = await Promise.allSettled(
    files.map((file) =>
      uploadSingleFile(
        file,
        user.id,
        category,
        subcategory,
        batchId
      )
    )
  );

  return results.map((result, index) => {
    const fileName =
      files[index]?.name ?? 'Arquivo desconhecido';

    if (result.status === 'fulfilled') {
      return {
        fileName,
        success: true,
      };
    }

    return {
      fileName,
      success: false,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : 'Erro desconhecido no upload.',
    };
  });
}