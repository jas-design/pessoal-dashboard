# Etapa 07C.8 — staging e testes de segurança

## Resultado

Os artefatos locais estão preparados para testar as três migrations 07C em um
banco isolado com dados sintéticos. Eles não acessam produção, não contêm
credenciais e não executam `db push`.

O repositório **ainda não recria sozinho o schema KAWANA**. O histórico local
começa depois de vários objetos usados pelas migrations. Portanto, um banco
vazio criado apenas com `supabase db reset` não é uma baseline fiel e deve
falhar no preflight.

## Fonte e dependências comprovadas

Foram usadas as versões locais atuais das migrations:

1. `20261016120000_create_company_members.sql`;
2. `20261016121000_secure_financial_review_access.sql`;
3. `20261017120000_protect_financial_private.sql`.

As oito funções de revisão e as duas RPCs de extração permanecem preservadas em:

- `scripts/supabase/baselines/07c2-current-financial-review-functions.sql`;
- `scripts/supabase/baselines/07c6-current-financial-extraction-rpcs.sql`.

O inventário comprova as colunas e 29 constraints do recorte, RLS ativa nas
tabelas financeiras, ausência de triggers nessas tabelas, corpos/owners/ACLs
das dez RPCs e `PRIMARY KEY (document_id)` em
`financial_review_document_policy`.

## DDL ainda ausente

Não há evidência suficiente para versionar uma criação fiel dos seguintes
elementos:

- DDL completo de `profiles` e suas integrações com `auth.users`;
- `CREATE TABLE` histórico completo das tabelas financeiras e `documents`;
- owners, comentários e todos os grants de tabela/coluna;
- índices não originados por PK/UNIQUE;
- policies de `profiles` e policies fora do recorte A–C;
- extensões e funções auxiliares necessárias antes das baselines;
- versão exata do PostgreSQL remoto além do valor que deve ser conferido pelo
  preflight; o `config.toml` local está configurado para PostgreSQL 17.

Colunas + constraints não substituem um schema-only dump. Não foi criado DDL
estimado para preencher essas lacunas.

## Ambiente recomendado

Preferência: projeto Supabase separado e descartável, sem rede ou credenciais
compartilhadas com produção. Alternativa: Supabase CLI local, desde que receba a
mesma baseline schema-only. PostgreSQL puro não é equivalente, pois os testes
dependem de `auth.uid()`, papéis `anon`/`authenticated`/`service_role` e RLS.

Antes do teste, obter por processo administrativo um export **somente de
schema**, sem linhas, objetos de Storage, usuários, tokens ou secrets. Revisar o
arquivo fora do Git para remover eventuais defaults/comentários sensíveis. Uma
branch/clone gerenciado também é aceitável se iniciar sem dados reais.

Criar sete identidades Auth inteiramente sintéticas no projeto isolado:

- `owner_a`, `owner_b`, `admin_a`, `reviewer_a`, `viewer_a`, `unlinked`;
- `global_admin`, com perfil sintético `role=admin` e `status=active`.

Os UUIDs são parâmetros em tempo de execução. Não os grave no repositório nem
use identidades reais.

## Ordem segura

1. Criar/restaurar o banco isolado sem dados.
2. Se necessário, restaurar as baselines comprovadas das dez funções.
3. Executar `00-preflight.sql`; qualquer erro interrompe o ensaio.
4. Tirar snapshot/branch point do banco descartável.
5. Aplicar as três migrations locais, exatamente na ordem acima.
6. Executar `30-postflight.sql`.
7. Criar os sete usuários sintéticos via Supabase Auth e confirmar seus perfis.
8. Executar `10-synthetic-fixtures.sql` via `psql`, passando os sete UUIDs e
   `-v confirm_isolated_staging=07C8_SYNTHETIC_ONLY`.
9. Executar `20-security-tests.sql` com os mesmos parâmetros.
10. Executar `90-cleanup.sql` e excluir manualmente os usuários sintéticos.

Cada migration já usa sua própria transação. O conjunto das três não é uma
única transação porque cada arquivo contém `COMMIT`; por isso o snapshot anterior
ao passo 5 é obrigatório para recuperação integral do ensaio.

Exemplo para o Supabase local, sem credenciais versionadas:

```powershell
psql -X -h 127.0.0.1 -p 54322 -U postgres -d postgres `
  -v ON_ERROR_STOP=1 `
  -f scripts/supabase/staging/07c8/00-preflight.sql
```

Para projeto separado, use um `PGSERVICE`/secret manager configurado fora do
repositório. Não passe senha na linha de comando, não use credenciais de
produção e não salve a URL em arquivos do projeto.

Os parâmetros `-v owner_a_id=...` etc. devem ser acrescentados somente no
terminal local ao executar fixtures/testes. Não use o SQL Editor para esses dois
arquivos porque eles dependem das variáveis do `psql`.

## Matriz automatizada

| Caso | Resultado esperado |
|---|---|
| anon | sem EXECUTE nos wrappers; sem empresas; zero documentos via RLS |
| sem vínculo | zero empresas e zero linhas de revisão |
| owner A/B | acesso apenas à própria empresa; decide e classifica |
| admin empresarial | vê, decide e classifica apenas a empresa vinculada |
| reviewer | vê e decide; não classifica |
| viewer | somente vê |
| admin global sem vínculo | mantém acesso geral a documents; zero poder financeiro |
| schema privado | nenhum papel de API possui USAGE/EXECUTE direto |
| divergência document/row | owner vê diagnóstico, mas decisão é bloqueada |
| arquivo `TESTE_` | aprovação bloqueada |
| ETag/revisão | ETag preservada, revisão otimista e auditoria incrementadas |
| extração | authenticated negado; service_role faz claim/complete públicos |
| limite | claim aceita 8 MiB e ignora o fixture mais novo de 8 MiB + 1 byte |
| piloto | `true` escolhe `TESTE_`; `false` ignora documento sem company_id |

O teste de aprovação acontece somente em transação e sofre `ROLLBACK`; as
fixtures não alimentam métricas publicadas. Os 612 fatos XLSX não fazem parte
destes dados e nunca são tratados como transações.

## Riscos não resolvidos por 07C

- `finance_complete_document` ainda infere `company_id` por nome quando o
  documento não tem empresa;
- o `ON CONFLICT` ainda pode recolocar linha decidida em `pending_review`;
- a RPC legada aceita somente `receita`/`despesa` e não representa
  `financial-extraction.v1`;
- claim limita a 8 MiB enquanto o worker aceita 25 MiB;
- workflow 04, autenticação efetiva, IDs e retries continuam sem export
  sanitizado comprovado.

Esses riscos bloqueiam o ensaio end-to-end n8n/XLSX, mas não o teste isolado das
três migrations 07C.

## Rollback

O rollback SQL existente é deliberadamente parcial: restaura wrappers invoker,
acesso privado de `authenticated`, policy ampla de companies e grants
inventariados. Ele não remove `company_members`, helpers, vínculos ou todos os
efeitos posteriores. A baseline das oito funções também restaura ACLs legadas
menos seguras.

Para staging, a recuperação integral é restaurar o snapshot/branch point ou
recriar o banco descartável. O rollback parcial deve ser testado apenas como
compatibilidade emergencial, seguido das baselines comprovadas quando isso fizer
parte do cenário aprovado.

## Veredito

**Artefatos prontos; ambiente ainda condicionado à baseline.** As migrations
estão prontas para teste em staging somente depois que um schema-only fiel e
sem dados passar no preflight. Um staging vazio criado apenas pelo histórico
local não está pronto. Nenhuma aplicação remota foi executada.
