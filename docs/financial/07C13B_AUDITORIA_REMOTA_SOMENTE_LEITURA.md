# Etapa 07C.13B — auditoria remota somente leitura

Data: 22/10/2026. Resultado: **auditoria interrompida; evidências
insuficientes para classificar as sete migrations como compatíveis**.

## Destino e guardas

- project ref autorizado e conferido: `xjxwyzyfnumfphubuize`;
- `supabase/.temp/project-ref` continha exatamente esse valor;
- a execução usou `--linked --project-ref xjxwyzyfnumfphubuize`;
- o script divergente de `package.json` não foi usado;
- nenhum comando de link, `db push`, `db pull`, `migration repair` ou `db reset`
  foi executado;
- nenhuma migration, configuração, role, credencial, Auth, n8n ou dado foi
  alterado.

## Evidência de somente leitura

O arquivo `scripts/supabase/07c13a-production-readonly-preflight.sql` foi lido e
classificado antes da conexão. A validação confirmou:

- 17 consultas `SELECT`/CTE;
- nenhuma instrução `INSERT`, `UPDATE`, `DELETE`, `TRUNCATE`, `CREATE`, `ALTER`,
  `DROP`, `GRANT`, `REVOKE`, `CALL`, `DO`, `COPY` ou `MERGE`;
- nenhuma chamada a função da aplicação;
- referências a RPCs somente por consulta a `pg_proc`;
- `BEGIN TRANSACTION READ ONLY` e encerramento alterado de `COMMIT` para
  `ROLLBACK` antes da execução;
- SHA-256 do preflight executado:
  `5B7D503D5E897230AE6170832650459FB38744C1961D316D956D001C6E191C6C`.

## Execução e interrupção

A primeira chamada sem `--linked` foi recusada localmente pela CLI antes de
executar SQL. A chamada corrigida, com vínculo e project ref explícitos,
executou o arquivo completo sem erro SQL e retornou somente o último result set,
limitação do modo Management API da CLI utilizada (`2.115.0`). O único resultado
capturado e confiável foi:

- `supabase_migrations.schema_migrations`: **ausente**.

Para obter os demais result sets sem criar novas consultas, foi tentada a
execução separada dos `SELECT` exatos do preflight. O wrapper `supabase.cmd` no
PowerShell fragmentou os SQLs multilinha enviados como argumento: os três
primeiros retornaram objetos vazios e o quarto chegou incompleto ao servidor,
recebendo erro de sintaxe. O processo parou imediatamente; os blocos seguintes
não foram executados individualmente e nenhuma correção foi aplicada.

O sucesso do arquivo completo indica que as relações/colunas referenciadas
diretamente por `profiles`, `financial_extracted_rows`, `documents`,
`companies` e `financial_extraction_jobs` existiam e eram consultáveis pelo
papel de auditoria. Isso não confirma seus valores, ACLs ou compatibilidade.

## Resultados confirmados

| Item | Resultado |
| --- | --- |
| Projeto alvo | KAWANA `xjxwyzyfnumfphubuize` |
| Modo da transação | `READ ONLY`, encerrada por `ROLLBACK` |
| Alterações remotas | nenhuma |
| Histórico Supabase CLI | tabela `schema_migrations` ausente |
| Dados pessoais/financeiros exportados | nenhum |
| Relações diretamente consultadas | presentes o suficiente para o arquivo completo não falhar |

Não foi possível confirmar de forma confiável nesta execução:

- contagem dos dois administradores e valores atuais de `profiles`;
- owners, RLS, policies, constraints e grants;
- ACLs/hashes das funções financeiras;
- acesso atual ao schema `financial_private`;
- defaults de `postgres` e `supabase_admin`;
- estado efetivo das 13 tabelas auditadas;
- quatro contagens agregadas de inconsistências financeiras.

## Situação das migrations

| Ordem | Migration | Classificação após esta auditoria |
| --- | --- | --- |
| 1 | `20261016120000_create_company_members.sql` | exige verificação adicional |
| 2 | `20261016121000_secure_financial_review_access.sql` | exige verificação adicional |
| 3 | `20261017120000_protect_financial_private.sql` | exige verificação adicional |
| 4 | `20261019120000_harden_profiles_security.sql` | exige verificação adicional |
| 5 | `20261020160000_remove_remaining_public_dashboard_access.sql` | exige verificação adicional |
| 6 | `20261020161000_harden_public_default_privileges.sql` | exige verificação adicional |
| 7 | `20261022120000_revoke_postgres_global_default_function_execute.sql` | exige verificação adicional |

Nenhuma migration foi considerada aplicada ou compatível apenas porque parte do
hardening já foi feita manualmente. A ausência do histórico remoto impede o uso
seguro de `db push` e exige execução futura controlada, individual e registrada.

## Impactos e pendências

- Dashboard/Auth: ainda é necessário confirmar os dois admins ativos, os
  defaults/constraints de `profiles` e as policies consumidas pelo frontend.
- Financeiro: ainda é necessário confirmar as quatro RPCs públicas, as quatro
  implementações privadas e a policy ampla atual de `companies`.
- n8n 03/04: configuração real, credencial efetiva e chamadas continuam não
  comprovadas; nenhuma automação foi executada.
- Backup: backup lógico completo, objetos de Storage e restauração isolada
  continuam obrigatórios antes de qualquer implantação.
- XLSX: integração, 612 fatos, inferência de empresa e reprocessamento continuam
  fora do escopo e bloqueados.

## Próximo passo seguro

Preparar e revisar um transporte que preserve cada consulta aprovada em arquivo
SQL, sem SQL posicional multilinha. Depois de nova autorização, repetir os 17
result sets com project ref explícito e saída sanitizada. Não é necessário nem
seguro modificar o banco para resolver essa limitação de coleta.

## Veredito

**No-Go para avançar à preparação de aplicação das migrations.** A conexão e o
modo somente leitura foram comprovados, e o histórico remoto ausente foi
confirmado, mas faltam os resultados necessários para comparar produção com o
staging. É necessária nova auditoria somente leitura após corrigir e validar o
mecanismo de captura.
