# Etapa 07C.13B.1 — recoleta segura da auditoria remota KAWANA

Data: 22/10/2026. Resultado: **interrompida antes da execução do preflight em
produção por falha de segurança no transporte de credenciais**.

## Escopo e destino

- projeto remoto autorizado: KAWANA `xjxwyzyfnumfphubuize`;
- staging local: `127.0.0.1:56322`, projeto isolado
  `kawana-07c11-staging`;
- arquivo auditado:
  `scripts/supabase/07c13a-production-readonly-preflight.sql`;
- nenhuma migration, DDL, DML, grant, revoke, função da aplicação ou correção
  de dados foi executada;
- nenhuma das sete migrations congeladas foi modificada.

## Revisão estática do preflight

O arquivo foi preservado sem alterações. Ele contém 17 result sets em 12
blocos e permanece delimitado por `BEGIN TRANSACTION READ ONLY` e `ROLLBACK`.

A revisão confirmou a ausência de `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`,
`CREATE`, `ALTER`, `DROP`, `GRANT`, `REVOKE`, `CALL`, `DO`, `COPY` e `MERGE`.
As funções invocadas são funções nativas de leitura de contexto, catálogo,
privilégios, definição ou hash. As funções da aplicação são apenas
inventariadas em `pg_proc`; nenhuma delas é executada. As consultas de tabelas
da aplicação retornam somente contagens agregadas, sem IDs, dados pessoais ou
valores financeiros.

## Método de transporte validado no staging

Como não há `psql.exe` compatível instalado no host, foi utilizado o cliente
`psql` PostgreSQL 17 já presente no container isolado do staging. O arquivo SQL
foi copiado para `/tmp` do container e entregue diretamente ao cliente com
`-f`, sem SQL posicional e sem reconstrução pelo PowerShell.

A execução utilizou:

- `psql -X`;
- `ON_ERROR_STOP=1`;
- saída CSV para preservar separadamente todos os result sets;
- `statement_timeout=30000`;
- `lock_timeout=5000`;
- `idle_in_transaction_session_timeout=60000`;
- uma única sessão PostgreSQL;
- transação `READ ONLY` encerrada por `ROLLBACK`.

Não há credenciais nem strings de conexão registradas neste relatório.

## Validação no staging

O guard `assert-local-isolation.ps1` passou, confirmando o project ID isolado,
migrations e seed automáticos desativados, ausência de vínculo remoto no
workdir e baseline disponível sem comandos de dados.

A execução do preflight no staging terminou com código de saída `0`. A saída
conteve `BEGIN`, os 17 result sets e `ROLLBACK`. Todos os result sets foram
identificados pelo campo `section`:

1. `database_context`;
2. `required_roles`;
3. `required_schemas`;
4. `required_relations`;
5. `profiles_columns`;
6. `profiles_constraints`;
7. `profiles_role_status_counts`;
8. `profiles_incompatible_values`;
9. `target_constraints`;
10. `target_policies`;
11. `effective_table_privileges`;
12. `target_functions`;
13. `financial_private_access`;
14. `supabase_admin_owned_application_objects`;
15. `default_privileges`;
16. `financial_company_readiness`;
17. `migration_history`.

Os result sets sem linhas mantiveram seus cabeçalhos, permitindo distinguir
resultado vazio de resultado ausente. O contexto confirmou
`transaction_read_only=on`. O staging terminou com zero divergências nas
quatro contagens agregadas e sem histórico em
`supabase_migrations.schema_migrations`, consistente com o ambiente controlado.

## Falha de segurança e interrupção

Antes da execução remota, foi usado o modo `--dry-run` da Supabase CLI apenas
para identificar o mecanismo de conexão já provisionado. Apesar de ser um dry
run do dump, a CLI inicializou uma credencial de login PostgreSQL e imprimiu
seu valor na saída do comando. A expiração dessa credencial não foi comprovada.

O valor não foi copiado para arquivos, documentos ou comandos posteriores e
não é reproduzido aqui. Ainda assim, sua presença no log da ferramenta viola o
requisito desta etapa. A coleta foi interrompida imediatamente. O preflight
SQL não foi executado em KAWANA e nenhum resultado remoto novo foi coletado.
Essa credencial deve ser tratada como exposta até que um administrador
autorizado confirme sua expiração ou revogação fora desta etapa.

## Resultado remoto e divergências

Não há evidência remota nova válida para ACLs, RLS, profiles, functions,
default privileges, schemas financeiros ou contagens agregadas. Permanece
válido apenas o resultado da Etapa 07C.13B anterior de que
`supabase_migrations.schema_migrations` estava ausente naquela coleta.

Como a execução 07C.13B.1 não chegou ao preflight remoto, não é possível
comparar KAWANA com o staging nem reclassificar as sete migrations com base em
evidência atual.

## Classificação das sete migrations

| Ordem | Migration | Classificação nesta etapa |
| --- | --- | --- |
| 1 | `20261016120000_create_company_members.sql` | exige nova coleta remota segura |
| 2 | `20261016121000_secure_financial_review_access.sql` | exige nova coleta remota segura |
| 3 | `20261017120000_protect_financial_private.sql` | exige nova coleta remota segura |
| 4 | `20261019120000_harden_profiles_security.sql` | exige nova coleta remota segura |
| 5 | `20261020160000_remove_remaining_public_dashboard_access.sql` | exige nova coleta remota segura |
| 6 | `20261020161000_harden_public_default_privileges.sql` | exige nova coleta remota segura |
| 7 | `20261022120000_revoke_postgres_global_default_function_execute.sql` | exige nova coleta remota segura |

## Riscos e bloqueios

- uma credencial de login PostgreSQL, sem expiração comprovada, foi exposta no
  log pela própria CLI;
- não existe no host um `psql` compatível fora do ambiente Docker;
- ainda falta um canal de entrega de credencial que não a imprima em comando,
  log ou documento;
- ainda falta validar, antes da conexão, TLS com verificação completa do
  certificado em conexão direta ou Session pooler;
- ACLs, RLS, profiles, functions, owners, defaults e divergências financeiras
  de KAWANA continuam sem evidência integral capturada;
- o histórico remoto permanece incompatível com uso seguro de `db push` ou
  `migration repair`.

## Próximo passo seguro

Não repetir a CLI em modo que imprima credenciais. Uma nova etapa precisa usar
uma credencial previamente entregue ao processo por canal protegido, sem valor
na linha de comando, e um container descartável com o SQL montado como somente
leitura. A conexão deve exigir TLS e validação do certificado, usar endpoint
direto ou Session pooler, e executar o arquivo com o mesmo método aprovado no
staging.

Nenhuma dessas ações está autorizada por este relatório. Em especial, não
executar migrations, backup, implantação, reparo de histórico ou correção de
dados.

## Veredito

**No-Go para avançar ao planejamento de backup e implantação.** O transporte
por arquivo e a captura integral foram aprovados no staging, mas a segurança da
credencial falhou antes do preflight remoto. A produção não foi auditada nesta
recoleta e as sete migrations continuam sem classificação de compatibilidade
remota.
