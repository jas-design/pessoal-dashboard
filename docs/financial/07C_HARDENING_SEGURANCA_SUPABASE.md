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

## Baseline: parte bloqueada

Não foi criada uma baseline dos objetos financeiros preexistentes. Os resultados
07B fornecidos confirmam existência e riscos, mas o repositório ainda não contém
as definições reais completas de tabelas, índices, constraints, triggers,
policies, owners, ACLs e corpos originais das oito funções.

Inventar esse DDL tornaria o histórico aparentemente reproduzível, mas incorreto.
O script `scripts/supabase/07c-financial-hardening-preflight.sql` contém as
consultas de leitura necessárias. Precisamos preservar, em local restrito, as
seções:

- `required_columns`, `target_constraints`, `target_indexes` e `target_triggers`;
- `companies_policies` e `target_table_security`;
- `financial_private_schema` e `financial_private_contents`;
- `review_function_definitions`;
- `data_readiness_counts` e `migration_history`.

Somente depois dessas definições serem revisadas será seguro criar a baseline e
um rollback completo dos corpos antigos das RPCs.

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
hardening, elas verão apenas empresas possuídas ou vinculadas. Usuários não
owners que hoje dependem da policy `USING (true)` perderão visibilidade até que
um owner crie o vínculo explicitamente; não haverá backfill automático.

### n8n

`service_role` mantém acesso ao schema e às implementações privadas. Os wrappers
públicos mantêm nomes, argumentos e retorno. Ainda é obrigatório confirmar se o
workflow 04 usa `service_role`/wrappers ou se opera como `authenticated` e chama
`financial_private` diretamente. Essa informação não está no repositório e não
pode ser inferida do catálogo do banco.

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
7. Sem os corpos antigos das RPCs, o rollback não consegue restaurar uma versão
   anterior das implementações; por isso a baseline continua bloqueadora para
   implantação em produção.

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

O rollback integral das implementações privadas permanece bloqueado até os
corpos reais anteriores serem arquivados. Não aplicar em produção enquanto essa
lacuna existir.

## Aprovações e informações ainda necessárias

1. Saída integral do preflight 07C, especialmente definições das funções e ACLs.
2. Confirmação de que o owner técnico das funções/schema é confiável e comum.
3. Confirmação de que os wrappers apenas delegam para as quatro implementações.
4. Papel e chamadas reais usados pelo workflow 04.
5. Lista de usuários que deverão receber vínculo, definida pelos owners; nenhuma
   atribuição será feita automaticamente.
6. Aprovação da semântica: reviewer decide, viewer só lê e admin global não tem
   bypass.
7. Aprovação do rollback emergencial que reabre temporariamente o acesso antigo.
8. Aprovação separada para criar a baseline e, depois, aplicar migrations.
