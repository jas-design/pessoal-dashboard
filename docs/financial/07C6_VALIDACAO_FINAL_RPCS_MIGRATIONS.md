# Etapa 07C.6 — validação final das RPCs e migrations de segurança

## Evidência analisada

Foram lidos os três arquivos `07C5_*` disponíveis em
`.local/supabase/07c/`, sem executar SQL:

- as quatro divergências pertencem a um documento fictício `TESTE_`;
- são quatro linhas de um único documento;
- somente `postgres` possui `CREATE` no schema `public` entre os papéis
  examinados;
- `finance_claim_next_document` e `finance_complete_document` são
  `SECURITY INVOKER`, owner `postgres`, `search_path=public`;
- somente `service_role` possui `EXECUTE` efetivo nessas duas RPCs entre
  `anon`, `authenticated` e `service_role`.

O arquivo detalhado correspondente ao Bloco 1 não está presente. Portanto, não
está comprovado se cada divergência é documento nulo/linha preenchida, linha
nula/documento preenchido ou UUIDs diferentes.

## Incompatibilidades confirmadas

### Alta — inferência de empresa por nome

Quando `documents.company_id` é nulo, `finance_complete_document` procura uma
empresa ativa do mesmo owner pelo nome normalizado e grava o UUID encontrado na
linha. Isso pode produzir exatamente o estado documento sem empresa/linha com
empresa que as migrations 07C agora bloqueiam.

Regra proposta:

1. `documents.company_id` é a única empresa autorizada para novas linhas;
2. se o documento tiver empresa, toda linha recebe exatamente esse UUID;
3. se o documento não tiver empresa, a linha permanece com `company_id` nulo;
4. `source_company_name` continua sendo evidência, nunca autoridade;
5. divergência entre contexto do claim, documento e resposta do worker falha
   fechado;
6. associação posterior exige ação explícita, autorizada e auditada.

Nenhum `company_id` existente deve ser corrigido automaticamente.

### Alta — reprocessamento pode apagar a decisão lógica

O `ON CONFLICT` atual atualiza valor, empresa e moeda e força
`review_status='pending_review'`. Ele não limpa nem versiona `reviewed_at`,
`reviewed_by`, `review_note` ou `review_revision`. Assim, uma linha aprovada ou
rejeitada pode voltar a pendente mantendo metadados e histórico incompatíveis.

Correção mínima proposta para uma futura migration, ainda não preparada para
aplicação:

```sql
-- A identidade com o mesmo documento e ETag é um snapshot imutável.
on conflict (document_id, source_etag, sheet_name, source_row, metric)
do nothing;
```

O contador deve usar a quantidade realmente inserida, não a quantidade iterada.
Mudança de conteúdo exige novo ETag ou uma versão de extração incorporada à
chave idempotente. Decisões e auditoria anteriores nunca são reabertas por retry.

### Alta — `financial-extraction.v1` não cabe na RPC atual

O worker retorna sempre `status: needs_review`, `publishable: false`, além de
`facts`, `bankTransactions`, warnings, conciliações e evidências. A RPC atual:

- só insere linhas quando `p_status='extracted'`;
- rejeita `needs_review` acompanhado de fatos;
- aceita somente `metric` igual a `receita` ou `despesa`;
- espera `month`, `sheet` e `source_row` no nível superior;
- não possui campos para `logicalKey`, `metricCode`, categoria, célula, fórmula,
  versão do mapeamento, warnings ou conciliações.

Os fatos XLSX usam vários `metricCode`, `periodMonth` no formato `AAAA-MM` e
evidência aninhada. Logo, passar os 612 fatos diretamente causaria rejeição ou
perda de semântica. Eles não são 612 transações e não devem ser convertidos em
massa para `financial_extracted_rows` ou `financial_transactions`.

Antes da integração é necessário um contrato de staging próprio para preservar
o artefato `financial-extraction.v1` e suas evidências. Somente projeções
explicitamente aprovadas de receita/despesa podem alimentar a RPC legada, sempre
como `pending_review` e sem publicação.

### Média — limites de arquivo divergentes

`finance_claim_next_document` limita `documents.file_size` a 8 MiB. O worker
aceita 25 MiB. Se o workflow usa claim, 8 MiB é o limite efetivo; arquivos entre
8 e 25 MiB nunca chegam ao worker. O limite menor é seguro e deve ser mantido no
staging inicial. Aumentá-lo exige medir memória, tempo e armazenamento binário
do n8n/VPS e alterar documentação/configuração de forma coordenada.

### Média — formatos reivindicados além do worker

A RPC de claim seleciona CSV, XLSX e PDF. O worker preparado aceita somente
XLSX. O workflow precisa possuir roteamento explícito por extensão; enviar CSV
ou PDF ao endpoint XLSX produzirá erro. A configuração real não está no
repositório.

## Semântica de claim confirmada

- `p_pilot_only=true`: somente nomes que correspondem a
  `^TESTE_FINANCEIRO_.*\.(csv|xlsx|pdf)$`;
- `p_pilot_only=false`: exige `documents.company_id IS NOT NULL`;
- arquivos devem estar no caminho autorizado, ser OneDrive, não excluídos,
  possuir ETag/IDs externos e ter entre 1 byte e 8 MiB;
- failed/stale processing possui no máximo três tentativas;
- mudança de ETag reinicia tentativas;
- `FOR UPDATE ... SKIP LOCKED` evita claim concorrente do mesmo documento.

