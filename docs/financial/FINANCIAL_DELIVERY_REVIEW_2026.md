# Revisão para entrega financeira de 2026

Evidência de 2026-11-25, produzida por consultas somente leitura ao Supabase.
Nenhum fato foi aprovado ou publicado durante esta análise.

## Inventário

| Grupo | Quantidade | Estado |
| --- | ---: | --- |
| Canônicos v2 de janeiro a agosto | 32 | `pending_review` |
| Legados v1 de agosto e setembro | 4 | `pending_review`, inelegíveis para publicação v2 |
| Canônicos v2 de setembro | 4 | aprovados e publicados |
| Total | 40 | 36 pendentes e 4 publicados |

Cada competência de janeiro a agosto tem um documento XLSX canônico atual e
quatro fatos v2: receita, despesa, resultado líquido e saldo disponível. A
consulta `scripts/supabase/financial-delivery-review-readonly.sql` reproduz a
matriz completa sem alterar dados.

## Resumo mensal dos fatos v2

| Competência | Documento canônico | Receita | Despesa | Resultado | Saldo | Matemática | Situação |
| --- | --- | ---: | ---: | ---: | ---: | --- | --- |
| Jan/2026 | `01.2026 Relatório Gerencial Kawana.xlsx` | R$ 3.924,81 | R$ 321.637,31 | -R$ 317.712,50 | R$ 70.823,03 | confere | pronto para revisão documental |
| Fev/2026 | `02.2026 Relatório Gerencial Kawana.xlsx` | R$ 4.493,92 | R$ 482.239,96 | -R$ 477.746,04 | R$ 29.453,72 | confere | aguarda janeiro |
| Mar/2026 | `03.2026 Relatório Gerencial Kawana.xlsx` | R$ 11.964,77 | R$ 546.113,06 | -R$ 534.148,29 | R$ 27.650,40 | confere | aguarda janeiro |
| Abr/2026 | `04.2026 Relatório Gerencial Kawana.xlsx` | R$ 15.930,79 | R$ 632.154,75 | -R$ 616.223,96 | R$ 197.906,71 | confere | aguarda janeiro |
| Mai/2026 | `05.2026 Relatório Gerencial Kawana.xlsx` | R$ 19.898,54 | R$ 754.156,44 | -R$ 734.257,90 | R$ 289.269,12 | confere | aguarda janeiro |
| Jun/2026 | `06.2026 Relatório Gerencial Kawana.xlsx` | R$ 23.890,84 | R$ 868.623,33 | -R$ 844.732,49 | R$ 248.845,86 | confere | revisar origem da receita em `B24` |
| Jul/2026 | `07.2026 Relatório Gerencial Kawana.xlsx` | R$ 27.905,93 | R$ 926.708,08 | -R$ 898.802,15 | R$ 78.436,67 | confere | revisar origem da receita em `B24` |
| Ago/2026 | `08.2026 Relatório Gerencial Kawana.xlsx` | R$ 32.712,41 | R$ 958.113,92 | -R$ 925.401,51 | R$ 89.145,39 | confere | revisar origem da receita em `B24` |
| Set/2026 | `09.2026 Relatório Gerencial Kawana.xlsx` | R$ 3.864,63 | R$ 48.440,50 | -R$ 44.575,87 | R$ 33.460,11 | confere | aprovado e publicado |

Em junho, julho e agosto a receita persistida veio de `B24`, enquanto o parser
e o workflow versionados esperam `B23`. Isso não invalida automaticamente os
valores, mas exige conferência no XLSX antes de aprovar esses meses. Nenhum
reprocessamento deve ser usado para resolver essa divergência sem antes
confirmar a estrutura dos documentos.

## Piloto de janeiro

Empresa: Kawana. Competência: janeiro de 2026. Documento atual:
`01.2026 Relatório Gerencial Kawana.xlsx`.

| Métrica | Valor extraído | Aba e célula | Validação | Elegibilidade atual |
| --- | ---: | --- | --- | --- |
| Receita | R$ 3.924,81 | `RECEITAS X DESPESAS KWN!B23` | origem esperada | revisão documental |
| Despesa | R$ 321.637,31 | `RECEITAS X DESPESAS KWN!B8` | origem esperada | revisão documental |
| Resultado líquido | -R$ 317.712,50 | `RECEITAS X DESPESAS KWN!B6` | receita - despesa confere | revisão documental |
| Saldo disponível | R$ 70.823,03 | `RESUMO KWM!B10` | origem esperada | revisão documental |

O documento, a empresa, a competência, a ETag e as quatro métricas v2 estão
coerentes. O documento ainda está `unclassified` e os fatos permanecem
`pending_review`; por isso janeiro ainda não é elegível para publicação.

## Fatos legados isolados

O arquivo `TESTE_FINANCEIRO_KAWANA_2026-10.csv` contém dois fatos v1 atribuídos
a agosto e dois a setembro, apenas com as métricas legadas `receita` e
`despesa`, sem célula de origem. Eles não devem substituir nem complementar os
quatro fatos canônicos v2.

## Procedimento após validação e autorização

1. Abrir o XLSX canônico de janeiro e conferir visualmente as quatro células.
2. Classificar esse documento como `primary` pela RPC existente de revisão.
3. Aprovar cada fato por `finance_review_decide`, com justificativa e revisão
   esperada, somente após autorização específica.
4. Confirmar que os quatro fatos continuam atuais, em BRL, no mesmo documento,
   ETag, empresa e competência.
5. Em contexto server-side e com ator autorizado, chamar
   `finance_publish_monthly_metrics` com os quatro IDs aprovados.
6. Reconsultar a linha publicada e as telas; repetir apenas a consulta para
   validar idempotência.

A publicação rejeita fatos v1, pendentes, de documento não primário, de versão
antiga ou com identidade divergente. Aprovar fatos não publica o mês
automaticamente.
