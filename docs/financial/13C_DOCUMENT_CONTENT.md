# 13C — Planilhas e OCR

## Estado em 22/11/2026

Worker instalado na VPS e confirmado healthy, executando como 1000:1000 após
correção de acesso ao segredo. Migration `document_content_queue_v1` aplicada no
Supabase `xjxwyzyfnumfphubuize`; fila restrita a service_role.

Workflows publicados no n8n:

- Planilhas: `HmrM7ehsuuUW6ia8`, a cada minuto, publicado em 22/11.
- OCR: `HdQgpPc4fANBr4JR`, a cada cinco minutos.
- PDF textual 13B: `OmQRMv7HcPa4V9NY`, preservado.

Consulta da fila em 22/11, aproximadamente 16h55 (America/Sao_Paulo):

| Tipo | Extraídos | Falhas | Em processamento |
| --- | ---: | ---: | ---: |
| XLSX | 9 | 2 | 1 |
| CSV | 1 | 0 | 0 |
| OCR | 637 | 15 | 0 |

Contagens são um retrato, não o total final do catálogo. Não havia registros XLS
nessa consulta; cobertura XLS continua validada apenas pelos testes locais.
O avanço de 7 para 9 XLSX entre consultas confirma processamento automático.
Histórico de execuções bem-sucedidas, com erro e manuais configurado para não salvar;
timeout de workflow de cinco minutos. Conteúdo extraído não publica fatos financeiros.

## Pendências de diagnóstico

- As 15 falhas OCR atingiram três tentativas por versão; não serão repetidas
  automaticamente sem tratamento. Não confundir ausência de processamento OCR
  neste retrato com comprovação de que todo o catálogo foi coberto.
- Duas falhas XLSX estavam na primeira tentativa na consulta de diagnóstico.
- A fila registra apenas `extraction_failed`; isso não identifica a causa individual.
- No piloto da planilha de análise financeira de agosto/2026, a reprodução local
  retornou `content_limit`. Essa evidência vale para a versão baixada no piloto;
  não prova a causa das demais falhas ou da versão atual do arquivo.
- Próxima alteração técnica: propagar códigos de erro de uma lista permitida entre
  parser, servidor, workflow e RPC, sem texto de documentos, segredos ou exceções
  arbitrárias. Usar nova migration; não modificar a migration já aplicada.
- Depois, definir tratamento de conteúdo acima do limite e reprocessar somente
  falhas elegíveis. Não aumentar limites indiscriminadamente nem salvar truncamento
  como extração completa.

## Entrega

- `workers/document-content`: serviço Python offline para XLSX, XLS, CSV e OCR.
- `n8n/workflows/13c-spreadsheet-content-queue.json`: agendamento de 1 minuto.
- `n8n/workflows/13c-ocr-content-queue.json`: agendamento de 5 minutos.
- `supabase/migrations/20261117135912_document_content_queue_v1.sql`: já aplicada;
  **não reaplicar manualmente**.
- `tests/document-content`: testes dos leitores, endpoint, fila e workflows.

Python foi escolhido porque openpyxl e xlrd oferecem leitura dos dois formatos Excel;
o OCR usa os executáveis locais Poppler/Tesseract. Nenhum documento é enviado a uma API de IA.

## Contrato e rastreabilidade

POST binário `http://document-content-worker:8788/extract/{xlsx|xls|csv|ocr}`,
Authorization Bearer com o segredo existente do worker financeiro (montado read-only).
Resposta: `text` (JSON por linha), `metadata`, `financial_facts_created: 0`.
Cada item inclui aba/célula ou registro/coluna; OCR inclui página, bloco, linha,
palavra e confiança. SHA-256 identifica os bytes. XLSX preserva expressões sem
calcular; XLS usa resultados em cache, não recalculados. Textos não são indicadores.

O n8n confere identidade, tamanho, MIME e ETag no Graph antes do download, verifica
assinatura dos bytes, extrai e reconfere a versão antes da gravação.
As RPCs usam invoker, RLS, grants apenas para service_role e token de reserva.
Uma tarefa por proprietário por vez na fila 13C; lease de 10 minutos, três tentativas
por versão, intervalo mínimo de 15 minutos para falhas. A fila 13B é independente.
Conteúdo não é salvo no histórico de execução. Nenhuma métrica financeira é criada.

## Limites e comportamento

8 MiB por arquivo; 64 MiB descompactados por XLSX; 100 abas; 50.000 linhas e
1.024 colunas por aba; 100.000 itens não vazios; 900.000 caracteres de saída.
OCR: até 30 páginas, raster limitado a 2.400 pixels no maior lado, por+eng,
180 segundos para o processo inteiro. Planilhas: 45 segundos. Um subprocesso por
arquivo, temporários removidos e grupo de processos encerrado em timeout.
Arquivos que excedem limites falham, sem salvar extração truncada como completa.
768 MiB de RAM e 0,75 CPU para o novo serviço; confirmar capacidade livre da VPS.
CSV aceita UTF-8/BOM, UTF-16/BOM e fallback CP1252; o delimitador detectado é registrado.
Arquivos XLS disfarçados de HTML/XML são rejeitados, assim como XLSX com macros.
OCR sempre marca revisão necessária; confiança não significa precisão financeira.

