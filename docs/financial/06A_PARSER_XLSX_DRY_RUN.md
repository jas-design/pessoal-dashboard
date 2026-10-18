# Etapa 06A — parser XLSX financeiro (dry run)

## Escopo

O parser lê as 12 abas do relatório gerencial no servidor, cria fatos rastreáveis e produz somente um artefato local com `status: needs_review` e `publishable: false`.

Ele não chama Supabase, não altera métricas consolidadas, não aprova valores e não envia dados a IA ou n8n. Arquivo real e resultado devem permanecer sob `.local/`, diretório ignorado pelo Git.

## Execução local

```bash
npm run financial:dry-run -- \
  --input ".local/kawana/09.2026 Relatório Gerencial Kawana.xlsx" \
  --company-name "Kawana" \
  --mapping "kawana-management-report" \
  --mapping-version "1" \
  --period "2026-09"
```

Saída padrão:

```text
.local/financial-parser/<nome-do-arquivo>-dry-run.json
```

O terminal mostra apenas contagens e estados de validação, nunca valores financeiros.

## Regras por aba

- `CAPA`: inventariada, sem gerar métrica.
- `Resumo`: fonte canônica provisória de receitas, despesas, resultado realizado e disponibilidade.
- `RECEITAS KWN` e `DESPESAS KWN`: detalhes e totais somente para conciliação; não aumentam os KPIs.
- `Fluxo de Caixa 2026`: saldos, variações, receitas e despesas em trilha de caixa; outubro a dezembro ficam como `forecast`; células com erro geram bloqueio.
- `ATIVO X PASSIVO KWN`, `ATIVOS KWN` e `PASSIVO KWN`: trilha `equity`, sem conversão em faturamento e com escopo pendente.
- quatro abas bancárias: transações e saldo final para lastro; aportes, transferências e escopo pessoal/empresarial permanecem em revisão.

Valores monetários são serializados como decimal e como inteiro de centavos (`amountMinor`). A chave lógica combina documento, ETag, aba, célula, indicador e competência.

## Contrato JSON para integração futura

```json
{
  "schemaVersion": "financial-extraction.v1",
  "parserVersion": "06A.1",
  "status": "needs_review",
  "publishable": false,
  "metadata": {
    "company": { "id": "uuid-ou-null", "name": "empresa" },
    "document": {
      "id": "uuid-ou-null",
      "fileName": "arquivo-local.xlsx",
      "externalFileId": null,
      "etag": "sha256"
    },
    "periodMonth": "AAAA-MM",
    "currency": "BRL",
    "extractedAt": "ISO-8601",
    "sheetCount": 12,
    "sheets": ["nomes das abas"]
  },
  "facts": [
    {
      "logicalKey": "chave-idempotente",
      "periodMonth": "AAAA-MM",
      "metricCode": "revenue",
      "indicator": "descrição",
      "category": "realized|forecast|balance|equity",
      "amount": "0.00",
      "amountMinor": "0",
      "currency": "BRL",
      "sourceScope": "business|pending_review",
      "includedInConsolidatedKpi": false,
      "reviewStatus": "needs_review",
      "evidence": {
        "sheet": "Resumo",
        "cellAddress": "A1",
        "sourceValue": "0",
        "formula": null
      }
    }
  ],
  "bankTransactions": [],
  "reconciliations": [],
  "warnings": [],
  "statistics": {}
}
```

O futuro workflow deve validar autenticação, empresa autorizada, `schemaVersion`, `document.id`, ETag e tamanho do payload antes de gravar em staging. A publicação em tabelas consolidadas exige revisão humana e idempotência pela `logicalKey`.

## Divergência de roteamento n8n

O nome operacional informado para a instância KAWANA é `04 - KAWANA - Financial Data Extraction`. A documentação genérica (`docs/N8N_AND_AGENTS.md`) ainda identifica `04-outlook-email-ingestion` e `05-financial-data-extraction`. O contrato permanece neutro e a instância deve ser confirmada antes da integração. Nenhum workflow foi modificado nesta etapa.

## Limites de aprovação

O parser permanece não aprovado enquanto houver erro de fórmula, conciliação divergente ou decisão pendente sobre escopo pessoal/empresarial. O dry run não substitui revisão contábil.
