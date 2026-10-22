# Etapa 07C.11A — baseline atualizada e staging local

## Baseline validada

Arquivo local ignorado pelo Git:
`.local/supabase/staging/07c11/baseline/kawana-schema-only-2026-10-20.sql`.

- SHA-256: `BF2C3EEE2CD6DCA1B136506D288E19F84789B643442441BC0D16ADE16F7684F9`;
- 103.737 bytes, sem `COPY` ou `INSERT INTO` de dados;
- 34 tabelas, 16 funções, 43 policies e RLS habilitada nas 34 tabelas;
- as 25 constraints exigidas pelo preflight 07C.8 estão presentes;
- as dez funções financeiras comprovadas estão presentes: oito de revisão e
  duas RPCs de extração;
- `financial_review_document_policy` mantém `PRIMARY KEY (document_id)`;
- `authenticated` não possui UPDATE amplo em `profiles`;
- `profiles.role` ainda tem `DEFAULT 'admin'`, que a migration proposta remove.
- `profiles` ainda carrega grants históricos além de SELECT/INSERT; a migration
  local agora remove todos de anon e limita authenticated ao contrato mínimo.

Comparada com a baseline anterior, foram removidas exatamente as policies anon
de SELECT de: `activities`, `api_connections`, `audit_logs`,
`automation_daily_stats`, `automation_logs`, `integrations`, `notifications`,
`user_preferences`, `webhooks` e `widget_preferences`. Permanecem policies anon
de leitura em `dashboard_metrics`, `dashboard_widgets` e `system_health`.

## Diferenças pós-baseline

- A produção recebeu, depois do dump, a remoção dos grants anon remanescentes
  nas dez tabelas sensíveis; a baseline local ainda mostra o estado anterior.
- A Etapa 07C.11B prepara a reconciliação idempotente da baseline, remove as
  três leituras públicas restantes e corrige default privileges inseguros.
- Os audits `00-anon-access-audit.sql` e `07c11b/00-preflight.sql` devem tratar
  qualquer privilégio anon inesperado como falha.
- A baseline contém metadados estruturais e corpos SQL. Continua confidencial,
  local e fora do Git.

## Compatibilidade dos papéis

Os papéis globais aprovados são `admin` e `user`, sempre explícitos. `user` não
satisfaz `is_admin()` e não recebe acesso de `can_access_module()` sem linha
própria em `user_permissions`. Papéis empresariais continuam em
`companies.owner_id`/`company_members` e nunca são copiados para
`profiles.role`.

A migration de profiles foi atualizada para esse contrato sem tocar linhas. A
versão admin-only foi arquivada para comparação. Fixtures e testes exigem que
owner, admin empresarial, reviewer, viewer e usuário sem vínculo tenham
`profiles.role='user'`; somente o ator global admin usa `admin`.

## Ambiente isolado preparado

O projeto descartável está em `.local/supabase/staging/07c11`, com project ID e
portas próprios, migrations automáticas e seed desabilitados. O guard
`assert-local-isolation.ps1` recusa o diretório principal e exige a baseline.
Não usar `--linked`, `--project-ref`, `db push`, `migration up` ou `db reset`.

Após autorização explícita, a ordem planejada é:

1. executar o guard estático;
2. iniciar o projeto pelo `--workdir` isolado;
3. restaurar a baseline somente com `--local`;
4. executar audits/preflight somente leitura;
5. criar oito usuários Auth `@example.test` pela API local;
6. aplicar a migration de profiles e provisionar sete perfis explícitos com
   `10-synthetic-profiles.sql`; o oitavo permanece sem perfil;
7. aplicar as três migrations financeiras 07C;
8. aplicar as duas migrations 07C.11B de acesso público/default privileges;
9. executar postflights, fixtures e testes com papéis PostgreSQL e claims JWT;
10. destruir e recriar o projeto local para testar rollback integral.

## Critérios de aprovação

- anon sem acesso financeiro/sensível e sem funções privadas;
- global `user` nunca satisfaz `is_admin()`, mesmo com papel empresarial;
- sem vínculo não vê empresas nem revisões;
- owner/admin/reviewer/viewer respeitam capacidades e isolamento A/B;
- admin global preserva módulos gerais, mas não ganha revisão financeira sem
  vínculo explícito;
- role/status de profile não são atualizáveis pelo browser;
- ETag, revisão, auditoria e bloqueio de `TESTE_` permanecem intactos;
- somente `service_role` chama as duas RPCs públicas de extração;
- papéis de API não chamam implementações em `financial_private`.

## Rollback

O rollback integral do ensaio é parar o projeto local pelo ID
`kawana-07c11-staging` sem backup e recriá-lo da baseline. O script de profiles
é apenas contenção e nunca restaura `DEFAULT 'admin'` ou UPDATE amplo.

## Veredito

Os artefatos estão prontos para iniciar o staging local, após autorização. A
execução deve ser considerada ensaio, não aprovação para produção. A Etapa
07C.11B versiona os hardenings pós-baseline e transforma grants anon, default
privileges e funções SECURITY DEFINER em critérios obrigatórios de teste.
