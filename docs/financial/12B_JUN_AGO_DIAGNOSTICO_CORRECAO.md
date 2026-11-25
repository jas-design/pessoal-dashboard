# 12B — diagnóstico dos originais de junho a agosto

Verificado em 15/11/2026, sobre a revisão `b41d704e39165e661bc419d4cf7ae0f067d4db1f`.

## Evidência e causa

Os três binários foram baixados da saída salva do nó `Download original XLSX from Graph`
da execução n8n `3006`, workflow `ZHFtdZlyY6lyObGt`. Nenhuma execução nova foi disparada.

| Competência | Tamanho do binário | Origem da receita |
| --- | ---: | --- |
| 2026-06 | 525178 bytes | RECEITAS X DESPESAS KWN!B24 |
| 2026-07 | 525927 bytes | RECEITAS X DESPESAS KWN!B24 |
| 2026-08 | 527313 bytes | RECEITAS X DESPESAS KWN!B24 |

ExcelJS abriu todos os arquivos e encontrou as 13 abas esperadas. O parser anterior
rejeitou os três em `requireCellText`, pois exigia `Receita` em A23. Nos originais,
A23 está vazia e `Receita` está em A24. O adaptador converte essa exceção em
`invalid_xlsx`, sem distinguir falha de mapping de arquivo ilegível.

## Correção local

- Aceitar exatamente um rótulo `Receita` entre A23 e A24, mantendo a comparação normalizada existente.
- Ler o valor numérico da coluna B correspondente e registrar a célula real na evidência.
- Usar essa mesma evidência nas duas conciliações de receita.
- Rejeitar rótulo ausente, duplicado ou valor não numérico; preservar estrutura,
  sinal da despesa, competência, quatro métricas e revisão obrigatória.
- Não alterar schema, mapping ID/version, parserVersion, credenciais ou workflow remoto.
  Trata-se de correção compatível do mapping existente 12A.2; ao implantar, registrar
  também o commit/imagem para distinguir o binário corrigido.

## Validação

Nos três originais, o adaptador corrigido produziu quatro fatos canônicos:
caixa B10, receita B24, despesa B8 e resultado B6. As cinco conciliações passaram
em cada arquivo. A preparação local de persistência aceitou quatro fatos por arquivo,
com etag de teste local; nenhuma gravação foi feita no Supabase.

- `node --import tsx --test tests/financial/*.test.ts`: 110 testes, 107 passaram,
  3 ignorados, 0 falhas. Os originais foram validados separadamente.
- `npm run check`: 113 arquivos, 0 erros, 0 warnings, 5 hints.
- Teste novo cobre B24 com número distrator em B23, evidência nas conciliações,
  divergência financeira, rótulos duplicados/ausentes e valor não numérico.
- Os testes existentes continuam cobrindo B23 e os demais layouts.

Consulta somente leitura confirmou: janeiro a maio seguem com quatro fatos v2
pendentes por mês; junho e julho não têm fatos; agosto tem apenas dois fatos v1
legados; setembro possui quatro fatos v2 aprovados e dois v1 pendentes.

## Limite contábil antes de publicar

Os cabeçalhos dos três originais declaram intervalos de 01/01/2026 até o último
dia de junho, julho ou agosto. Portanto, as receitas, despesas e resultados deste
layout representam o período acumulado declarado. A extração correta e a conciliação
não tornam esses totais automaticamente mensais.

Não somar os acumulados entre meses nem publicá-los como movimento mensal.
Antes da publicação, validar a base dos relatórios anteriores e definir uma série
mensal por diferença entre acumulados comparáveis, com evidência dos dois documentos,
ou identificar explicitamente a série como acumulada. Saldo de caixa é posição,
não fluxo mensal. Esta correção não implementa nem aprova conversão contábil.

## Próxima intervenção controlada

1. Revisar e autorizar push desta correção para uma branch de revisão.
2. Identificar o projeto Docker e a imagem atual do worker na Hostinger; preservar
   referência para rollback. Autorizar build/atualização e reinício somente desse serviço.
3. Verificar healthcheck e versão efetivamente implantada.
4. Autorizar a execução manual do recovery somente para junho–agosto, preservando
   If-Match, validação antes do claim e gravação como pendente de revisão.
5. Confirmar quatro fatos v2 por documento/etag, sem alterar janeiro–maio ou
   os fatos publicados de setembro. Não aprovar/publicar automaticamente.

O briefing exige aprovação explícita para push, deploy, reinício de containers e
execução com gravação real. Esses passos não foram executados durante o diagnóstico.
Os binários privados não devem ser adicionados ao Git.
