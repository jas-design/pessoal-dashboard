# Etapa 07C.11B — acesso público e default privileges

## Consumidores encontrados

| Objeto | Consumidor versionado | Necessita anon? |
| --- | --- | --- |
| `dashboard_metrics` | `src/services/dashboard/metrics.ts`, sem imports atuais | Não |
| `dashboard_widgets` | nenhum | Não |
| `system_health` | nenhum | Não |

O dashboard atual importa `src/services/financial/dashboard-data.ts` e consulta
`financial_monthly_metrics`, não `dashboard_metrics`. Login usa Supabase Auth e
não consulta as três tabelas. Notificações consultam `notifications`; gráficos
de automações consultam `automation_daily_stats`. Nenhum fluxo encontrado exige
uma sessão anônima para ler dados de negócio.

Há uma divergência histórica: a migration local
`20260825185200_create_dashboard_metrics.sql` descreve `user_id`, competência e
policies por proprietário, mas a baseline real contém a tabela genérica e a
policy `can_access_module('dashboard')`. Essa migration antiga não deve ser
reaplicada sobre a baseline nem usada como fonte do schema atual.

## Diferença entre baseline e estado confirmado

A baseline schema-only de 20/10/2026 é anterior aos últimos hardenings:

- concede `ALL` de tabela para anon nas três tabelas ainda públicas;
- ainda registra grants não-SELECT nas outras nove tabelas sensíveis;
- contém as três policies `Public can read ...`;
- concede por default `ALL` em novas tabelas, sequences e funções a anon e
  authenticated, além de service_role;
- deixa `PUBLIC`/anon executar `can_access_module()`, `current_user_role()` e
  `is_admin()`.

Após a exportação, foi confirmado em produção que as dez tabelas sensíveis não
têm mais privilégios anon e que, nas três tabelas restantes, somente SELECT é
efetivo. As migrations desta etapa repetem revogações de forma idempotente para
que a restauração local da baseline reproduza o estado atual e o alvo final.

## Achados

### Alto — defaults de novos objetos

Os defaults do owner `postgres` concedem automaticamente novos objetos a anon
e authenticated. Em funções, PostgreSQL ainda concede EXECUTE a `PUBLIC` por
default. Uma função `SECURITY DEFINER` futura poderia ficar chamável antes de
uma revisão explícita.

Correção: novos objetos em `public` não recebem defaults de anon,
authenticated ou PUBLIC. `service_role` é preservada. Cada migration futura
deve conceder o mínimo necessário explicitamente.

### Médio — três leituras públicas sem consumidor

`dashboard_metrics`, `dashboard_widgets` e `system_health` não têm necessidade
anônima comprovada. Métricas e saúde operacional não devem ser públicas por
conveniência.

Correção: remover policies anon e todos os grants anon/PUBLIC das 13 tabelas
inventariadas. Grants e policies de authenticated/service_role não são
alterados.

### Médio — helpers `SECURITY DEFINER`

`can_access_module()`, `current_user_role()` e `is_admin()` eram executáveis
por anon/PUBLIC. Os resultados são limitados ao chamador, mas a exposição não
é necessária e aumenta a superfície de funções privilegiadas.

Correção: EXECUTE somente para authenticated e service_role e `search_path`
vazio. Seus corpos comprovados já qualificam schemas.

O schema exposto pelo projeto local/PostgREST permanece `public` e
`graphql_public`; `financial_private` não está exposto. A migration financeira
07C continua responsável por retirar USAGE/EXECUTE direto do schema privado.
Como a baseline foi exportada apenas de `public,financial_private`, os objetos
gerenciados em `graphql_public` não estão comprovados no arquivo. O preflight
os inventaria no staging; qualquer função `SECURITY DEFINER` anônima desse
schema exige revisão separada, sem alteração automática de objetos gerenciados.

### Médio — histórico local divergente

O histórico local de `dashboard_metrics` não reproduz o objeto real. O staging
deve sempre restaurar a baseline e aplicar somente as migrations explicitamente
aprovadas, sem `db reset` ou replay automático do diretório de migrations.

### Médio — notificações executadas no build estático

`Header.astro` e `notificacoes.astro` consultam `notifications` no frontmatter
com o cliente browser. No build estático não existe sessão de usuário; após o
hardening, a consulta recebe `permission denied`. O build continua com estado
vazio, mas a funcionalidade não representa notificações autenticadas reais.

Não reabrir anon. A correção futura deve carregar notificações no browser após
a sessão autenticada ou migrar essa leitura para Astro SSR com contexto de
sessão. Esta etapa apenas documenta o problema e preserva a proteção atual.

## Migrations propostas

1. `20261020160000_remove_remaining_public_dashboard_access.sql`
   reconcilia os hardenings pós-baseline e remove as três leituras públicas.
2. `20261020161000_harden_public_default_privileges.sql` remove defaults
   implícitos e protege os três helpers atuais.

Ordem no staging: baseline, migrations financeiras 07C, migration de profiles,
as duas migrations 07C.11B, postflights e testes sintéticos.

## Impactos

- Login: nenhum; Supabase Auth não depende dessas tabelas/funções como anon.
- Dashboard: nenhum consumidor ativo das três tabelas; authenticated mantém
  seus grants e a policy existente de `dashboard_metrics`.
- Notificações e automações: os grants anon já removidos são reconciliados;
  authenticated/service_role permanecem inalterados. O carregamento estático
  de notificações continua bloqueado e precisa de correção frontend separada.
- n8n: service_role e RPCs de extração não são modificadas.
- Desenvolvimento futuro: toda tabela, sequence ou RPC nova precisa de grant
  explícito. Isso é intencional e deve entrar no checklist de migrations.

## Testes e rollback

`scripts/supabase/staging/07c11b/00-preflight.sql` inventaria grants, policies,
defaults, funções privilegiadas e configuração PostgREST sem ler dados.
`20-security-tests.sql` usa um perfil global `user` sintético, papéis reais
`anon`/`authenticated` e claims JWT; verifica negação anônima, acesso
autenticado sob RLS, defaults e helpers. Ele cria uma tabela, sequence e função
sintéticas dentro da transação para provar os novos defaults; o `ROLLBACK`
remove os três objetos.

O rollback integral suportado é recriar o staging descartável da baseline. O
script `90-safe-rollback.sql` é apenas contenção: reafirma acesso legítimo de
authenticated/service_role e nunca restaura acesso anon ou defaults amplos.
Em produção, qualquer reversão deve ser uma migration forward-only com
justificativa de produto.

## Veredito

Pronto para iniciar staging local após autorização. Não está aprovado para
produção até os testes confirmarem que nenhuma função `SECURITY DEFINER`
permanece executável por anon e que os módulos autenticados continuam íntegros.
