# Etapa 07C.12F.2 — default EXECUTE global e regressão completa

Data do ensaio: 22/10/2026.

## Escopo e isolamento

- staging local: `kawana-07c11-staging`;
- PostgreSQL: `127.0.0.1:56322`, versão 17.11;
- guard de isolamento aprovado, migrations/seed automáticos desativados e
  ausência de vínculo remoto confirmada;
- produção KAWANA, n8n, Hostinger e frontend Astro não foram acessados;
- nenhuma migration anterior e nenhum default de `supabase_admin` foi alterado.

## Migration

Arquivo:
`supabase/migrations/20261022120000_revoke_postgres_global_default_function_execute.sql`.

SHA-256:
`06660E24CF18E2E3D5AC126DF1008B41B8971326DAFCD4D6F2AA944BC14FD516`.

A migration executa, em transação, a revogação global de EXECUTE de `PUBLIC`
para funções futuras criadas por `postgres` e verifica o resultado antes do
commit. A aplicação local concluiu com `BEGIN`, `ALTER DEFAULT PRIVILEGES`,
verificação e `COMMIT`.

## Default privileges antes e depois

Antes, não havia entrada global de funções em `pg_default_acl` para
`postgres`; portanto valia o default nativo implícito `PUBLIC=EXECUTE`.

Depois, a entrada global ficou `{postgres=X/postgres}`, sem EXECUTE para
`PUBLIC`. Os defaults schema-specific de `public` continuam concedendo
EXECUTE a `service_role`, e a exceção gerenciada de `supabase_admin` permaneceu
inalterada: 24 entradas cliente em `public`, hash
`a8ef4568a792f7e68193a374083afac0`.

As 25 funções existentes nos schemas auditados mantiveram o mesmo snapshot de
owner, ACL, `SECURITY DEFINER` e configurações antes e depois:
`eecd227bb68d2b20c419bf5706d07874`.

## Testes

| Suíte | Resultado |
| --- | --- |
| Auth e sessões | 8/8 aprovados |
| Profiles | 20/20 aprovados |
| Financeira principal | 30/30 aprovados |
| Financeira complementar | 15/15 aprovados |
| Novos objetos/defaults | 7/7 aprovados |
| 07C.11B completa | aprovada; 41 verificações lógicas |
| Postflight financeiro | aprovado |
| Postflight combinado | aprovado |
| Postflight segurança/defaults | aprovado |

Total de verificações individuais de segurança e compatibilidade: 121
aprovadas, zero reprovadas e zero não executadas. Os três postflights também
foram aprovados.

Os testes confirmaram:

- `anon` e `authenticated` não executam função nova sem grant explícito;
- `service_role` preserva o grant efetivo schema-specific esperado em
  `public`, sem depender de `PUBLIC`;
- grant explícito para `authenticated` funciona sem abrir acesso a `anon`;
- função nova `SECURITY DEFINER` não fica anônima;
- tabelas e sequences novas continuam protegidas;
- ACLs das funções existentes permanecem iguais;
- RPCs financeiras de extração continuam exclusivas de `service_role`;
- helpers do Dashboard continuam acessíveis aos papéis autorizados;
- as 13 tabelas auditadas continuam sem privilégios `anon`;
- `graphql_public`, `auth` e `storage` não foram alterados pela migration;
- owner/admin/reviewer/viewer, isolamento entre empresas, RLS, ETag, auditoria
  e bloqueio de arquivos `TESTE_` permanecem compatíveis.

## Cleanup

Foram removidas somente as fixtures sintéticas reservadas. A verificação final
retornou zero resíduos em empresas, memberships, documentos, extrações,
revisões, profiles, `auth.users` e `auth.identities`.

## Operação futura e reversão

Toda nova função precisa declarar grants explícitos na migration que a cria.
Helpers/RPCs do Dashboard podem conceder a `authenticated` e `service_role`;
RPCs de ingestão devem conceder somente a `service_role`; implementações
privadas não devem conceder execução direta a papéis de API.

O efeito da migration é global para funções futuras criadas por `postgres` em
todos os schemas. A estratégia de reversão, não executada, seria uma nova
migration forward-only com `ALTER DEFAULT PRIVILEGES FOR ROLE postgres GRANT
EXECUTE ON FUNCTIONS TO PUBLIC`, somente após justificativa e nova revisão de
segurança. Restaurar o default amplo reabre o risco original.

## Riscos e veredito

Permanece a exceção condicionada de `supabase_admin`: seus defaults devem ser
monitorados e tornam-se bloqueantes se mudarem, ficarem globais ou passarem a
ser owner de objetos da aplicação em `public`. O default global de `postgres`
também exige disciplina de grants explícitos em migrations futuras.

Veredito: **staging aprovado com ressalva monitorada de `supabase_admin`**.
Este resultado não autoriza implantação em produção.
