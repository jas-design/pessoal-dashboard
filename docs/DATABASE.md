# Banco de dados e Supabase

## Fonte da verdade

Antes de criar SQL:

1. Leia migrations existentes.
2. Inspecione tipos gerados.
3. Procure referências no código.
4. Não suponha que este documento representa o schema final.

## Entidades planejadas

### documents

Catálogo unificado de arquivos.

Campos conceituais:

- `id`
- `user_id`
- `source`
- `external_id`
- `file_name`
- `file_path`
- `mime_type`
- `file_size`
- `source_url`
- `category`
- `processing_status`
- `checksum`
- `source_modified_at`
- `created_at`
- `updated_at`

### document_chunks

- `id`
- `document_id`
- `chunk_index`
- `content`
- `metadata`
- `embedding`
- `created_at`

### analysis_jobs

- `id`
- `user_id`
- `analysis_type`
- `status`
- `question`
- `source_document_ids`
- `result`
- `structured_result`
- `error_message`
- `started_at`
- `completed_at`
- `created_at`

### financial_transactions

- `id`
- `user_id`
- `document_id`
- `transaction_date`
- `description`
- `category`
- `account`
- `document_number`
- `amount`
- `transaction_type`
- `currency`
- `counterparty`
- `source`
- `confidence_score`
- `created_at`

### agent_approvals

- `id`
- `user_id`
- `job_id`
- `action_type`
- `action_payload`
- `status`
- `requested_at`
- `decided_at`
- `decided_by`

### agent_audit_logs

- `id`
- `user_id`
- `job_id`
- `event_type`
- `tool_name`
- `input_summary`
- `output_summary`
- `metadata`
- `created_at`

## Regras de migration

- migrations versionadas;
- não editar migration já aplicada em produção;
- criar nova migration corretiva;
- incluir índices;
- incluir constraints;
- incluir RLS;
- documentar rollback ou impacto;
- não excluir coluna sem verificar uso.

## Financeiro

- usar `numeric`, não float, para dinheiro;
- armazenar moeda;
- normalizar sinais e tipos;
- cálculos em SQL/TypeScript;
- preservar valor original extraído;
- registrar confiança e origem.