## Procedimento de instalação na VPS (já executado)

1. Enviar `fabio-document-content-13c-v1.tar.gz` para `/root/` pelo SCP.
2. Conferir o SHA-256 informado junto ao pacote.
3. Criar uma release separada em `/opt/fabio-document-content/releases/13c-v1`.
4. Extrair o pacote e executar `bash workers/document-content/install.sh`.

O script reutiliza o caminho do segredo montado no container financeiro, sem imprimir
seu conteúdo, e cria apenas o novo projeto Docker `fabio-document-content`.
Não altera/reinicia o n8n nem o worker financeiro. Não publica porta na internet.
Se o healthcheck falhar, para somente o novo serviço. Uma imagem com o mesmo nome
não é sobrescrita automaticamente.

## Procedimento de ativação no n8n (já executado)

Importar os dois JSONs como **novos workflows inativos**. Nos nodes do worker,
selecionar a credencial HTTP Header Auth existente do worker financeiro, com
`Authorization: Bearer ...`. Não copiar o segredo para parâmetros do workflow.
Conferir as referências existentes de Supabase e OneDrive após importação.
Executar primeiro o piloto manual de planilha; confirmar texto, origem e status
em documents e document_content_jobs. Repetir para comprovar idempotência por versão.
Executar piloto de OCR com PDF real e conferir português, páginas e confiança.
Só depois publicar os agendamentos. Não executar 13C antes da saúde do worker.

## Validação realizada

- 17 testes Python passaram: XLSX/XLS com múltiplas abas, fórmulas, CSV, limites,
  assinatura, OCR real de PDF sintético, autenticação, exclusão mútua e HTTP/subprocesso.
- Integração SQL em PostgreSQL local via PGlite 0.5.16: reserva, token incorreto,
  overlap, idempotência, ETag alterado, retries esgotados, OCR, grants e RLS.
- Ambos os workflows: sintaxe JavaScript, conexões, privacidade e validação de candidato.
- Produção: migration aplicada; RLS e bloqueio anon/authenticated verificados.
- Advisors: informação esperada de RLS sem policies para fila service-only;
  warnings em funções de autorização e proteção de senhas são preexistentes e não
  foram alterados nesta etapa.

Validação de produção: imagem construída na VPS; healthcheck confirmado pelo
terminal do usuário. Pilotos reais XLSX e OCR concluídos e processamento automático
confirmado pelas filas; CSV também extraído. OCR local foi testado com inglês; a
imagem de produção inclui por+eng. Sucesso técnico não comprova qualidade de leitura
de cada documento: revisão amostral de OCR ainda é necessária. Não houve publicação
financeira nesta etapa. Não há acesso direto ao shell da VPS nesta sessão.

## Comandos de testes

`python -m unittest discover -s tests/document-content -v`

`node tests/document-content/workflows.test.mjs`

`PGLITE_MODULE=/caminho/node_modules/@electric-sql/pglite/dist/index.js node tests/document-content/queue.test.mjs`

## Referências dos leitores

- https://openpyxl.readthedocs.io/en/stable/api/openpyxl.reader.excel.html
- https://xlrd.readthedocs.io/en/latest/api.html
- https://github.com/tesseract-ocr/tessdoc/blob/main/Command-Line-Usage.md

## Correção de implantação — permissão do segredo

O build na VPS concluiu, mas a inicialização falhou com PermissionError ao ler
`/run/secrets/document_worker_auth`. O UID 10001 da imagem não corresponde ao
usuário do worker financeiro que já consegue ler o segredo montado.
`workers/document-content/repair-secret-access.sh` descobre UID/GID desse worker,
recusa UID 0, registra esse usuário no Compose e testa a leitura sem imprimir o
segredo. Só então recria o serviço de conteúdo com a imagem existente. Preserva
backup do Compose; se a validação/saúde falhar, restaura o arquivo e mantém o novo
serviço parado. Não altera chmod/chown do segredo nem reinicia o worker financeiro.
Script validado com bash -n. O terminal do usuário confirmou leitura do segredo OK,
estado running, saúde healthy e usuário 1000:1000 após a correção de implantação.


## Diagnóstico seguro do worker — implementação local em 22/11/2026

