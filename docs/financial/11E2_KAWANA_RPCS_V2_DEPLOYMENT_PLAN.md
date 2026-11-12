# ETAPA 11E.2 — implantação manual das RPCs financeiras v2 no KAWANA

## Decisão atual

**NO-GO temporário.** As duas RPCs estão confirmadamente ausentes e o documento
`7aa10025-751f-4d8a-947d-5decf1e1dc2d` está associado à Kawana, mas ainda não há
evidência remota suficiente para provar todas as colunas, constraints, ACLs,
RLS e o estado financeiro legado exigidos pelas migrations.

O GO só pode ser emitido após executar no KAWANA, sem adaptações, o script
`scripts/supabase/11d-kawana-v2-readonly-preflight.sql` e revisar todos os
result sets.

## Dependências confirmadas

- `finance_complete_document_v2` está ausente no KAWANA.
- `finance_claim_document_v2` está ausente no KAWANA.
- O documento real está associado à empresa Kawana.
- O catálogo OneDrive está operacional.
- No repositório, a migration de persistência v2 é aditiva para os dados:
  adiciona três colunas, substitui dois checks, adiciona quatro checks, cria um
  índice parcial e cria uma nova RPC. Não contém `DELETE`, `TRUNCATE` ou
  alteração de `documents`/`onedrive_folders`.
- No repositório, a migration de claim cria apenas a nova RPC e sua ACL. Ela
  não altera tabelas nem as RPCs do catálogo OneDrive.
- As duas RPCs são `SECURITY INVOKER`, têm `search_path = public`, revogam
  `PUBLIC`, `anon`, `authenticated` e `service_role`, e então concedem somente
  `EXECUTE` a `service_role`.
- `finance_complete_document` v1 permanece intacta; a v2 tem outro nome.
- Nenhum arquivo de workflow é alterado por essas migrations. O workflow 04
  original não está versionado em `n8n/workflows/`, portanto sua igualdade com
  o remoto não pode ser comprovada pelo repositório; a implantação não deve
  importar, editar, ativar ou executar workflows.

## Dependências remotas pendentes

O preflight deve comprovar:

1. Roles `anon`, `authenticated` e `service_role`.
2. Tabelas `companies`, `documents`, `onedrive_folders`,
   `financial_extraction_jobs` e `financial_extracted_rows`.
3. Todas as colunas e tipos consumidos pelas funções, principalmente
   `documents.period_year`, `documents.period_month`, `documents.source_etag`,
   `financial_extraction_jobs.claimed_at` e as colunas de auditoria do job.
4. `financial_extraction_jobs` com chave/unique em `document_id`, necessária
   para `ON CONFLICT (document_id)`.
5. Existência e definição exata dos checks
   `financial_extracted_rows_metric_check` e
   `financial_extracted_rows_amount_check`, que serão substituídos.
6. RLS habilitado em `financial_extracted_rows` e inventário de policies/RLS
   nas tabelas relacionadas.
7. RPC v1
   `finance_complete_document(uuid,uuid,text,text,jsonb,text,text)` presente.
8. `gen_random_uuid()` disponível.
9. ACLs atuais das RPCs e grants de tabela necessários ao `service_role` sob
   `SECURITY INVOKER`.
10. Ausência das três colunas v2 e do índice v2. Qualquer estado parcial exige
    migration corretiva própria; não se deve editar/reexecutar a migration.
11. Zero linhas existentes com métrica fora do conjunto aceito pela v2 ou
    valor negativo incompatível com o novo check.
12. No documento real: empresa ativa e mesmo owner, ETag presente, provider
    `onedrive`, `pending`, não excluído, XLSX de 1 a 8 MiB, caminho sob
    `/drive/root:/Deskboard KPIs`, competência correta, IDs externos presentes,
    nenhum fato existente para o mesmo documento/ETag e nenhum claim terminal
    ou ativo impeditivo.

## Scripts forward-only para revisão

Aplicar exatamente, um por vez, no SQL Editor do projeto KAWANA:

1. `supabase/migrations/20261028120000_financial_extraction_persistence_v2.sql`
2. `supabase/migrations/20261102120000_financial_deterministic_document_claim.sql`

Cada arquivo abre uma transação e só faz `COMMIT` ao final. Não concatenar os
dois arquivos, não usar `db push`, `db reset` ou `migration repair`, e não
adaptar nomes de objetos durante a execução. Salvar o resultado de cada etapa.

