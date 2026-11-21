# Integrações

Este documento registra contratos e evidências do repositório sem incluir
credenciais. Estado remoto só deve ser afirmado após verificação autorizada no
serviço correspondente.

## GitHub

**Finalidade:** versionamento e colaboração do projeto.

**Verificado no repositório:** existe um remote Git chamado `origin`. Não há
arquivos em `.github/`, portanto não foi encontrado workflow GitHub Actions
versionado.

**Segurança:** `.env`, tokens, chaves, dumps, credenciais e exports sensíveis
devem permanecer ignorados. Antes de push, usar o secret check de
`docs/PRODUCTION_SECURITY.md`.

**Não confirmado externamente:** URL/conteúdo atual do remote, branch padrão,
proteções, Actions, secrets, deploy hooks, permissões e sincronização com o
workspace local.

## Supabase

**Finalidade:** Auth, PostgreSQL, RLS, Storage, catálogo, dados financeiros,
preferências, notificações e auditoria.

**Verificado no repositório:** o browser usa `src/lib/supabase/browser.ts` com
URL e anon key públicas. Services consultam tabelas e RPCs explícitas. Migrations
versionadas implementam hardening, isolamento por empresa, persistência v2,
publicação mensal e claim determinístico.

**Fluxos principais:**

- sessão -> services -> queries sob RLS;
- upload -> bucket privado -> `documents`;
- revisão -> RPCs `finance_review_*`;
- publicação -> `financial_monthly_metrics_published`;
- n8n/worker -> RPCs restritas ao contexto server-side.

**Segurança:** service role nunca deve chegar ao browser. Grants, policies e
assinaturas de RPC devem ser conferidos nas migrations e no ambiente real.

**Não confirmado externamente:** migrations aplicadas, schema atual, policies,
grants, dados, buckets, URLs, saúde e projeto efetivamente usado por cada
ambiente.

## n8n

**Finalidade:** orquestrar Microsoft Graph, download de documentos, worker XLSX,
persistência e automações futuras.

**Verificado no repositório:** existem quatro exports em `n8n/workflows/`, todos
inativos. Há configuração local em `n8n/local/` e testes que validam estrutura,
contratos e compatibilidade dos exports.

**Segurança:** navegador não chama webhook privado diretamente. Credenciais do
Supabase, Microsoft Graph e worker devem ser selecionadas após importação e
permanecer no cofre do n8n. Exports não devem conter valores reais.

**Não confirmado externamente:** workflows importados, IDs, versões, ativação,
credenciais selecionadas, URLs, execuções, retries, retenção e saúde da instância
Hostinger.

## Hostinger

**Finalidade:** hospedar ou coordenar o dashboard Astro, n8n e o worker privado
XLSX, conforme a arquitetura documentada.

**Verificado no repositório:** existe
`workers/financial-xlsx/docker-compose.hostinger.example.yml`, com rede externa,
segredo por arquivo, limite de 8 MiB e serviço sem porta publicada. Há runbooks
de diagnóstico, health check, piloto e rollback em `docs/financial/`.

**Segurança:** confirmar a rede real antes de instalar; não recriar nem remover a
rede do n8n; manter segredo fora do Git; expor o worker apenas na rede privada.

**Não confirmado externamente:** containers, rede, domínio, recursos, imagem
implantada, versão do dashboard, health checks, backups e configuração de
produção.

## Microsoft Graph e OneDrive

**Finalidade:** manter arquivos Microsoft na origem e sincronizar catálogo e
metadados no Supabase. Outlook é planejado para leitura, classificação, resumo e
rascunho sujeito a aprovação.

**Verificado no repositório:**

- `catalog.ts` lê `documents` e `onedrive_folders`;
- a UI possui filtro, árvore, breadcrumb e abertura de itens OneDrive;
- workflows financeiros usam endpoint de download do Microsoft Graph;
- exports usam identificadores placeholder para escolha de credencial após
  importação, sem segredo versionado;
- a tela de configurações lê o estado registrado em `integrations` e a última
  sincronização conhecida.

**Segurança:** usar menor privilégio, leitura antes de escrita, tokens em cofre
do n8n/secret manager e aprovação humana para envio, alteração ou exclusão.

**Não confirmado externamente:** App Registration, tenant, permissões concedidas,
credenciais válidas, renovação de token, drives acessíveis, sincronização ativa,
delta tokens, volume real do catálogo e funcionamento do Outlook.
