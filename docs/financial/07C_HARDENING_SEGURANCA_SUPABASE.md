# Etapa 07C — hardening de segurança financeira do Supabase KAWANA

## Resultado preparado

Esta etapa prepara SQL versionado no repositório, sem executar migrations. A
proposta mantém a UI de revisão somente leitura e não altera n8n, dados,
proprietários ou vínculos reais.

Arquivos de aplicação propostos, na ordem:

1. `20261016120000_create_company_members.sql`;
2. `20261016121000_secure_financial_review_access.sql`;
3. `20261017120000_protect_financial_private.sql`.

O primeiro cria autorização explícita por empresa e substitui a policy ampla de
`companies`. O segundo mantém ETag, revisão otimista, bloqueio `TESTE_`,
auditoria e acrescenta `can_view`, `can_decide` e `can_classify` à listagem. O
terceiro converte os wrappers públicos para `SECURITY DEFINER` com
`search_path` vazio antes de retirar o acesso direto de `authenticated` ao
schema privado.

## Baseline: funções comprovadas, restante bloqueado

A Etapa 07C.2 adicionou
`scripts/supabase/baselines/07c2-current-financial-review-functions.sql` com as
oito definições reais, owners e ACLs comprovados pelos CSVs locais. Esse snapshot
não é migration e não constitui baseline completa do banco. Ainda faltam as
definições reais completas de tabelas, índices, policies, owners e ACLs dos
schemas.

Inventar esse DDL tornaria o histórico aparentemente reproduzível, mas incorreto.
O script `scripts/supabase/07c-financial-hardening-preflight.sql` contém as
consultas de leitura necessárias. Precisamos preservar, em local restrito, as
seções:

- `required_columns`, `target_constraints`, `target_indexes` e `target_triggers`;
- `companies_policies` e `target_table_security`;
- `financial_private_schema` e `financial_private_contents`;
- `review_function_definitions`;
- `data_readiness_counts` e `migration_history`.

Somente depois das definições pendentes serem revisadas será seguro completar a
baseline e o rollback de toda a camada de acesso.

## Modelo de autorização

`companies.owner_id` continua sendo a fonte única do papel `owner`. A tabela
`company_members` armazena apenas papéis delegados `admin`, `reviewer` e
`viewer`; não existe um segundo owner concorrente.

| Papel efetivo | Visualizar | Decidir | Classificar fonte |
| --- | --- | --- | --- |
| owner | sim | sim | sim |
| admin da empresa | sim | sim | sim |
| reviewer | sim | sim | não |
| viewer | sim | não | não |
| sem vínculo | não | não | não |
| admin global sem vínculo | não | não | não |
| anon | não | não | não |

Todas as capacidades derivam de `auth.uid()` no banco. IDs enviados pelo
browser apenas restringem a consulta; nunca concedem autoridade.

Documentos/linhas sem empresa permanecem visíveis somente ao proprietário. O
proprietário pode rejeitar uma linha pendente e classificar o uso do próprio
documento, mas aprovação continua bloqueada até existir empresa válida e fonte
primária. Nenhuma associação é inferida pelo nome extraído.

## Compatibilidade

### Astro

A RPC `finance_review_list` preserva os campos existentes e acrescenta três
booleanos. O service atual ignora campos extras, portanto a mudança é aditiva.
A interface continua sem chamar decisão ou classificação até uma etapa própria
validar o contrato e os motivos de bloqueio.

As telas Financeiro e Configurações consultam `companies` diretamente. Após o
hardening, usuários comuns verão apenas empresas possuídas ou vinculadas;
administradores globais ativos preservam a visibilidade administrativa de
metadados por `is_admin()`. Essa visibilidade não concede acesso às RPCs de
revisão financeira, que continuam exigindo owner ou vínculo empresarial.
Não haverá backfill automático de vínculos.

### n8n

`service_role` não recebe acesso direto ao schema ou às implementações privadas;
o inventário real confirma que ele já não possui esse acesso. Após o hardening,
chamadas autorizadas devem passar pelos wrappers públicos, que mantêm nomes,
argumentos e retorno. Como as implementações exigem `auth.uid()`, uma service
key sem contexto de usuário não consegue usar essas RPCs apenas por possuir o
papel `service_role`. Ainda é obrigatório confirmar o papel e as chamadas reais
do workflow 04. Essa informação não está no repositório e não pode ser inferida
dos quatro CSVs disponíveis.

`financial_transactions` foi deliberadamente excluída da alteração: suas
policies e consumidores reais ainda precisam ser capturados. A migration não
substitui uma policy desconhecida.

## Proteções preservadas

