# Etapa 07A — auditoria da interface de revisão financeira

## Escopo e resultado

A interface de `financeiro/revisao` foi preparada para consultar registros autorizados, exibir rastreabilidade e representar o contrato `financial-extraction.v1` sem depender do worker ou da VPS. Esta etapa não altera Supabase, RLS, migrations, workflows, decisões ou indicadores financeiros.

A tela opera em modo somente leitura. Usa `finance_review_list` para a fila e `finance_review_history` para auditoria. As RPCs `finance_review_decide` e `finance_review_set_document_role` permanecem no service existente, mas não são chamadas pela página nesta etapa.

## Problemas identificados

- A UI habilitava aprovação, rejeição e classificação inferindo permissão pelos dados visíveis. `finance_review_list` não retorna capacidades de decisão/classificação, e a presença de uma empresa no dropdown não comprova autorização.
- O texto afirmava que a origem era OneDrive, mas a RPC não retorna `documents.source` ou `provider`.
- Empresa extraída (`source_company_name`) e empresa vinculada/autorizada (`company_name`) eram apresentadas como equivalentes.
- O filtro de empresa atuava apenas sobre a página carregada sem explicar esse limite.
- ETag, versão de origem, disponibilidade do documento, data de extração e histórico estavam pouco destacados.
- Erro técnico, acesso negado, sessão ausente e ausência legítima de dados não possuíam estados suficientemente distintos.
- A RPC atual não retorna warnings, `schemaVersion`, `logicalKey`, endereço de célula, fórmula ou estatísticas do `financial-extraction.v1`.

## Melhorias implementadas

- filtros locais por empresa vinculada, documento, competência e aba de origem, sempre limitados à página já autorizada pela RPC;
- distinção visual entre empresa vinculada e nome informado pela extração;
- estados de loading, vazio, erro, sessão ausente e acesso negado;
- detalhes de documento, ID, ETag, aba/linha, competência, versão, classificação e disponibilidade;
- histórico obtido exclusivamente por `finance_review_history`;
- ações de aprovar, rejeitar e classificar bloqueadas na UI e removidas do fluxo do script;
- exemplo sintético identificado como tal para demonstrar a futura apresentação do contrato XLSX;
- layout responsivo com tabela no desktop e cartões no mobile;
- validação defensiva do formato retornado pela listagem e classificação segura dos erros das RPCs.

## Bloqueios posteriores

Nenhuma correção abaixo foi aplicada porque exige decisão de contrato ou banco:

1. `finance_review_list` precisa retornar capacidades calculadas no servidor, por registro ou documento, como decisão e classificação permitidas. Somente então as ações poderão ser habilitadas.
2. Filtros globais e paginação coerente por empresa, documento, competência e origem exigem parâmetros validados na RPC; hoje os filtros são apenas da página de até 20 registros.
3. Para mostrar provider/origem externa, warnings e evidências completas, o contrato de leitura precisa expor campos autorizados do documento e da extração.
4. Um resultado vazio não permite distinguir “usuário autorizado sem registros” de “usuário sem vínculo com qualquer empresa”. A RPC precisaria retornar um estado seguro de acesso, sem revelar empresas não autorizadas.
5. As migrations locais não contêm a criação das tabelas financeiras de revisão nem as definições dos wrappers públicos das quatro RPCs; a migration de segurança apenas substitui implementações privadas e concede execução. O estado remoto e a cadeia de migrations precisam ser reconciliados antes de novo ambiente ou deploy.
6. `docs/DATABASE.md` descreve clientes `client.ts`, `server.ts` e `admin.ts`, enquanto o código operacional atual usa `src/lib/supabase/browser.ts`. O código atual foi preservado como fonte operacional.

Até esses pontos serem resolvidos, visibilidade de linha ou empresa serve apenas para leitura autorizada pela RPC e nunca como autorização de decisão.
