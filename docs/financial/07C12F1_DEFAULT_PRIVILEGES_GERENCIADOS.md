# Etapa 07C.12F.1 — defaults gerenciados e regressão

## Classificação

O contrato separa dois papéis criadores:

- `postgres`: cria os objetos da aplicação. Seus defaults precisam impedir
  privilégios implícitos de `PUBLIC`, `anon` e `authenticated`; grants da API
  devem ser explícitos e combinados com RLS.
- `supabase_admin`: papel interno usado pelo Supabase em upgrades e automações.
  Seus defaults não são alterados pelo projeto sem autorização específica.

No staging, todas as 35 relations e todas as 16 funções de aplicação em
`public` pertencem a `postgres`. Nenhum objeto de aplicação em `public`
pertence a `supabase_admin`, e os scripts versionados não criam objetos nem
transferem ownership para esse papel.

## Exceção gerenciada

Existem 24 entradas schema-specific de `supabase_admin` em `public` para os
papéis `anon` e `authenticated`:

- tabelas: 16 entradas, oito privilégios para cada papel;
- sequences: seis entradas, três privilégios para cada papel;
- funções: duas entradas EXECUTE, uma para cada papel.

A exceção é aceita somente para inventário e monitoramento. Ela volta a ser
bloqueante se mudar, tornar-se global ou se qualquer objeto de aplicação em
`public` passar a pertencer a `supabase_admin`.

Risco residual: o papel gerenciado possui CREATE em `public`; um objeto criado
por ele nesse schema pode herdar permissões amplas. Antes da produção, o
inventário real deve confirmar novamente owners, defaults e ausência de
objetos de aplicação sob esse papel.

## Falha do escopo da aplicação

A suíte criou tabela, sequence e função sintéticas como `postgres`. Tabela e
sequence não concederam acesso a clientes. A função, porém, herdou EXECUTE de
`PUBLIC`, tornando-a executável por `anon` e `authenticated`.

O `REVOKE` por schema da migration `20261020161000` não remove o default global
nativo de funções do PostgreSQL. A correção exige uma migration nova e
aprovada que trate o default global de funções do papel `postgres`, seguida de
regressão de schemas gerenciados e grants explícitos necessários.

## Fontes oficiais

- Supabase descreve `supabase_admin` como papel interno usado em tarefas
  administrativas, upgrades e automações:
  https://supabase.com/docs/guides/database/postgres/roles
- O Supabase informa que consultas do Dashboard e ferramentas externas usam o
  papel `postgres`:
  https://supabase.com/kb/troubleshooting/how-to-interpret-and-explore-the-postgres-logs-OuCIOj
- PostgreSQL documenta que defaults dependem do papel criador efetivo e que um
  REVOKE por schema não remove um privilégio concedido globalmente:
  https://www.postgresql.org/docs/current/sql-alterdefaultprivileges.html

## Veredito

`supabase_admin` está classificado como exceção gerenciada condicionada, mas o
staging permanece reprovado porque novas funções da aplicação criadas por
`postgres` ainda recebem EXECUTE de `PUBLIC`. Nenhuma correção foi aplicada.