O parser agora escreve somente um código de erro permitido no arquivo temporário
quando falha. O servidor lê esse resultado (máximo 256 bytes em falhas), valida
novamente o código e retorna HTTP 422 com `{"error":"content_limit"}`, por exemplo.
Erros desconhecidos continuam como `extraction_failed`; exceções e stderr não são
expostos. Timeouts internos do OCR também são classificados como
`extraction_timeout`. Autenticação, limites e formato de sucesso foram preservados.

Arquivos alterados: `workers/document-content/extract.py`, `server.py`,
`tests/document-content/test_extract.py` e `test_server.py`.
Validação: 21 testes Python, incluindo subprocesso HTTP real, excesso de conteúdo,
assinatura inválida, diagnóstico privado, planilhas e OCR sintético. `xlwt==1.3.0`
é necessário somente no ambiente de testes para gerar o arquivo XLS de exemplo;
não foi adicionado à imagem de produção.

**Não implantado.** O pacote 13c-v1 distribuído anteriormente não contém esta
correção. Não há Docker nem conexão ao shell da VPS nesta sessão. A fila ativa
continua usando o serviço instalado. Esta alteração isolada não muda os códigos
já registrados no banco e não reprocessa falhas.

Para concluir a integração: preparar uma nova release Docker preservando o usuário
1000:1000 e o segredo montado; transmitir apenas códigos permitidos no caminho de
falha do n8n; criar uma nova migration para a RPC guardar o código validado de
`p_metadata.error_code`, com fallback para clientes antigos. Validar primeiro com
amostras sintéticas e depois um piloto real antes de reprocessar falhas esgotadas.
Os limites de extração permanecem iguais; processamento em partes ainda não foi
implementado.


## Integração de diagnóstico — 23/11/2026

Migration `20261123132457_document_content_safe_errors.sql` aplicada em produção.
A assinatura da RPC não mudou. Falhas aceitam `p_metadata.error_code` somente se
estiver na lista permitida; ausente/desconhecido volta a `extraction_failed`.
RLS ativo, SECURITY INVOKER e EXECUTE restrito a service_role verificados após
aplicação. Nenhuma falha antiga foi reclassificada ou teve tentativas zeradas.

Os dois JSONs locais agora usam Never Error no HTTP do worker e um IF explícito
para separar conteúdo de resposta de erro. Erros de transporte continuam pelo
ramo de erro; o preparo de falhas descarta mensagem, stack e conteúdo e encaminha
somente o código permitido. Testes executam esse código com respostas sintéticas.
Os JSONs foram importados como novos rascunhos inativos em 23/11: planilhas
`Wie4wmsHD2fqgLtV` e OCR `2iDjzmUpN0iJIQgg`. Ambos aguardam a implantação
do worker e o piloto. Retenção desativada e timeout de cinco minutos conferidos.
Os workflows anteriores continuam ativos. Não criar cópias adicionais.

Fila consultada em 23/11, aproximadamente 10h25 (America/Sao_Paulo):
479 XLSX, 37 XLS, 1 CSV e 637 OCR extraídos; 269 XLSX, 1 XLS e 15 OCR falharam.
Isso não comprova cobertura completa do catálogo, pois a elegibilidade tem limites.

Validação: testes SQL locais incluindo códigos permitidos, códigos desconhecidos,
compatibilidade antiga, ACL, RLS, versão e idempotência; testes dos workflows
incluindo roteamento e descarte de dados privados. As advertências de segurança
preexistentes fora desta RPC não foram alteradas.

Pacote `fabio-document-content-13c-diagnostics.zip` contém fontes do worker,
workflows atualizados, migration já aplicada, testes e instruções. A implantação
na VPS e o teste ponta a ponta no n8n permanecem pendentes. O formato de sucesso
continua 13c-v1; a nova imagem deve usar tag separada 13c-diag-v1.

## Instalação a partir do GitHub

A release de diagnóstico está em `workers/document-content/compose.yml`, com
imagem `13c-diag-v1` e usuário `1000:1000`. Siga
[as instruções de atualização e rollback](../../workers/document-content/README.md).
Os scripts de instalação originais 13c-v1 não fazem parte desta release.

## Atualização operacional informada em 25/11/2026

O usuário trouxe resultado do Codex/VS Code: imagem 13c-diag-v1 instalada na VPS,
commit a6329383066253acf8523cbce6351e9da400ff92, running/healthy e UID 1000:1000.
CSV sintético e invalid_xls passaram; rascunho de planilhas gravou content_limit
pela RPC. As quatro cópias 13C estão pausadas. Sucesso ponta a ponta de planilha
e OCR ainda pendente por falta de candidato elegível. Este relato substitui o
estado histórico de implantação pendente; não é nova inspeção remota nesta sessão.

Workflow manual de GitHub Actions preparado no PR #2, com rollback, sem migrations
ou ativação n8n. Falta configurar environment/secrets e integrar o workflow à main
antes da primeira execução. Procedimento em workers/document-content/README.md.