- autenticação obrigatória e mensagens que não revelam linhas de outra empresa;
- coerência entre owner do documento, linha e empresa;
- bloqueio de documento excluído e ETag divergente;
- comparação de `review_revision` com lock da linha;
- proibição de aprovar arquivo `TESTE_`;
- exigência de empresa ativa e fonte primária para aprovação;
- registro do ator, motivo, valores, ETag e snapshot em auditoria;
- bloqueio de reclassificação quando já existem linhas aprovadas;
- RLS sem policies em auditoria/policy interna, mantendo acesso direto negado.

## Riscos e guardas

1. As migrations abortam se `companies`, UUIDs esperados, policy ampla, funções,
   owners ou delegação dos wrappers divergirem do preflight.
2. `SECURITY DEFINER` nos wrappers só é seguro porque as implementações validam
   `auth.uid()` e os wrappers são obrigados a delegar para nomes qualificados.
3. O owner dos wrappers, implementações e schema privado deve ser o mesmo papel
   confiável. `anon`, `authenticated` e `service_role` são rejeitados como owner.
4. A retirada de `USAGE` ocorre depois da conversão dos quatro wrappers, na mesma
   transação. Não existe `REVOKE` isolado.
5. `can_decide` indica que alguma decisão é possível. Para linha sem empresa, o
   backend ainda permite somente rejeição; aprovação continua validada pela RPC.
6. O rollback de acesso restaura a exposição anterior e, portanto, reduz a
   segurança. É apenas uma medida emergencial aprovada.
7. Os corpos antigos das RPCs já estão preservados, mas o rollback de tabelas,
   policies e ACLs de schema continua incompleto; a baseline completa permanece
   bloqueadora para produção.

## Sequência segura de implantação

1. Executar o preflight somente leitura e revisar todas as divergências.
2. Confirmar o papel usado pelo workflow 04 e todas as chamadas ao schema
   `financial_private`.
3. Gerar e revisar a baseline real e o rollback integral das funções atuais.
4. Testar as três migrations em clone/staging com dados sintéticos.
5. Criar vínculos sintéticos explicitamente; nunca copiar ou inferir membros.
6. Aplicar as migrations na ordem indicada, em janela controlada.
7. Verificar RPCs públicas, acesso do n8n e páginas Astro mantendo a UI read-only.
8. Executar a matriz de acesso e somente então liberar o ambiente.

## Matriz de testes

Usar duas empresas sintéticas A/B, owner A/B e usuários separados. Toda alteração
de teste deve ocorrer em ambiente isolado ou dentro de transação revertida.

1. `anon`: não executa RPCs nem lê empresas/tabelas financeiras.
2. sem vínculo: não vê A/B nem descobre linha/histórico por UUID conhecido.
3. owner A: vê/decide/classifica A e não acessa B.
4. admin A: vê/decide/classifica A e não acessa B.
5. reviewer A: vê/decide A, não classifica e não acessa B.
6. viewer A: apenas vê A; decisão/classificação são negadas.
7. admin global sem vínculo: permanece sem acesso financeiro.
8. linha sem empresa: apenas owner visualiza/rejeita; aprovação é negada.
9. ETag divergente, revisão antiga, documento excluído e `TESTE_` bloqueiam as
   operações correspondentes.
10. chamada direta a cada `financial_private.*_impl` por `authenticated` falha,
    enquanto o wrapper público correspondente continua funcionando.
11. auditoria é criada pela RPC, mas não pode ser lida diretamente.
12. usuário de A usando IDs de B recebe negação sem diferença observável entre
    UUID inexistente e UUID não autorizado.
13. inserção/alteração/remoção de membro só é aceita para owner da empresa.
14. repetição com `review_revision` antiga não produz segunda decisão/auditoria.

## Rollback

`scripts/supabase/07c-financial-hardening-rollback.sql` restaura primeiro o
acesso privado necessário e só depois retorna os wrappers a `SECURITY INVOKER`.
Também restaura semanticamente a policy ampla de `companies`. Ele não remove
`company_members`, vínculos ou auditoria.

O snapshot das oito funções pode restaurar seus corpos e ACLs comprovados, mas
também restaura exposições legadas, inclusive `anon` nos wrappers. Não aplicar
em produção enquanto o restante da camada de acesso não tiver baseline e teste
de rollback em staging.

## Aprovações e informações ainda necessárias

1. Export/configuração sanitizada do workflow 04 e papel efetivo das chamadas.
2. Transformação real entre `financial-extraction.v1` e
   `finance_complete_document`.
3. Destino aprovado para evidências XLSX que não cabem no domínio limitado a
   receita/despesa.
4. Aprovação da regra que elimina inferência automática de empresa por nome e
   torna snapshots do mesmo ETag imutáveis.
5. Lista de usuários que deverão receber vínculo, definida pelos owners; nenhuma
   atribuição será feita automaticamente.
6. Aprovação da semântica: reviewer decide, viewer só lê e admin global não tem
   bypass.
7. Aprovação do rollback emergencial que reabre temporariamente o acesso antigo.
8. Aprovação separada para completar a baseline e, depois, testar migrations.
