# Mapa compacto do projeto

Este documento resume a arquitetura verificada no repositório. Ele foi derivado
do grafo local em `graphify-out/` e confirmado nos arquivos-fonte apontados pelo
grafo. O grafo completo é descartável e não substitui o código ou as migrations.

## Visão geral

```text
Browser
  -> páginas e componentes Astro
  -> scripts de interação por feature
  -> services TypeScript
  -> Supabase Auth/PostgreSQL/Storage sob sessão e RLS

n8n/Hostinger
  -> Microsoft Graph / OneDrive
  -> worker privado XLSX
  -> RPCs server-side do Supabase
  -> fatos financeiros pendentes de revisão humana
```

O navegador usa o cliente único `src/lib/supabase/browser.ts`, configurado
somente com variáveis públicas. Operações sensíveis devem permanecer fora do
browser e seguir a fronteira Astro server/n8n/Supabase definida nos documentos
de arquitetura e segurança.

## Áreas funcionais

| Área | Entrada principal | Componentes e scripts | Services e dependências |
| --- | --- | --- | --- |
| Autenticação | `src/pages/login.astro` | `AuthGuard.astro` | `services/auth/auth.ts` -> Supabase Auth |
| Dashboard | `src/pages/dashboard.astro` | cards, indicadores, contas e gráficos financeiros | `dashboard-data.ts`, métricas mensais/publicadas -> Supabase |
| Financeiro | `src/pages/financeiro/index.astro` | visão geral, receber, pagar e movimentações | `financeiro-page.ts`, `receivables.ts`, `payables.ts`, `transactions.ts` |
| Revisão financeira | `src/pages/financeiro/revisao.astro` | `FinancialReviewQueue.astro`, `review-page.ts` | `review.ts` -> RPCs `finance_review_*` |
| Bancos e contas | `src/pages/bancos-contas/index.astro` | resumo, contas e movimentações | `bank-accounts-page.ts` |
| Relatórios | `src/pages/relatorios/index.astro` | filtros e resumos financeiros | `reports-page.ts` |
| Documentos | `src/pages/documentos/index.astro` | tabela, filtros, árvore OneDrive, `file-manager.ts` | `catalog.ts` -> `documents`, `onedrive_folders`, Storage |
| Upload privado | `src/pages/documentos/upload.astro` | `FinancialUploadForm.astro` | `upload.ts` -> bucket privado e catálogo `documents` |
| Notificações | `src/pages/notificacoes.astro` | `notifications-page.ts` | `notifications.ts` -> `notifications` |
| Configurações | `src/pages/configuracoes.astro` | perfil, empresas, integrações e preferências | `settings-page.ts` -> profiles, companies, integrations, user_preferences |

## Pipeline financeiro XLSX

```text
OneDrive / arquivo controlado
  -> workflow n8n inativo até autorização
  -> worker `src/services/financial/worker/server.ts`
  -> parser `kawana-xlsx-parser.ts`
  -> adaptação e validação determinística
  -> RPCs de persistência v2
  -> revisão humana
  -> publicação mensal por empresa
  -> dashboard financeiro
```

O worker valida autenticação de serviço, tamanho do corpo e timeout. O parser e
a persistência mantêm cálculos e validações em TypeScript/SQL; resultados não
autorizam publicação automática.

## Persistência e contratos

- Métricas legadas: `financial_monthly_metrics`.
- Métricas aprovadas por empresa: `financial_monthly_metrics_published`.
- Catálogo unificado: `documents`; hierarquia OneDrive: `onedrive_folders`.
- Revisão financeira: RPCs `finance_review_list`, `finance_review_decide`,
  `finance_review_history` e contrato de papel do documento.
- Migrations versionadas em `supabase/migrations/` cobrem empresas, isolamento
  financeiro, hardening, persistência v2, publicação mensal e claim
  determinístico.

A presença de migrations no Git não comprova sua aplicação em qualquer projeto
Supabase externo.

## Dependências centrais observadas no grafo

- `supabaseBrowser` conecta autenticação, documentos, notificações,
  configurações e módulos financeiros.
- `loadFinanceiroPage()` coordena a página financeira e seus services de contas,
  recebíveis, pagáveis e transações.
- `loadFinancialDashboard()` coordena período, cards, resumos e gráficos.
- `parseKawanaWorkbookConfigured()` concentra a extração XLSX configurada.
- `createFinancialXlsxWorker()` isola o parser atrás de um serviço HTTP privado.
- `prepareFinancialReviewPersistence()` valida fatos antes da persistência v2.

## Fronteiras de segurança

- Browser: não confiável; depende de sessão autenticada e RLS.
- Astro server: deve validar sessão, payload e autorização de chamadas sensíveis.
- n8n e worker: executores privados, autenticados, auditáveis e sem exposição de
  credenciais no repositório.
- Supabase: autoridade de identidade, dados, RLS, Storage e auditoria.
- IA: explica e classifica; não autoriza acesso nem realiza cálculos financeiros
  críticos.

## Divergências documentais conhecidas

`docs/DATABASE.md` ainda descreve `src/lib/supabase/client.ts`, `server.ts` e
`admin.ts`. No código atual, o cliente existente é
`src/lib/supabase/browser.ts`; a camada server-side/SSR continua documentada
como evolução futura. Para trabalho operacional, prevalece o código atual.