Como a função é invoker e somente `service_role` executa, o parâmetro
`p_owner_id` é um seletor confiado ao workflow. Ele não pode vir diretamente de
entrada do navegador ou de metadado do arquivo.

## Compatibilidade das migrations 07C

As três migrations não alteram as duas RPCs de extração:

1. grants removidos de `companies` afetam apenas `anon`/`authenticated`;
   `service_role` permanece intacto;
2. policies de `documents` com `is_admin()` não são alteradas;
3. as RPCs de revisão não usam `is_admin()` e continuam exigindo owner/vínculo;
4. a proteção de `financial_private` não afeta RPCs públicas de extração;
5. nenhum acesso privado direto adicional é concedido a papel de API.

Somente `postgres` possui `CREATE` no schema `public` entre os papéis
inventariados. Isso reduz o risco de shadowing associado aos `search_path`
atuais. As policies gerais de `documents` continuam permitindo administração
global legítima por `is_admin()`; esse acesso direto a documentos não se
transforma em permissão de decisão nas RPCs financeiras.

Logo, as migrations são compatíveis com o caminho de banco conhecido do n8n.
Isso não comprova o workflow 04 completo, porque seu export/configuração não
está disponível.

## SQL corretivo ainda bloqueado

Não foi criada uma quarta migration porque faltam o adaptador real do workflow
04 e o destino aprovado para o artefato completo `financial-extraction.v1`.
Uma migration segura deverá, em conjunto:

- remover a busca de empresa por nome;
- copiar somente `v_doc.company_id` para linhas legadas;
- tornar snapshots do mesmo ETag imutáveis (`ON CONFLICT DO NOTHING`);
- contar inserts reais;
- manter o job em `needs_review` quando houver fatos;
- preservar decisões/auditoria e nunca publicar;
- armazenar evidências XLSX em estrutura própria aprovada, sem forçá-las no
  domínio limitado a receita/despesa.

Alterar apenas parte desse conjunto criaria um contrato intermediário perigoso.

## Testes de staging

### Migrations e autorização

1. aplicar as três migrations em clone com dados sintéticos;
2. executar matriz owner/admin/reviewer/viewer/sem vínculo/anon entre empresas
   A e B;
3. confirmar que admin global preserva documentos gerais, mas não ganha revisão
   financeira sem vínculo;
4. confirmar wrappers públicos e bloqueio direto de `financial_private` para
   todos os papéis de API;
5. confirmar que `service_role` ainda executa claim/complete e que os demais
   papéis são negados.

### Claim e retry

1. testar 8 MiB exatos, 8 MiB + 1 byte e documento vazio;
2. piloto true com arquivo `TESTE_` e não `TESTE_`;
3. piloto false com e sem `company_id`;
4. dois claims concorrentes, stale claim de 30 minutos, três tentativas e novo
   ETag;
5. garantir que retry usa o mesmo `document_id`, `claim_id` e ETag enquanto o
   claim estiver válido.

### Completion e idempotência

1. claim, documento ou ETag incorretos devem falhar sem inserir;
2. documento sem empresa deve produzir linhas sem empresa após a futura
   correção, preservando apenas o nome como evidência;
3. repetir mesma chave não altera valores, revisão ou auditoria;
4. linha aprovada/rejeitada nunca volta a `pending_review` por reprocessamento;
5. novo ETag cria novo snapshot pendente sem apagar o anterior;
6. `needs_review`, `publishable: false` e revisão humana permanecem invariantes.

### Contrato XLSX

1. validar schema e versão antes da persistência;
2. não enviar os 612 fatos brutos à RPC legada;
3. preservar `logicalKey`, célula, fórmula, mapeamento, warnings,
   conciliações, fatos auxiliares e transações bancárias separadas;
4. testar que apenas projeções explicitamente mapeadas para receita/despesa
   entram na fila legada;
5. confirmar que nenhum dado chega a métricas consolidadas/publicadas.

### Workflow 04

Confirmar, sem compartilhar segredos:

- export sanitizado ou captura dos nomes/tipos de nós;
- credencial/papel efetivo usado nas RPCs;
- origem de `p_owner_id`, `document_id`, `company_id`, `claim_id` e ETag;
- roteamento CSV/XLSX/PDF;
- transformação entre `financial-extraction.v1` e `p_rows`;
- timeout e retries por status HTTP/RPC;
- comportamento após timeout com commit possivelmente concluído.

## Rollback

As migrations 07C continuam com rollback parcial já documentado. As RPCs de
extração não foram alteradas, portanto não entram nesse rollback.

Os dois corpos reais e sua postura efetiva foram preservados em
`scripts/supabase/baselines/07c6-current-financial-extraction-rpcs.sql`. O
snapshot restaura função, owner, `SECURITY INVOKER`, `search_path=public` e
EXECUTE exclusivo de `service_role`; a origem histórica de cada grant não foi
inventariada. Dados e decisões produzidos após uma futura aplicação não podem
ser desfeitos automaticamente.

## Veredito

**Pronto para um teste isolado das três migrations 07C em staging**, com dados
sintéticos e sem conectar o workflow real. Os corpos e ACLs comprovam que o
caminho `service_role` das RPCs de extração não é removido pelas migrations.

**Não pronto para teste end-to-end do workflow 04 com o worker XLSX.** Faltam a
configuração real do workflow, o adaptador de contrato e um destino aprovado
para preservar integralmente `financial-extraction.v1`. Produção permanece
bloqueada até corrigir inferência por nome e reprocessamento destrutivo.
