# Etapa 12B — lote Kawana janeiro–agosto/2026

## Artefato

Importar no n8n Community da Hostinger:

`n8n/workflows/12b-kawana-2026-original-reports-batch-v2.json`

O workflow é manual, inativo e bloqueado por padrão. Ele contém somente os oito
UUIDs e nomes originais de janeiro a agosto. ETag, owner, tamanho, IDs do
OneDrive e caminho vêm de `documents` a cada execução.

O workflow 12B não altera 03 ou 11D, não consulta setembro e não possui RPC de
aprovação ou publicação.

## Compatibilidade e credenciais

Os tipos e versões usados correspondem aos exports do n8n Community instalado
na Hostinger:

- Manual Trigger v1;
- Code v2;
- If v2.2;
- HTTP Request v4.2;
- Loop Over Items v3, com `batchSize=1`.

Depois da importação, selecionar as credenciais já existentes, sem copiar seus
valores para o JSON:

- `KAWANA_SUPABASE_SERVICE_ROLE`: catálogo, consulta de fatos, claim e completion;
- `KAWANA_MICROSOFT_GRAPH_READ`: download somente leitura no OneDrive;
- `KAWANA_FINANCIAL_XLSX_WORKER`: chamada privada ao worker.

As quatro requisições Supabase usam diretamente a URL pública do projeto
`https://xjxwyzyfnumfphubuize.supabase.co`. O workflow não depende de `$vars`
nem de variáveis personalizadas do n8n. Autenticação continua exclusivamente
nas credenciais existentes, sem chaves ou tokens no JSON. O workflow não
registra secrets nem valores financeiros no resumo.

## Fluxo e garantias

Para cada documento, em sequência:

1. confere identidade, empresa, competência, nome original, provider, caminho,
   tamanho, ETag e ausência de indicação de segunda via;
2. consulta fatos da ETag atual; quatro fatos v2 completos tornam o item
   `already_processed`, enquanto estado parcial ou conflitante é isolado;
3. baixa o XLSX pelo Microsoft Graph;
4. envia o binário ao worker 12A.2 com mapping
   `kawana-management-report@2`;
5. exige HTTP 200, identidade exata, 13 abas, zero erros de fórmula, cinco
   conciliações aprovadas e exatamente quatro fatos canônicos nas células
   esperadas;
6. somente depois dessas validações chama `finance_claim_document_v2`;
7. chama `finance_complete_document_v2` com quatro linhas e
   `p_status=needs_review`.

Um documento incompatível recebe resultado `isolated` e o loop continua. Não
há aprovação ou publicação automática. O resumo contém somente UUID,
competência, estágio, código e contagens.

## Execução controlada única

1. Importar o JSON e confirmar `Inactive` e `Manual Trigger`.
2. Associar as três credenciais existentes.
3. Abrir `Define approved batch inventory` e revisar os oito UUIDs, competências
   e nomes.
4. Alterar temporariamente somente a primeira linha para:

   ```javascript
   const batchExecutionApproved = true;
   ```

5. Salvar, manter o workflow inativo e executar manualmente uma única vez.
6. Aguardar `Summarize sanitized batch results` e conferir:
   `expectedDocuments=8`, `resultCount=8`, `automaticApproval=false` e
   `automaticPublication=false`.
7. Restaurar imediatamente a primeira linha para `false` e salvar.
8. Executar no SQL Editor o script somente leitura
   `scripts/supabase/12b-kawana-2026-pending-review-verification.sql`.

Para a primeira carga completa, cada mês deve retornar `pending_review` e o SQL
deve apresentar `PASS` nas três colunas. `already_processed` é aceitável em uma
reexecução idempotente. Qualquer item `isolated` deve ser investigado
individualmente; não altere o catálogo nem force claim para contornar a causa.

## Verificação local

```powershell
npx.cmd tsx --test tests/financial/kawana-2026-batch-n8n-workflow-v2.test.ts
npm.cmd run test:financial-parser
npm.cmd run check
npm.cmd run build
```

Esses comandos não acessam produção. A importação e a execução remotas não
fazem parte desta etapa.
