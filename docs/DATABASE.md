# Banco de Dados e Supabase

Este documento descreve as regras de banco de dados do projeto e as
principais tabelas utilizadas pelo dashboard.

O projeto utiliza Supabase como banco de dados, autenticação e storage.

---

# 1. Fonte da verdade

Este documento serve como referência para desenvolvimento, mas o schema
real do Supabase continua sendo a fonte final da verdade.

Antes de criar ou alterar SQL:

1. Leia migrations existentes.
2. Inspecione os tipos gerados, quando disponíveis.
3. Procure referências da tabela/coluna no código.
4. Verifique o schema atual no Supabase.
5. Não suponha que este documento substitui o schema real.
6. Não altere tabelas existentes sem verificar seu uso.
7. Não remova colunas ou constraints sem verificar dependências.
8. Nunca reduza regras de segurança ou RLS apenas para fazer uma query funcionar.

---

# 2. Arquitetura de acesso ao Supabase

A aplicação utiliza clientes Supabase separados de acordo com o contexto.

Estrutura atual:

src/lib/supabase/
├── client.ts
├── server.ts
└── admin.ts

Regras:

- `client.ts` é usado para operações permitidas ao usuário autenticado.
- `server.ts` é usado para operações executadas somente no servidor.
- `admin.ts` é reservado para operações administrativas seguras.
- Service Role Key nunca pode ser exposta ao navegador.
- Secrets nunca devem usar variáveis públicas.
- Componentes Astro não devem conter lógica complexa de banco.
- Consultas devem preferencialmente ficar em `src/services/`.

Nunca colocar no frontend:

- Supabase Service Role Key
- secrets
- refresh tokens
- credenciais administrativas
- chaves privadas de APIs

---

# 3. Regra de organização

O fluxo preferencial é:

UI / Astro Component
↓
Service TypeScript
↓
Supabase Client
↓
Supabase Database

Exemplo financeiro:

dashboard.astro
↓
src/services/financial/monthly-metrics.ts
↓
financial_monthly_metrics

Evitar consultas Supabase espalhadas diretamente pelos componentes.

---

# 4. Perfis e permissões

## profiles

Representa os usuários do sistema.

Campos atuais:

- `id` uuid — primary key
- `full_name` text
- `email` text — unique
- `avatar_url` text nullable
- `role` text
- `status` text
- `created_at` timestamptz nullable
- `updated_at` timestamptz nullable

A tabela utiliza RLS.

Usuários podem visualizar e atualizar o próprio perfil.

Administradores possuem permissões adicionais através de `is_admin()`.

---

## user_permissions

Permissões de acesso aos módulos.

Campos:

- `id`
- `user_id`
- `module`
- `can_view`
- `can_create`
- `can_update`
- `can_delete`
- `created_at`

O sistema utiliza permissões por módulo.

Exemplos:

- dashboard
- financeiro
- documents
- settings
- logs
- automations
- gmail
- calendar
- drive

Não substituir esse sistema por verificações hardcoded no frontend.

---

# 5. Dashboard

## dashboard_metrics

Tabela existente para métricas genéricas/operacionais do dashboard.

Campos atuais:

- `id`
- `metric_key`
- `metric_label`
- `metric_value`
- `variation`
- `comparison_label`
- `icon`
- `period`
- `created_at`
- `updated_at`

IMPORTANTE:

`dashboard_metrics` NÃO é a fonte da verdade para o histórico financeiro
mensal.

Não utilizar esta tabela para armazenar:

- faturamento mensal histórico
- lucro líquido mensal
- margem líquida mensal
- saldo em caixa mensal

Esses dados pertencem a:

`financial_monthly_metrics`

---

# 6. Métricas financeiras mensais

## financial_monthly_metrics

Fonte da verdade atual para os principais indicadores financeiros mensais
exibidos no dashboard.

Cada linha representa exatamente um mês.

Campos atuais:

- `id` uuid — primary key
- `year` int4
- `month` int4
- `revenue` numeric
- `net_profit` numeric
- `net_margin` numeric
- `cash_balance` numeric
- `created_at` timestamptz
- `updated_at` timestamptz

Constraints:

- `PRIMARY KEY (id)`
- `UNIQUE (year, month)`
- `month BETWEEN 1 AND 12`

Não criar uma coluna para cada mês.

ERRADO:

- january_revenue
- february_revenue
- revenue_may_2024

CORRETO:

year | month | revenue
2024 | 4 | 1111111.11
2024 | 5 | 1250000

---

## 6.1 Cards financeiros

