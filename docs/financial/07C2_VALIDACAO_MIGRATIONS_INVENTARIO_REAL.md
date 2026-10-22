# Etapa 07C.2 — validação das migrations contra o inventário real

> Relatório histórico. Os blocos pendentes A–C e F–H foram recebidos e a
> conclusão atual está em `07C4_REVISAO_FINAL_SEGURANCA_SUPABASE.md`.

## Evidência analisada

Foram lidos localmente, sem executar SQL remoto, os quatro CSVs mantidos fora
do Git em `.local/supabase/07c/`: 102 metadados de colunas, 29 constraints, 12
registros de privilégios das funções privadas e oito definições completas de
funções.

O inventário comprova:

- `financial_review_document_policy` possui `PRIMARY KEY (document_id)` e FK
  para `documents(id) ON DELETE RESTRICT`;
- as quatro funções públicas e as quatro implementações privadas têm as
  assinaturas usadas pelas migrations e owner `postgres`;
- os wrappers públicos são `SECURITY INVOKER`, têm `search_path=""` e delegam
  por nome qualificado à implementação privada correspondente;
- os wrappers permitem `EXECUTE` a `anon`, `authenticated` e `service_role`;
- as implementações privadas são `SECURITY DEFINER`, têm `search_path=""` e
  permitem `EXECUTE` somente a `authenticated` entre os papéis de API;
- `service_role` e `anon` não possuem execução direta nas implementações;
- `documents.company_id` é `uuid`, aceita nulo e referencia `companies(id)` com
  `ON DELETE SET NULL`;
- a constraint de métrica em `financial_extracted_rows` aceita somente
  `receita` e `despesa`.

Os corpos inventariados não contêm segredos ou endpoints. Eles foram preservados
como snapshot DDL em
`scripts/supabase/baselines/07c2-current-financial-review-functions.sql`.
Esse arquivo não é migration e restaura somente funções, owners e ACLs
comprovados.

## Incompatibilidades confirmadas e correções locais

1. `20261017120000_protect_financial_private.sql` esperava `proconfig` nulo,
   mas os wrappers reais já possuem `search_path=""`. O guard agora exige
   exatamente esse valor.
2. A versão original da mesma migration concedia acesso privado direto a
   `service_role`, ampliando o estado real. Ela agora revoga acesso privado de
   todos os papéis de API; `service_role` permanece restrito aos wrappers
   públicos após estes se tornarem `SECURITY DEFINER`.
3. A migration intermediária de RPCs também concedia execução privada direta a
   `service_role`. O grant temporário agora é somente para `authenticated`, que
   já possui esse acesso no banco real.
4. As RPCs propostas autorizavam pela empresa da linha sem exigir igualdade
   com `documents.company_id`. A migration agora bloqueia decisão e
   classificação em divergência, e só permite membros verem linhas coerentes.
   O proprietário preserva leitura das próprias linhas divergentes para que a
   inconsistência possa ser diagnosticada; as ações sensíveis ficam bloqueadas.
5. A policy ampla de `companies` pode ser substituída, mas `documents` ainda
   possui caminhos baseados em `is_admin()`. Portanto, alterar apenas
   `companies` não elimina acesso transversal fora das RPCs financeiras.
6. Não existe histórico `supabase_migrations.schema_migrations`. `db push` não
   deve ser usado até haver reconciliação explícita das versões já presentes.

A versão anterior da migration privada permanece em
`scripts/supabase/archive/20261017120000_protect_financial_private.pre-07c2.sql`.
A versão anterior da migration de RPCs continua recuperável no `HEAD` do Git;
nenhuma migration foi aplicada.

## Compatibilidade

- As assinaturas e os formatos JSON públicos não foram alterados.
- ETag, revisão otimista, bloqueio de arquivo `TESTE_`, exigência de fonte
  primária e auditoria continuam presentes.
- Documentos sem empresa continuam sob controle do proprietário. Aprovação
  exige empresa; rejeição permanece possível ao proprietário quando documento
  e linha estiverem ambos sem empresa.
- O Dashboard continua consumindo os mesmos quatro wrappers.
- Nenhuma mudança foi feita no n8n. O `service_role` não ganha acesso ao schema
  privado e, após a terceira migration, só tem o wrapper público como entrada.
  As implementações ainda exigem `auth.uid()`; uma chamada com service key sem
  contexto de usuário será negada. O papel e a chamada real do workflow 04
  continuam pendentes e podem ser incompatíveis.
- Os 612 fatos XLSX não são migrados para `financial_transactions` nem para
  outro domínio restrito a receita/despesa.