## Ordem mínima de implantação

1. Janela sem execução do piloto financeiro; não pausar o catálogo OneDrive.
2. Executar o preflight read-only e registrar contagens/definições.
3. Emitir GO apenas se todas as dependências estiverem compatíveis e ambas as
   RPCs v2 continuarem ausentes.
4. Aplicar a migration de persistência v2.
5. Executar o postflight read-only e confirmar colunas, checks, índice, ACL da
   completion v2, preservação das linhas v1 e contagem de pastas OneDrive.
6. Aplicar a migration de claim determinístico.
7. Reexecutar o postflight e confirmar as duas RPCs, ambas somente para
   `service_role`.
8. Somente em etapa posterior e com autorização separada, testar o fluxo real.
   O caminho mais curto é claim do UUID aprovado -> download controlado pelo
   workflow piloto v2 -> worker XLSX -> completion v2 -> quatro fatos com job
   em `needs_review`. Não publicar, aprovar ou executar o workflow 04.

## Idempotência e dados existentes

- As migrations são transacionais e falham fechadas, mas não são reexecutáveis
  por desenho. Uma segunda execução deve falhar no preflight/`CREATE FUNCTION`.
- A migration de persistência não apaga linhas. Linhas existentes recebem
  `contract_version = 1`; `logical_key` e `source_cell` ficam nulos.
- O índice v2 é parcial (`logical_key is not null`), portanto não conflita com
  linhas legadas normais.
- Retentativa idêntica da completion v2 é no-op para fatos; retentativa com o
  mesmo `logical_key` e conteúdo divergente falha. Revisões já aprovadas ou
  rejeitadas não são revertidas para pendentes.
- O claim v2 rejeita documento/ETag que já possua fatos. Claims falhos ou
  expirados têm no máximo três tentativas; claims ativos não são substituídos.

## Riscos específicos

- `ALTER TABLE` e recriação dos checks adquirem lock e validam todas as linhas;
  volume grande ou transação concorrente pode aumentar a janela de bloqueio.
- Nome ou definição divergente dos dois checks faz a migration falhar.
- Dados legados incompatíveis com os novos checks fazem todo o primeiro script
  reverter.
- Estado parcial anterior (alguma coluna v2 existente sem a RPC) bloqueia a
  migration e exige uma nova migration corretiva forward-only.
- `SECURITY INVOKER` exige grants de tabela adequados ao `service_role`; grant
  de `EXECUTE` sozinho não corrige ACL de tabela divergente.
- O claim exige `processing_status = 'pending'`, competência, ETag, tamanho,
  extensão e caminho exatos. Associação à empresa, sozinha, não prova
  elegibilidade.
- Aplicar a migration de claim antes da persistence v2 falha por dependência da
  completion v2.
- A configuração local/Hostinger versionada do worker aceita 25 MiB, enquanto
  o claim v2 aceita no máximo 8 MiB. O documento piloto precisa estar abaixo de
  8 MiB; a divergência deve ser reconciliada em etapa própria antes de ampliar
  o escopo. Ela não autoriza alterar o worker nesta implantação de banco.

## Recuperação

- Falha durante qualquer script antes do `COMMIT`: a transação reverte DDL e
  ACLs; registrar o erro e parar.
- Falha após o primeiro `COMMIT`: não desfazer com SQL ad hoc e não remover
  colunas/índice, pois isso poderia destruir proveniência futura. Manter a
  persistence v2 instalada, investigar e criar migration corretiva
  forward-only para a segunda etapa.
- Falha após ambos os commits, antes de uso: revogar `EXECUTE` de
  `service_role` por uma migration corretiva é o mecanismo de contenção menos
  destrutivo. Não apagar fatos nem restaurar dump sobre `documents`.
- Se a função já tiver sido usada, preservar jobs e fatos. Corrigir por nova
  migration e revalidar; nunca fazer rollback destrutivo de dados financeiros.

## Critério de GO

GO somente quando o preflight provar todas as dependências, não houver estado
parcial nem dados incompatíveis, o documento real satisfizer integralmente o
contrato de claim e houver janela operacional para o lock da primeira
migration. O teste local de limite do worker também deve ser aceito formalmente
como limitação do piloto ou corrigido em etapa separada. Até receber essa
evidência do KAWANA, a decisão permanece **NO-GO**.
