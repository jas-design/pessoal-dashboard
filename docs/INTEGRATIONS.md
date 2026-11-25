# Integrações

Estado consolidado em 2026-11-25. Nenhuma credencial ou cursor privado deve ser
copiado para este documento.

## GitHub

**Finalidade:** versionamento, revisão e automação de entrega.

**Verificado localmente:** o repositório possui remote `origin`. O estado de
branch protection, environments, secrets e Actions deve ser conferido no
GitHub antes de qualquer deploy; não é inferido pelo conteúdo local.

**Segurança:** `.env`, tokens, chaves, dumps e credenciais permanecem fora do
Git. Antes de push, executar o secret check de `docs/PRODUCTION_SECURITY.md`.

## Supabase

**Finalidade:** Auth, PostgreSQL, RLS, Storage, catálogo, revisão, publicação
financeira, preferências, notificações e auditoria.

**Verificado no código:** o browser usa `src/lib/supabase/browser.ts`. A revisão
usa `finance_review_*`; a publicação mensal usa
`finance_publish_monthly_metrics`; Dashboard e Financeiro leem
`financial_monthly_metrics_published` quando há empresa selecionada.

**Evidência operacional:** o Delta Sync remoto leu o estado de sincronização e
concluiu a RPC atômica do Supabase. Consulta direta anterior confirmou 5.230
documentos, 40 fatos financeiros, 36 pendentes e setembro de 2026 publicado.

**Ainda pendente:** inventário integral de migrations, schema, policies, grants,
buckets e ACLs no projeto remoto. Dados publicados provam que o contrato está
em uso, não que toda a cadeia versionada esteja reconciliada.

## n8n

**Finalidade:** Microsoft Graph, OneDrive, workers privados, persistência e
automações controladas.

**Evidência operacional:** MCP conectado; 16 workflows encontrados. Estavam
ativos somente o Delta Sync 03 e a fila PDF 13B. As quatro cópias 13C estavam
inativas. O workflow 03 tinha 1.346 execuções indexadas e as 200 mais recentes
terminaram com sucesso.

Somente 01, 02 e 03 permitem inspeção detalhada por MCP. Os demais aparecem no
inventário, mas bloqueiam detalhes por configuração `Available in MCP`.

**Problemas conhecidos:** `trust proxy` incompatível com o cabeçalho recebido,
porta 32768 publicada diretamente, ausência de healthcheck Docker, warnings de
PDF e entradas inválidas no registro MCP.

**Segurança:** detalhes de execução podem carregar cursores privados. Consultas
devem ser mínimas e sanitizadas; valores de credenciais permanecem no cofre.

## Hostinger VPS 2004641

**Finalidade:** hospedar n8n, Traefik e workers privados.

**Evidência operacional:** VPS em execução com 2 vCPU, 8 GB de RAM e 100 GB de
disco. n8n, Traefik, financial-xlsx-worker e document-content-worker estavam em
execução. Os workers estavam saudáveis e acessíveis pelo n8n na rede
`n8n-mhbu_default`, sem portas publicadas.

O worker financeiro usava `fabio-financial-xlsx-worker:fix-bedfa3f`; o worker de
conteúdo usava a imagem diagnóstica `fabio-document-content-worker:13c-diag-v1`.

**Segurança pendente:** a porta pública 32768 e a ausência de firewall Hostinger
associado precisam de correção planejada com backup e rollback. Nenhuma mudança
de infraestrutura foi autorizada nesta etapa.

## Microsoft Graph e OneDrive

**Finalidade:** manter arquivos na origem e sincronizar catálogo e metadados.

**Evidência operacional:** a credencial Microsoft Drive está associada aos
workflows MCP-visíveis. A execução detalhada do Delta Sync em 25/11/2026
consultou o Microsoft Graph com sucesso e retornou `NoChanges`; o cursor foi
confirmado atomicamente pelo Supabase.

**Ainda pendente:** inventário administrativo do App Registration, permissões
concedidas, expiração/renovação e comportamento de erro. Cursores Delta são
dados privados e não devem ser documentados.

## Workers privados

- `financial-xlsx-worker:8787`: health check HTTP 200 a partir do n8n, zero jobs
  ativos na consulta e porta somente interna.
- `document-content-worker:8788`: health check HTTP 200 a partir do n8n, imagem
  diagnóstica e porta somente interna.

Health check comprova processo e rede; não substitui piloto autenticado do
endpoint de processamento. Pilotos continuam condicionados a autorização.