Os quatro cards financeiros principais são alimentados por esta tabela.

Mapeamento:

`revenue`
→ Faturamento do mês

`net_profit`
→ Lucro líquido do mês

`net_margin`
→ Margem líquida

`cash_balance`
→ Saldo em caixa

Exemplo:

Para Maio/2024:

year = 2024
month = 5

A aplicação busca uma única linha:

financial_monthly_metrics
WHERE year = 2024
AND month = 5

Essa linha alimenta os quatro cards.

---

## 6.2 Seleção de período

O dashboard terá um seletor global de período.

Exemplo:

Maio/2024

Internamente:

year = 2024
month = 5

Ao selecionar outro período:

Junho/2024

a aplicação passa a utilizar:

year = 2024
month = 6

Todos os cards financeiros devem utilizar o mesmo período selecionado.

Não hardcode Maio/2024 permanentemente no dashboard.

Maio/2024 pode ser utilizado apenas durante desenvolvimento/testes.

---

## 6.3 Comparação com mês anterior

As variações NÃO devem ser armazenadas em
`financial_monthly_metrics`.

Elas devem ser calculadas pela aplicação.

Exemplo:

Faturamento Maio:
R$ 1.250.000

Faturamento Abril:
R$ 1.111.111

Cálculo:

((current - previous) / previous) \* 100

Resultado aproximado:

+12,5%

A aplicação poderá exibir:

R$ 1.250.000
↑ 12,5% vs Abr/2024

---

## 6.4 Margem líquida

A margem líquida deve ser comparada utilizando pontos percentuais.

Exemplo:

Abril:
16,1%

Maio:
14,9%

Resultado:

14,9 - 16,1 = -1,2 p.p.

Não calcular crescimento percentual para este indicador quando a UI estiver
mostrando diferença de margem.

---

## 6.5 Histórico e sparklines

Os pequenos gráficos dos cards devem utilizar registros anteriores da mesma
tabela.

Exemplo:

financial_monthly_metrics
↓
últimos 6 meses
↓
revenue
↓
sparkline de faturamento

O mesmo princípio vale para:

- revenue
- net_profit
- net_margin
- cash_balance

Não armazenar os pontos do sparkline separadamente se eles já puderem ser
obtidos através do histórico mensal.

---

## 6.6 Service financeiro

O acesso a `financial_monthly_metrics` deve ficar preferencialmente em:

src/services/financial/monthly-metrics.ts

Funções planejadas:

- `getMonthlyFinancialMetrics(year, month)`
- `getPreviousMonthFinancialMetrics(year, month)`
- `getFinancialMetricHistory(year, month, months)`
- `getAvailableFinancialPeriods()`

Componentes visuais não devem conhecer detalhes desnecessários da query
Supabase.

---

# 7. Dados financeiros futuros

A tabela `financial_monthly_metrics` representa valores consolidados.

No futuro, os dados poderão vir de documentos financeiros estruturados.

Fluxo planejado:

Excel / CSV / PDF
↓
processamento
↓
financial_transactions
↓
agregação
↓
financial_monthly_metrics
↓
dashboard

Para o MVP, `financial_monthly_metrics` pode ser preenchida diretamente.

Não implementar automaticamente o pipeline completo sem uma decisão
específica do projeto.

---

# 8. Transações financeiras

## financial_transactions

Tabela planejada para armazenar dados financeiros estruturados extraídos
de documentos.

Estrutura conceitual:

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

Esta tabela é planejada.

Antes de escrever código contra ela, verificar se ela realmente existe no
schema atual do Supabase.

Não assumir sua existência apenas porque está documentada aqui.

---

# 9. Regras para valores financeiros

Sempre utilizar tipos apropriados para dinheiro.

Usar:

`numeric`

Evitar:

`float`
`float4`
`float8`

para valores monetários que exigem precisão.

Também:

- armazenar moeda quando houver múltiplas moedas;
- normalizar sinais positivos e negativos;
- distinguir receita e despesa;
- preservar valor original extraído quando necessário;
- registrar origem do dado;
- registrar confiança quando o valor vier de IA/OCR;
- realizar cálculos determinísticos em SQL ou TypeScript quando possível.

IA não deve ser usada para somar valores quando SQL/TypeScript consegue
realizar o cálculo de maneira determinística.

---

# 10. Documentos

## documents

Catálogo unificado dos documentos conhecidos pelo sistema.

Tabela atual:

