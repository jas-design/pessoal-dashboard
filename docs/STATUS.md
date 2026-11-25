# Estado verificado do projeto

Última revisão operacional: 2026-11-25.

Este arquivo separa evidência local, verificação remota em modo somente leitura
e informações ainda pendentes. Nenhuma constatação abaixo autoriza deploy,
ativação de workflow, aprovação ou publicação financeira.

## Baseline funcional do repositório

- Astro, TypeScript e SCSS implementam login, dashboard, documentos, upload,
  financeiro, revisão financeira, bancos/contas, relatórios, notificações e
  configurações.
- O navegador reutiliza `src/lib/supabase/browser.ts` sob sessão e RLS.
- Dashboard e Financeiro consultam `financial_monthly_metrics_published` quando
  uma empresa é selecionada; dados legados permanecem separados.
- A fila de revisão usa as RPCs `finance_review_list`, `finance_review_decide`,
  `finance_review_history` e `finance_review_set_document_role`.
- O parser Kawana, o worker XLSX, a persistência v2 e as validações
  determinísticas estão versionados e cobertos por testes.
- A publicação mensal é explícita e server-side por
  `finance_publish_monthly_metrics`; aprovar um fato não atualiza o Dashboard.

## Auditoria operacional de 2026-11-25

### Hostinger e VPS 2004641

- MCP Hostinger acessível em modo leitura.
- VPS `srv2004641.hstgr.cloud` em execução, plano KVM 2, com 2 vCPU, 8 GB de
  RAM e 100 GB de armazenamento.
- Janela consultada: CPU média de 1,77% e pico de 8,67%; RAM em torno de
  1,21 GB; disco entre 6,1 e 6,6 GB; uptime aproximado de 32,9 dias.
- Containers observados:
  - `n8n-mhbu-n8n-1`: em execução;
  - `fabio-financial-worker-financial-xlsx-worker-1`: saudável;
  - `fabio-document-content-document-content-worker-1`: saudável, imagem
    diagnóstica `fabio-document-content-worker:13c-diag-v1`;
  - `traefik-traefik-1`: em execução.
- n8n e os dois workers compartilham `n8n-mhbu_default`.
- Do container n8n, os health checks internos dos workers financeiro e de
  conteúdo retornaram HTTP 200. As portas 8787 e 8788 não estão publicadas.

### n8n, OneDrive e Supabase

- MCP n8n acessível em modo leitura.
- Inventário remoto: 16 workflows, 2 ativos e 14 inativos.
- Ativos: `03 - KAWANA - OneDrive Delta Sync v2 - Bulk Atomico` e
  `13B - KAWANA - PDF text queue`.
- As quatro cópias 13C estavam inativas e sem execuções `new`, `running` ou
  `waiting` no momento da auditoria.
- O workflow 03 tinha 1.346 execuções indexadas; as 200 mais recentes estavam
  concluídas com sucesso. A execução detalhada consultada em 25/11/2026
  confirmou OneDrive sem mudanças e commit atômico do cursor pelo Supabase.
- Os workflows 01, 02 e 03 permitem inspeção MCP. Os outros 13 aparecem no
  inventário, mas bloqueiam detalhes porque `Available in MCP` está desativado.
- Credenciais Microsoft Drive, Supabase KAWANA e autenticação dos workers
  existem no cofre do n8n; valores não foram consultados nem registrados.

### Baseline financeira remota

Confirmada anteriormente por consulta direta autorizada ao Supabase e adotada
como baseline desta sprint, sem reprocessamento:

- 5.230 documentos catalogados;
- 40 fatos financeiros extraídos;
- 36 fatos em revisão;
- janeiro a agosto de 2026 aguardando revisão e publicação;
- setembro de 2026 já publicado.

A matriz sanitizada foi materializada em
`docs/financial/FINANCIAL_DELIVERY_REVIEW_2026.md`. Ela confirmou 32 fatos v2
pendentes de janeiro a agosto, quatro fatos legados v1 pendentes e quatro fatos
v2 de setembro aprovados e publicados.

A linha publicada de setembro contém quatro fatos e corresponde aos valores
aprovados: receita de R$ 3.864,63, despesa de R$ 48.440,50, resultado de
-R$ 44.575,87 e saldo de R$ 33.460,11. A igualdade receita menos despesa
confere.

## Problemas operacionais conhecidos

- A porta do n8n está publicada em `0.0.0.0:32768` e `:::32768`, além do
  roteamento por Traefik; a VPS não tinha firewall Hostinger associado.
- O n8n registra `X-Forwarded-For` com `trust proxy` desativado, o que pode
  comprometer a identificação correta usada pelo rate limiting.
- O container n8n não expõe healthcheck Docker configurado.
- Logs registraram ausência de `standardFontDataUrl` e avisos de indexação PDF;
  a associação provável é 13A/13B, ainda sem inspeção MCP desses workflows.
- O n8n registra periodicamente `Skipped invalid MCP registry entries`.
- O workflow 13B está ativo, mas não apresentou histórico pelo MCP.
- Nomes dos workflows 13C ainda dizem `DEPLOY WORKER FIRST`/`AGUARDA VPS`, embora
  o worker diagnóstico já esteja saudável.
- Detalhes de execução podem conter cursores privados; não devem ser copiados
  para documentação, logs ou respostas.

## Validações locais de 2026-11-25

- `npm run check`: 0 erros e 5 hints já existentes;
- `npm run build`: 11 rotas estáticas, com alerta de chunk acima de 500 kB;
- suite financeira: 92 aprovados, 3 ignorados e nenhuma falha;
- suites de notificações, build estático e indicadores: 12 aprovados;
- total: 104 aprovados, 3 ignorados e nenhuma falha;
- `financial-delivery-review-readonly.sql`: executado com sucesso no Supabase
  remoto em transação somente leitura e finalizado com `rollback`.

Os três testes ignorados dependem dos arquivos XLSX reais e não constituem
aprovação documental nem funcional.

## Pendências reais

- Validar localmente Dashboard, Financeiro e Revisão com a empresa Kawana e
  setembro de 2026 sob sessão autenticada. As três rotas responderam HTTP 200,
  mas a validação visual/autenticada ficou pendente porque o browser de
  Computer Use estava indisponível e Playwright não está instalado.
- Validar documentalmente as quatro métricas canônicas de janeiro antes de
  solicitar autorização específica para aprovação/publicação.
- Conferir a receita em `B24` nos documentos de junho, julho e agosto; o código
  versionado espera `B23` para esse lote.
- Confirmar commit e estratégia de hospedagem do Dashboard em produção.
- Reconciliar schema, policies, grants e cadeia completa de migrations do
  Supabase remoto; a existência de dados publicados comprova o contrato em uso,
  mas não substitui inventário completo do schema.
- Corrigir a superfície pública e a configuração de proxy do n8n em janela
  controlada, sem interromper Traefik, OneDrive ou workers.

## Limitação do Graphify

O snapshot possui 1.387 nós. Ele é usado para localizar relações e arquivos;
código, migrations e verificações autorizadas dos serviços continuam sendo as
fontes operacionais finais.