## Baseline comprovada e limites

A baseline versionada cobre exatamente os oito corpos de funções, seus owners e
ACLs observados. Ela pode apoiar comparação e recuperação dessa camada, mas não
é uma baseline completa do banco.

Ainda faltam definições suficientes para versionar com fidelidade:

- owners e ACLs dos schemas, em especial `financial_private`;
- DDL integral, owners, defaults, índices, grants e policies das tabelas;
- definição de `public.is_admin()` e de outras funções encontradas pelo
  inventário transversal;
- resultado efetivo de privilégios de tabelas;
- nomes e expressões completos das policies que usam `is_admin()`;
- contagens de divergência entre owner/empresa de documento, linha, job e
  empresa.

Por isso não devem ser inventadas baselines de tabelas, policies ou schemas.

## Resultados ainda necessários

Executar separadamente e exportar os blocos de
`scripts/supabase/07c2-pending-access-inventory.sql`:

1. Bloco A — privilégios efetivos do antigo Bloco 7;
2. Bloco B — policies financeiras e referências a `is_admin()`;
3. Bloco C — outras funções/RPCs com acesso transversal;
4. Bloco F — somente contagens agregadas de divergências;
5. Bloco G — owner e ACL efetiva do schema privado;
6. Bloco H — definição, owner e ACL de `public.is_admin()`.

Os blocos D e E já estão materialmente cobertos pelos CSVs B04/B08, mas podem
ser mantidos para uma exportação autocontida. Também falta o resultado do bloco
de owner/ACL do schema `financial_private` do preflight original, porque a
terceira migration exige o mesmo owner confiável das funções.

## Estratégia segura de implantação e versionamento

1. Obter os resultados pendentes e revisar todo caminho transversal.
2. Criar staging a partir de schema reconciliado e dados exclusivamente
   sintéticos.
3. Registrar uma baseline administrativa das versões já existentes sem
   reaplicar DDL legado; não usar `db push` para descobrir o estado.
4. Aplicar em staging as três migrations, em ordem e numa janela controlada.
5. Testar isolamento, contratos, ACLs e rollback antes de aprovar produção.
6. Em produção, aplicar somente por procedimento manual aprovado, com captura
   de catálogo anterior e posterior.

## Testes de staging

Com empresas A/B e usuários sintéticos:

1. owner A acessa seus registros A e documentos sem empresa, mas não B;
2. admin A vê/decide/classifica A e não acessa B;
3. reviewer A vê/decide A, não classifica e não acessa B;
4. viewer A somente visualiza A;
5. usuário sem vínculo e admin global sem vínculo não acessam A/B;
6. `anon` não executa wrappers nem lê objetos financeiros;
7. chamadas privadas diretas falham para `anon`, `authenticated` e
   `service_role`; wrappers funcionam para os papéis explicitamente autorizados;
8. divergência empresa-documento-linha é invisível para membro e bloqueia
   decisão/classificação inclusive para owner, mantendo leitura de diagnóstico;
9. UUID de B não revela diferença entre inexistente e não autorizado;
10. ETag divergente, revisão antiga, documento excluído, fonte não primária e
    arquivo `TESTE_` permanecem bloqueados;
11. decisão válida gera uma auditoria e retry com revisão antiga não duplica;
12. formatos JSON e paginação continuam compatíveis com o Dashboard;
13. nenhuma das 612 linhas XLSX é convertida para `financial_transactions`.

## Rollback

`scripts/supabase/07c-financial-hardening-rollback.sql` é rollback parcial e
emergencial: reabre a policy ampla de `companies`, restaura acesso privado de
`authenticated` e devolve os wrappers a `SECURITY INVOKER`. Ele não desfaz toda
a camada 07C nem restaura dados.

O snapshot das oito funções permite recuperar seus corpos, owners e ACLs
confirmados, mas também restaura o legado inseguro, inclusive `anon` nos
wrappers. Só deve ser considerado após teste em staging e aprovação explícita.
Não há rollback integral comprovado para tabelas, policies, schema ACLs ou
`company_members` enquanto as evidências listadas acima estiverem ausentes.

## Veredito

**Ainda não pronto para aplicar em staging.** As incompatibilidades comprovadas
nas funções e migrations foram corrigidas localmente e a baseline funcional é
fiel aos oito corpos inventariados. Permanecem bloqueadores objetivos: Bloco 7,
acessos transversais por `is_admin()`/outras RPCs, owner do schema privado e
contagens de divergência. Após esses resultados, o conjunto pode seguir para
ensaio controlado em staging; produção continua fora de escopo.
