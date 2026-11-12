# ETAPA 11E.4 — implantação da persistência financeira v2 no KAWANA

## Veredito

**NO-GO operacional enquanto não houver evidência de backup recuperável.**

O banco recebeu **GO técnico** para a migration de persistência v2:

- 105 verificações remotas foram executadas;
- os 82 gates objetivos retornaram PASS;
- as 23 linhas de inventário retornaram INFO;
- não houve FAIL;
- os quatro fatos existentes são compatíveis com os novos checks;
- a RPC v2 e os três campos v2 estão ausentes, como exigido antes da migration.

O preflight não verifica backups. A implantação só muda para **GO operacional**
quando um operador autorizado registrar o gate de backup abaixo. Não acessar
tokens ou copiar credenciais para a evidência.

## Único arquivo autorizado

Aplicar sem alterações:

supabase/migrations/20261028120000_financial_extraction_persistence_v2.sql

SHA-256:

10D01DB24CC47662780F9312B5D5D0E44D8BB0B54E9B55332ADC8570E632EC8C

Não concatenar ou aplicar a migration
20261102120000_financial_deterministic_document_claim.sql.

## Comparação do preflight com o contrato

Os 82 PASS cobrem os bloqueios executáveis da migration:

1. tabelas, roles, colunas e tipos consumidos pela RPC;
2. RPC v1 e funções PostgreSQL das quais a migration depende;
3. nomes dos dois checks que serão substituídos;
4. chave única válida para ON CONFLICT (document_id);
5. RLS habilitado nas tabelas privadas;
6. grants efetivos de tabela para service_role;
7. ausência das três colunas, índice e RPC v2;
8. zero métricas legadas incompatíveis;
9. zero valores negativos incompatíveis com o novo check;
10. elegibilidade do documento piloto e ausência de fatos anteriores.

As 23 linhas INFO são inventários de constraints, policies, triggers, grants e
contagens. Elas não representam falhas. As contagens remotas de referência são:

- documents: 5226;
- onedrive_folders: 1188;
- financial_extracted_rows: 4.

## Impacto exato

A migration:

- adiciona logical_key text e source_cell text, ambas anuláveis;
- adiciona contract_version smallint not null default 1;
- substitui os checks de métrica e sinal;
- adiciona quatro checks de proveniência v2;
- cria um índice único parcial por documento, ETag e chave lógica;
- cria finance_complete_document_v2;
- deixa a nova RPC como SECURITY INVOKER, search_path = public e executável
  somente por service_role.

Os quatro fatos atuais recebem contract_version = 1; logical_key e source_cell
permanecem nulos. Não existe INSERT, UPDATE, DELETE ou TRUNCATE executado pela
migration.

A migration não contém DDL para:

- documents;
- onedrive_folders;
- RLS ou policies;
- RPCs de catálogo;
- RPC v1;
- claim determinístico;
- tabelas de publicação financeira.

As referências a documents, companies e financial_extraction_jobs existem
somente no preflight e no corpo da nova função. Criar a função não a executa.

## Gate obrigatório de backup

Antes da janela, um operador autorizado deve registrar evidência sanitizada de:

1. backup diário ou PITR visível em **Database > Backups** do projeto KAWANA;
2. ponto recuperável anterior ao horário da aplicação;
3. ação de restauração disponível e retenção suficiente;
4. responsável e procedimento de recuperação;
5. ensaio de restauração bem-sucedido em ambiente isolado, ou referência
   aprovada de ensaio recente do mesmo mecanismo e versão compatível.

Somente a existência de uma linha na tela de backups não prova
recuperabilidade. Se não houver ensaio ou evidência equivalente, manter
NO-GO.

Backups PostgreSQL não restauram os objetos armazenados pela Storage API. Isso
não amplia esta implantação: a migration não altera Storage e nenhum XLSX deve
ser baixado. A limitação deve permanecer registrada no plano de recuperação.

Referência operacional:
<https://supabase.com/docs/guides/platform/backups>

## Aplicação manual no SQL Editor

Depois de aprovar o gate de backup:

1. abrir uma nova consulta no SQL Editor do projeto KAWANA;
2. copiar o arquivo autorizado inteiro, sem adaptar nomes ou remover
   BEGIN/COMMIT;
3. confirmar visualmente que somente a migration autorizada está no editor;
4. executar uma única vez;
5. se houver qualquer erro, salvar somente a mensagem sanitizada e parar;
6. não repetir a migration e não executar SQL corretivo ad hoc;
7. se concluir sem erro, executar imediatamente o postflight
   scripts/supabase/11e2-kawana-v2-readonly-postflight.sql;
8. exportar o único result set do postflight para CSV.

Comparar as linhas INFO de policies e grants do postflight com o CSV do
preflight. Qualquer diferença não explicada mantém NO-GO, mesmo que os checks
de grants efetivos continuem em PASS.

O SQL Editor não interpreta o metacomando psql \set ON_ERROR_STOP on.
Portanto, ele não deve ser incluído no texto copiado. A migration já possui
transação explícita. ON_ERROR_STOP=1 é obrigatório apenas se uma execução por
psql for autorizada em outra etapa.

## Critério do postflight

O postflight deve terminar com:

- zero linhas FAIL;
- três colunas com tipo, nulabilidade e default esperados;
- seis checks com as definições esperadas;
- índice único parcial exato;
- RPC v2 pertencente a postgres, SECURITY INVOKER, plpgsql, retorno jsonb e
  search_path=public, três defaults e hash de corpo esperado;
- EXECUTE somente para service_role;
- RPC v1 preservada;
- claim v2 ainda ausente;
- RLS ainda habilitado e grants efetivos preservados;
- quatro fatos totais, todos v1 e sem proveniência v2;
- zero fatos do documento piloto;
- documents=5226 e onedrive_folders=1188.

Qualquer FAIL mantém a próxima etapa em NO-GO.

## Recuperação

- Erro antes do COMMIT: a transação fica abortada e deve reverter; não
  restaurar backup nem reexecutar automaticamente.
- Sucesso com postflight divergente: não executar claim ou n8n; preservar
  evidências e preparar correção forward-only.
- Corrupção ou perda confirmada: usar somente o backup/PITR aprovado, com
  autorização e janela de indisponibilidade.
- Não remover manualmente colunas, índice, constraints ou RPC.

## Próxima ação

O operador confirma e registra o gate de backup. Depois disso, a única ação
autorizada é aplicar a migration de persistência v2 pelo SQL Editor e executar
o postflight read-only. Nenhuma outra migration ou integração faz parte desta
janela.