- `id` uuid
- `owner_id` uuid
- `source` text
- `category` text
- `subcategory` text nullable
- `file_name` text
- `mime_type` text nullable
- `file_size` int8 nullable
- `storage_bucket` text nullable
- `storage_path` text nullable
- `google_file_id` text nullable
- `google_folder_id` text nullable
- `google_web_url` text nullable
- `sensitivity` text
- `processing_status` text
- `extracted_text` text nullable
- `indexed_for_ai` bool
- `metadata` jsonb
- `source_created_at` timestamptz nullable
- `source_updated_at` timestamptz nullable
- `last_synced_at` timestamptz nullable
- `created_at` timestamptz
- `updated_at` timestamptz

Essa tabela funciona como catálogo.

Um documento pode estar:

- no Supabase Storage
- no Google Drive
- futuramente no OneDrive

O arquivo original não precisa necessariamente ser copiado para o Supabase.

---

# 11. Arquivos privados

Arquivos financeiros sensíveis enviados diretamente pelo dashboard devem
utilizar storage privado.

Bucket atual:

`financial-files`

Fluxo:

Dashboard
↓
Supabase Storage privado
↓
documents
↓
processamento futuro

Não gerar URLs públicas permanentes para arquivos financeiros privados.

Quando download for necessário, utilizar mecanismo seguro e temporário,
como signed URL, respeitando autenticação e autorização.

---

# 12. Google Drive

## drive_folders

Pastas do Google Drive configuradas para sincronização.

Campos atuais:

- `id`
- `owner_id`
- `google_folder_id`
- `folder_name`
- `category`
- `include_subfolders`
- `is_active`
- `last_sync_at`
- `change_page_token`
- `created_at`
- `updated_at`

Objetivo:

O Google Drive permanece como possível fonte original dos arquivos.

O Supabase pode armazenar:

- catálogo
- metadados
- localização
- status
- dados extraídos relevantes

Não copiar automaticamente todos os arquivos do Google Drive para o
Supabase sem necessidade.

---

# 13. Indexação futura para IA

Arquivos poderão futuramente ser pesquisados e analisados por IA.

A arquitetura planejada é:

Google Drive / Supabase Storage
↓
documents
↓
identificação dos documentos relevantes
↓
extração somente quando necessária
↓
IA / análise
↓
resultado

Evitar enviar todos os documentos para um modelo de IA em cada consulta.

Primeiro localizar os documentos relevantes através do catálogo.

Depois processar somente o conteúdo necessário.

---

# 14. document_chunks

Tabela planejada para indexação de conteúdo.

Estrutura conceitual:

- `id`
- `document_id`
- `chunk_index`
- `content`
- `metadata`
- `embedding`
- `created_at`

IMPORTANTE:

Esta tabela é planejada.

Antes de criar código que dependa dela, verificar se existe no Supabase.

Não criar automaticamente embeddings para todos os documentos sem uma
necessidade definida.

---

# 15. analysis_jobs

Tabela planejada para controlar análises executadas pela IA.

Estrutura conceitual:

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

Antes de utilizar, verificar existência no schema real.

---

# 16. Uploads financeiros

## financial_upload_batches

Controla lotes de uploads financeiros.

Campos atuais:

- `id`
- `user_id`
- `name`
- `status`
- `total_files`
- `uploaded_files`
- `processed_files`
- `failed_files`
- `error_message`
- `created_at`
- `processing_started_at`
- `processing_finished_at`

Utilizar quando múltiplos arquivos forem enviados no mesmo lote.

---

## uploaded_files

Tabela existente relacionada a arquivos enviados/processados.

Campos atuais:

- `id`
- `file_name`
- `file_type`
- `file_url`
- `storage_path`
- `status`
- `processed_rows`
- `error_message`
- `uploaded_by`
- `created_at`
- `batch_id`
- `category`
- `file_size`
- `mime_type`
- `processing_status`
- `processed_at`
- `metadata`

IMPORTANTE:

O projeto também possui a tabela `documents`.

Antes de criar novas funcionalidades, verificar qual tabela é a fonte da
verdade para aquele fluxo.

Para o catálogo unificado atual, preferir `documents`.

Não duplicar registros desnecessariamente entre `uploaded_files` e
`documents`.

---

# 17. Outras tabelas existentes

O banco atualmente também possui:

- `integrations`
- `activities`
- `automation_logs`
- `gmail_messages`
- `calendar_events`
- `drive_files`
- `system_settings`
- `notifications`
- `automation_daily_stats`
- `dashboard_widgets`
- `widget_preferences`
- `api_connections`
- `system_health`
- `audit_logs`
- `webhooks`
- `user_preferences`

Antes de alterar qualquer uma dessas tabelas:

1. verificar schema real;
2. verificar services existentes;
3. verificar componentes que dependem dela;
4. verificar RLS;
5. verificar se existe migration correspondente.

---

# 18. RLS e segurança

Row Level Security deve permanecer habilitado para dados privados.

Dados financeiros nunca devem receber policy pública apenas para facilitar
desenvolvimento.

Não criar:

`Public can read financial metrics`

para dados financeiros.

A tabela:

`financial_monthly_metrics`

deve ser acessível somente por usuários autenticados autorizados.

A tabela:

`documents`

já utiliza `owner_id` para limitar acesso ao proprietário ou administrador.

Antes do deploy de produção, revisar todas as policies `anon`.

Especial atenção para:

- api_connections
- webhooks
- audit_logs
- notifications
- user_preferences
- integrations
- automation_logs

Informações sensíveis não devem ser publicamente legíveis.

---

# 19. API connections e secrets

A tabela `api_connections` possui campos relacionados a:

- access_token
- refresh_token

Esses valores são sensíveis.

Nunca retornar tokens para componentes do navegador.

Nunca permitir acesso `anon` a credenciais.

Preferir armazenamento e acesso exclusivamente server-side.

Antes de produção, revisar obrigatoriamente as policies desta tabela.

---

# 20. Migrations

Alterações estruturais do banco devem evoluir para migrations versionadas.

Regras:

- não editar migration já aplicada em produção;
- criar migration corretiva;
- incluir índices necessários;
- incluir constraints;
- incluir RLS;
- documentar impacto;
- verificar rollback quando aplicável;
- não excluir coluna sem verificar uso;
- não criar tabela duplicada sem verificar schema atual.

Estrutura futura recomendada:

supabase/
└── migrations/
├── ...
└── YYYYMMDD_description.sql

---

# 21. Regras para Codex e outros agentes

Antes de alterar banco ou services relacionados ao Supabase:

1. Ler este arquivo.
2. Ler `ARCHITECTURE.md`.
3. Ler `SECURITY.md`.
4. Procurar services existentes.
5. Procurar referências no código.
6. Verificar migrations.
7. Confirmar nomes reais de tabelas e colunas.
8. Fazer a menor alteração necessária.

Nunca:

- inventar tabela;
- inventar coluna;
- remover RLS;
- criar acesso público para resolver erro;
- expor Service Role Key;
- colocar secrets no frontend;
- duplicar arquitetura existente;
- substituir services funcionais sem necessidade;
- criar abstrações complexas sem necessidade.

Priorizar código:

- simples;
- legível;
- modular;
- fácil de manter;
- fácil de editar manualmente.

---

# 22. Estado atual do módulo financeiro

A implementação atual deve seguir esta ordem:

1. `financial_monthly_metrics` como fonte mensal.
2. Service TypeScript para leitura.
3. Cards financeiros.
4. Comparação com mês anterior.
5. Seletor de período.
6. Histórico para sparklines.
7. Gráficos financeiros.
8. Entrada estruturada por Excel/CSV.
9. Processamento de PDF quando necessário.
10. IA para busca, análise e comparação de documentos.

Não implementar todas as etapas ao mesmo tempo.

---

# 23. Fluxo atual esperado

O fluxo atual do dashboard financeiro é:

financial_monthly_metrics
↓
src/services/financial/monthly-metrics.ts
↓
dashboard.astro
↓
FinancialMetricCard.astro
↓
Faturamento
Lucro líquido
Margem líquida
Saldo em caixa

Posteriormente:

Excel / PDF
↓
financial_transactions
↓
financial_monthly_metrics
↓
Dashboard

E para documentos:

Google Drive / Supabase Storage
↓
documents
↓
busca/indexação
↓
IA
↓
comparação/análise

---

# 24. Princípio geral

Supabase é responsável por:

- autenticação;
- autorização;
- banco estruturado;
- catálogo de documentos;
- dados financeiros;
- storage privado quando necessário.

Astro é responsável por:

- interface;
- páginas;
- componentes;
- apresentação dos dados.

Services TypeScript são responsáveis por:

- comunicação entre aplicação e banco;
- queries;
- transformação simples;
- cálculos determinísticos.

n8n será responsável futuramente por:

- automações;
- sincronizações;
- processamento assíncrono;
- integrações;
- workflows de documentos.

IA será utilizada futuramente para:

- interpretação;
- busca contextual;
- comparação;
- identificação de inconsistências;
- explicação dos resultados.

IA não deve substituir SQL ou TypeScript para operações determinísticas
simples.
