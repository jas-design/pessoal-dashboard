# Etapa 07C.13B.9 — validação de evidências e preparação da revisão independente

Data de preparação: 23/10/2026. Atualização 07C.13B.9A: 23/10/2026. Estado:
**IDENTIDADE DE CONTEÚDO DO CSV CONFIRMADA PELO OPERADOR; VALIDAÇÕES DE
ESTRUTURA/COMPLETUDE E REVISÃO INDEPENDENTE PENDENTES; INCIDENTE NÃO
ENCERRADO**.

## Objetivo, escopo e limites

Este relatório valida a consistência documental das evidências disponíveis e
prepara a revisão independente do incidente envolvendo a senha PostgreSQL de
`cli_login_postgres`.

Foram lidos os relatórios sanitizados das Etapas 07C.13B.5, 07C.13B.6 e
07C.13B.8. Não houve acesso a produção, Supabase, PostgreSQL, Management API,
n8n, credenciais, sessões JSONL, arquivos `.env`, migrations ou workflows. Não
foram executados SQL, autenticação, mudança de configuração ou operação
destrutiva.

As afirmações sobre as coletas anteriores continuam classificadas como
evidências fornecidas pelo operador, ainda sujeitas à revisão independente.

## Atualização 07C.13B.9A — confirmação SHA-256 pelo operador

O operador informou ter executado `Get-FileHash` no PowerShell sobre o CSV
original preservado e comparado o resultado com a cópia de referência. Este
agente apenas registrou a declaração; não acessou, abriu, leu, modificou ou
hashou o arquivo.

| Campo | Evidência registrada |
| --- | --- |
| arquivo | `supabase_logs (2).csv` |
| local autorizado declarado | `C:\FABIO-AUDITORIA\07C13B\` |
| corpus anteriormente analisado | 483 registros PgBouncer |
| SHA-256 confirmado | `5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684` |
| ferramenta/método | `Get-FileHash` no PowerShell |
| comparação | correspondente à cópia de referência, conforme declaração do operador |
| data da confirmação | 23/10/2026; horário UTC não fornecido |
| executor | operador; identificação/alias ainda deve constar no registro restrito |

A correspondência do SHA-256 sustenta que os arquivos comparados possuíam o
mesmo conteúdo binário no momento das medições, desde que os digests tenham
sido calculados sobre os arquivos corretos e a cadeia de custódia seja válida.
Ela não comprova:

- que o CSV contém todos os eventos existentes na origem;
- que todas as páginas da consulta foram exportadas;
- que a consulta usou filtros, janela, timezone e ordenação corretos;
- que os 483 registros são a contagem total da fonte;
- que a fonte registrava todas as autenticações relevantes;
- que não ocorreu acesso indevido.

## Resultado da validação documental

### Consistências confirmadas entre os relatórios

- A senha foi documentada como expirada em 22/10/2026 às 21:28:48 UTC.
- A contenção atual está separada da investigação de possível uso histórico.
- As janelas são consistentes:

```text
Crítica:  22/10/2026 21:23:41.265–21:28:48.000 UTC
Ampliada: 22/10/2026 21:08:41.000–21:43:48.000 UTC
```

- Os relatórios não declaram ausência comprovada de acesso.
- PostgreSQL, Supavisor, PgBouncer e auditoria administrativa permanecem com
  limitações de cobertura documentadas.
- O estado histórico de `log_connections` e `log_disconnections` permanece
  desconhecido.
- A indisponibilidade de Organization Audit Logs no plano Free está registrada
  como ausência da fonte, não como ausência de ações administrativas.
- A exportação PgBouncer é descrita como contendo 483 eventos. A identidade de
  conteúdo entre o original preservado e a cópia de referência foi confirmada
  pelo operador por SHA-256; estrutura, contagem reproduzida, completude,
  filtros, paginação e revisão da cadeia de custódia permanecem pendentes.
- A decisão de retenção do JSONL, a revisão independente e o encerramento
  formal permanecem explicitamente pendentes.

### Limite da validação realizada

Na preparação original da Etapa B.9, a busca textual foi limitada aos três
relatórios indicados e nenhum deles fornecia nome ou caminho do CSV. Na
atualização B.9A, o operador declarou o arquivo, o local autorizado, o digest e
o método de comparação acima.

Continuam ausentes ou não verificados por este agente:

- tamanho e timestamps do arquivo;
- alias/identificação do operador e horário UTC da medição;
- versão do PowerShell/ferramenta;
- metadados completos da consulta/exportação;
- estrutura, encoding, quantidade parseada e timestamps internos;
- filtros, limites, total da origem e paginação;
- autorização para este agente acessar o conteúdo — expressamente fora do
  escopo desta atualização.

Não foi feita busca indiscriminada no workspace ou no sistema de arquivos. O
CSV não foi aberto, analisado, contado, modificado ou hashado por este agente.

## Estado das verificações

| Verificação | Estado | Evidência/razão |
| --- | --- | --- |
| leitura das Etapas B.5, B.6 e B.8 | concluída | documentos sanitizados revisados |
| consistência das janelas UTC | concluída | intervalos coincidem nos relatórios |
| consistência do status de contenção | concluída | expiração separada de ausência histórica |
| identificação do CSV e local autorizado | concluída por declaração do operador | `supabase_logs (2).csv` em `C:\FABIO-AUDITORIA\07C13B\` |
| estrutura e quantidade de registros do CSV | pendente | 483 registros foram informados, não reproduzidos nesta etapa |
| SHA-256 do CSV | confirmado pelo operador; revisão independente pendente | digest correspondente à cópia de referência via `Get-FileHash` |
| timestamps e separação das janelas no CSV | pendente | conteúdo não acessado |
| duplicidades e lacunas temporais | pendente | conteúdo não acessado |
| filtros, total e paginação da origem | pendente | metadados de exportação incompletos |
| eventos relacionados à credencial | pendente de reprodução | apenas o resultado da análise anterior foi fornecido |
| inventário do JSONL | pendente de operador humano | conteúdo e arquivo não foram acessados |
| decisão de retenção/eliminação | pendente de aprovação humana | gate da Etapa B.5 não concluído |
| revisão independente | pendente | segundo responsável ainda não registrou decisão |

## Evidência PgBouncer — situação após a atualização B.9A

O arquivo e o local autorizado foram identificados pelo operador, e a
correspondência do SHA-256 com a cópia de referência foi declarada. A validação
restante do corpus depende de intervenção humana para registrar:

1. responsável pela custódia e origem da exportação;
2. alias/identificação do operador e horário UTC da verificação;
3. tamanho e timestamps do arquivo preservado;
4. metadados da consulta/exportação, sem token, cookie ou credencial;
5. autorização e execução da leitura somente em ambiente forense aprovado para
   estrutura, timestamps, duplicidades e busca sanitizada;
6. revisão independente do digest e das conclusões.

O operador não deve copiar o CSV para este repositório para atender a essa
dependência. A análise deve ocorrer no local autorizado ou em ambiente forense
aprovado, sem criar cópia adicional quando a política não a exigir.

## Procedimento de validação do CSV pelo operador autorizado

O arquivo exato e o local autorizado já foram declarados pelo operador. As
etapas de conteúdo abaixo continuam sem execução neste relatório e dependem de
operador humano autorizado.

### 1. Preservação inicial e identidade do arquivo

- [ ] Confirmar que o arquivo é o original da exportação, não uma cópia
      reformatada, aberta e salva por planilha ou convertida.
- [ ] Colocar o arquivo sob leitura somente por controle do ambiente, sem
      alterar atributos ou conteúdo.
- [ ] Registrar nome lógico, caminho no cofre, custodiante, origem, data/hora da
      exportação, tamanho e timestamps do sistema de arquivos.
- [x] SHA-256 calculado pelo operador com `Get-FileHash` e declarado como
      correspondente à cópia de referência. Permanecem pendentes alias do
      operador, versão da ferramenta, horário UTC e revisão independente.
- [ ] Não abrir o CSV em aplicação que possa regravar delimitadores, encoding,
      fórmulas, datas ou finais de linha.
- [ ] Se já existir hash de aquisição, comparar os digests antes da análise. Em
      caso de divergência, interromper e investigar a cadeia de custódia.

O SHA-256 comprova estabilidade dos bytes entre medições. Ele não comprova que
o arquivo contém todos os logs existentes na origem.

### 2. Estrutura e quantidade de registros

- [ ] Detectar sem conversão: encoding, BOM, delimitador, caractere de escape,
      quote, cabeçalho e finais de linha.
- [ ] Usar parser CSV que respeite campos entre aspas e quebras de linha dentro
      de campos; não usar contagem bruta de linhas como contagem definitiva.
- [ ] Registrar nomes das colunas sem transcrever conteúdo potencialmente
      sensível.
- [ ] Confirmar que todas as linhas possuem estrutura válida ou registrar o
      número e posição lógica das linhas inválidas.
- [ ] Registrar separadamente: registros de dados parseados, cabeçalhos, linhas
      vazias, linhas inválidas e total físico de linhas.
- [ ] Comparar a contagem parseada com a declaração de 483 eventos.
- [ ] Se a contagem for diferente de 483, interromper a aprovação e esclarecer
      se houve cabeçalho, truncamento, nova exportação ou arquivo incorreto.

Uma contagem de 483 registros no arquivo confirma apenas a estrutura do corpus
recebido. Ela não demonstra que a fonte continha exatamente 483 eventos.

### 3. Timestamps e janelas

- [ ] Identificar a coluna de timestamp e o formato original.
- [ ] Confirmar se o valor traz `Z`/offset. Se não trouxer timezone, obter a
      definição da origem antes de converter; não presumir UTC.
- [ ] Rejeitar silenciosa normalização de datas por planilha.
- [ ] Validar timestamps parseáveis, precisão disponível, valores nulos,
      futuros, fora de ordem ou fora do intervalo exportado.
- [ ] Preservar o timestamp original e calcular UTC em campo de trabalho
      somente no ambiente forense, sem alterar o CSV.
- [ ] Classificar cada registro em exatamente um grupo:

```text
janela_critica:
  2026-10-22T21:23:41.265Z <= timestamp <= 2026-10-22T21:28:48.000Z

janela_ampliada_fora_da_critica:
  2026-10-22T21:08:41.000Z <= timestamp <= 2026-10-22T21:43:48.000Z
  e não pertence à janela crítica

fora_da_janela_ampliada:
  timestamp < 2026-10-22T21:08:41.000Z
  ou timestamp > 2026-10-22T21:43:48.000Z

timestamp_invalido_ou_ausente
```

- [ ] Registrar somente contagens, primeiro/último timestamp e anomalias
      sanitizadas por grupo.
- [ ] Conferir que a soma dos quatro grupos é igual ao total de registros.

### 4. Duplicidades

- [ ] Identificar duplicidade byte a byte de registros normalizados pelo parser,
      sem alterar o arquivo original.
- [ ] Identificar duplicidade lógica por ID de evento, quando existir.
- [ ] Se não houver ID, usar combinação documentada de timestamp, nó/instância,
      tipo, sessão/conexão e mensagem sanitizada.
- [ ] Separar repetição legítima de retransmissão/exportação duplicada.
- [ ] Registrar contagem de duplicados exatos, lógicos e grupos afetados.
- [ ] Não remover duplicados do original; gerar apenas resultado sanitizado.

### 5. Lacunas temporais

- [ ] Ordenar logicamente por timestamp sem regravar o CSV.
- [ ] Calcular intervalos entre eventos e registrar maior intervalo por janela.
- [ ] Comparar lacunas com frequência esperada, health events, mudança de nó ou
      outro indicador já presente na fonte.
- [ ] Verificar que o primeiro e o último evento cobrem os limites solicitados
      ou registrar que o corpus não contém eventos nesses limites.
- [ ] Não classificar silêncio entre eventos como perda de logs sem uma cadência
      esperada ou contador da origem.
- [ ] Tratar reinício de sequência, IDs ausentes, mudança abrupta de nó e
      intervalos incompatíveis com metadados de ingestão como lacunas possíveis.

Lacunas temporais no CSV podem indicar ausência de tráfego ou ausência de
registro. Somente metadados da origem permitem distinguir as duas hipóteses.

### 6. Filtros, limites e paginação

O operador deve anexar ao caso, de forma sanitizada:

- fonte exata consultada (`pgbouncer_logs` ou equivalente);
- janela solicitada e efetivamente aceita;
- timezone, ordenação e filtros aplicados;
- colunas selecionadas;
- total informado pela origem antes da exportação;
- limite máximo da interface/API;
- número de páginas, offsets/cursors e tamanho de cada página;
- erros, timeouts, rate limits, truncamento ou avisos;
- formato e método de exportação;
- data/hora, operador e versão da interface/API.

Critérios:

- [ ] A soma das páginas deve reconciliar com o total da origem.
- [ ] Sobreposições entre páginas devem ser identificadas por ID ou chave
      lógica.
- [ ] Lacunas de paginação devem bloquear a declaração de completude.
- [ ] Se 483 for apenas o limite/export disponível, o corpus é parcial.
- [ ] Ausência de metadados de paginação impede comprovar completude, mesmo que
      o arquivo seja íntegro.

### 7. Eventos relacionados à credencial

Sem procurar ou registrar a senha, executar buscas sanitizadas por:

- nome exato `cli_login_postgres` nos campos estruturados e na mensagem;
- autenticação iniciada, aceita, rejeitada ou encerrada;
- connection/session IDs, database e endpoint relacionados;
- erros de credencial, database, roteamento ou encerramento durante auth;
- `application_name`, cliente e origem, quando registrados;
- sessões que atravessem 21:28:48 UTC;
- eventos sem role explícita que possam ser correlacionados por ID compartilhado
  com outra fonte autorizada.

Resultados permitidos no relatório sanitizado:

```text
correspondencias_nome_exato: <n>
eventos_auth_correlacionaveis: <n>
eventos_inconclusivos: <n>
eventos_potencialmente_suspeitos: <n>
campos_ausentes_relevantes: <lista de nomes, sem valores>
```

Não copiar mensagem bruta, IP completo, token, connection string, dados
pessoais ou payload. Qualquer conteúdo sensível encontrado deve permanecer no
cofre do caso e ser substituído por alias ou `CONTEUDO_SENSIVEL_PRESENTE`.

## Integridade do arquivo versus completude dos logs

Estas conclusões são independentes:

| Dimensão | Pergunta | Evidência necessária | Conclusão possível |
| --- | --- | --- | --- |
| integridade do arquivo | os bytes permaneceram inalterados desde a aquisição? | SHA-256 consistente, custódia, timestamps e ausência de regravação | íntegro, divergente ou não demonstrado |
| validade estrutural | o CSV pode ser interpretado sem perda? | parser válido, esquema consistente, erros registrados e contagem reconciliada | válido, parcialmente válido ou inválido |
| completude da exportação | todas as páginas/linhas da consulta foram exportadas? | total da origem, limites, cursores/páginas e reconciliação | completa, parcial ou não demonstrada |
| completude da fonte | a origem registrou todos os eventos relevantes? | logging histórico, retenção, disponibilidade, gaps e semântica da fonte | coberta, limitada ou desconhecida |
| relevância | há evento atribuível à credencial? | buscas por role e correlação entre fontes | identificado, não identificado ou inconclusivo |

Um CSV pode ser íntegro e estruturalmente válido, mas incompleto na exportação
ou originado de uma fonte que não registrava todas as autenticações. Portanto,
“SHA-256 válido + 483 registros” não autoriza declarar ausência comprovada de
acesso indevido.

## Modelo de resultado sanitizado para o CSV

```text
evidencia_id: PGB-CSV-01
arquivo: supabase_logs (2).csv
local_autorizado_declarado: C:\FABIO-AUDITORIA\07C13B\
custodiante: <função/alias>
tamanho_bytes: <n>
sha256: 5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684
hash_confirmado_em: 2026-10-23; horário UTC não fornecido
ferramenta_hash: Get-FileHash / PowerShell; versão não fornecida
comparacao_hash: correspondente à cópia de referência, conforme operador
estrutura_csv: <valida|parcial|invalida>
registros_parseados: <n>
linhas_invalidas: <n>
duplicados_exatos: <n>
duplicados_logicos: <n>
janela_critica: <n>
janela_ampliada_fora_critica: <n>
fora_janela_ampliada: <n>
timestamp_invalido_ou_ausente: <n>
correspondencias_cli_login_postgres: <n>
eventos_inconclusivos: <n>
identidade_entre_copias: confirmada pelo operador; revisão independente pendente
integridade_arquivo: <integro|divergente|nao_demonstrada após revisão>
completude_exportacao: <completa|parcial|nao_demonstrada>
completude_fonte: <coberta|limitada|desconhecida>
limitacoes: <lista sanitizada>
validado_por: <alias>
revisado_por: <alias diferente>
```

## Sessão JSONL — inventário sem acesso ao conteúdo

O inventário deve ser realizado manualmente por operador autorizado depois que
a sessão estiver encerrada. Ele não deve abrir o arquivo em editor, visualizador
ou parser; não deve usar busca textual, preview, indexador, sincronização manual
ou cópia para outro local.

### Informações que o operador deve verificar

- [ ] identificador lógico da sessão e caminho exato, mantido apenas no registro
      restrito;
- [ ] confirmação de que o arquivo deixou de receber novas entradas;
- [ ] existência do arquivo, tipo, tamanho e timestamps de criação/modificação,
      obtidos por metadados do sistema de arquivos;
- [ ] proprietário, ACL/permissões e usuários/processos com acesso;
- [ ] criptografia do volume e proteção do endpoint;
- [ ] se o diretório participa de sincronização de perfil, nuvem, roaming,
      indexação, EDR, snapshot ou backup;
- [ ] política de retenção do histórico do Codex e mecanismo suportado para
      exclusão da sessão;
- [ ] cópias preexistentes, localização lógica, custodiante, retenção,
      imutabilidade e expiração;
- [ ] obrigações legais, contratuais, regulatórias, investigação ou `legal hold`;
- [ ] necessidade de preservar o original para a revisão independente;
- [ ] responsáveis por custódia, decisão, execução e aprovação.

Este inventário não inclui leitura do conteúdo. Também não inclui hash do JSONL
nesta etapa: uma ferramenta de hash processa os bytes do arquivo, ainda que não
os exiba. Se um digest for necessário para cadeia de custódia, ele exige
autorização humana específica, sessão fechada e ferramenta aprovada, registrando
somente o digest e sem produzir cópia.

### Estado de cada possível localização

Registrar uma linha para cada controlador, sem copiar o arquivo:

| Local/controlador | Existe? | Acesso | Retenção/expiração | Eliminação seletiva? | Responsável | Estado |
| --- | --- | --- | --- | --- | --- | --- |
| arquivo local original | sim/não/desconhecido | restrito/desconhecido | prazo | sim/não/desconhecido | alias | pendente |
| histórico/serviço Codex | sim/não/desconhecido | política | prazo | sim/não/desconhecido | alias | pendente |
| sincronização de perfil | sim/não/desconhecido | política | prazo | sim/não/desconhecido | alias | pendente |
| backup/snapshot preexistente | sim/não/desconhecido | política | prazo | sim/não/desconhecido | alias | pendente |
| proteção/indexação do endpoint | sim/não/desconhecido | política | prazo | sim/não/desconhecido | alias | pendente |

### Gate de decisão de retenção

Retenção restrita somente pode ser aprovada se:

- existir base legal, contratual ou investigativa documentada;
- prazo mínimo e evento de reavaliação estiverem definidos;
- acesso for nominal, mínimo e auditado;
- o original permanecer único, sem novas cópias de trabalho;
- backups/restaurações tiverem controles contra reintrodução do segredo;
- houver responsável por custódia e descarte futuro.

Eliminação somente pode ser aprovada se:

- não houver `legal hold` ou obrigação de retenção;
- a revisão dos logs e a revisão independente estiverem concluídas, ou o dono
  do risco autorizar formalmente prosseguir com as lacunas registradas;
- a evidência sanitizada for suficiente para a trilha de auditoria;
- o mecanismo suportado pelo Codex e seu alcance forem confirmados;
- original, sincronizações e backups gerenciáveis estiverem inventariados;
- dono do dado, segurança e jurídico/compliance, quando aplicável, aprovarem
  por escrito o escopo, método e momento;
- a comprovação registre apenas data, executor, método, escopo, resultado e
  exceções, nunca o conteúdo sensível.

Até a decisão, preservar o original com acesso restrito e sem novas cópias. Não
editar, redigir ou truncar o JSONL in-place. Backups imutáveis sem eliminação
seletiva devem seguir sua expiração aprovada e possuir controle de restauração.

## Pacote para revisão independente

O segundo responsável deve receber somente:

- relatórios sanitizados B.4, B.5, B.6, B.8 e este B.9;
- metadados e resultado sanitizado da validação PgBouncer, quando concluída;
- referência controlada à evidência primária, sem cópia automática;
- comprovação administrativa sanitizada da expiração e zero conexões ativas;
- formulário de cobertura/limitações das fontes;
- inventário metadata-only do JSONL e cópias preexistentes;
- matriz de riscos residuais e decisões pendentes.

O revisor não deve receber a senha, JSONL, token, connection string ou saída
bruta sem autorização separada e necessidade comprovada.

## Checklist do revisor independente

### A. Independência e escopo

- [ ] O revisor é pessoa diferente do operador e não aprovou a própria coleta.
- [ ] Escopo, fontes, janelas e limitações foram recebidos por escrito.
- [ ] Conflitos de interesse e acessos extraordinários foram declarados.
- [ ] O revisor entendeu que o objetivo não é provar um negativo além da
      capacidade das fontes.

### B. Contenção da credencial

- [ ] Confirmar a evidência administrativa de expiração às 21:28:48 UTC.
- [ ] Confirmar que zero conexões ativas é observação pontual posterior.
- [ ] Confirmar que `rolcanlogin=true` não reativa a senha expirada.
- [ ] Verificar que nenhuma senha principal, PAT ou workflow foi alterado sem
      evidência de necessidade.
- [ ] Concluir separadamente sobre contenção atual e possível uso histórico.

### C. Cobertura e limitações dos logs

- [ ] Conferir janelas crítica e ampliada, UTC, precisão e limites inclusivos.
- [ ] Revisar PostgreSQL, Supavisor, PgBouncer e fonte administrativa.
- [ ] Confirmar estado atual desativado e ausência de prova do estado histórico
      de `log_connections`/`log_disconnections`.
- [ ] Verificar retenção, campos, filtros, resultado, limite e paginação de cada
      fonte.
- [ ] Confirmar que zero resultado do Supavisor não foi tratado como ausência de
      acesso.
- [ ] Confirmar que indisponibilidade de Organization Audit Logs no plano Free
      não foi tratada como ausência de ação administrativa.
- [ ] Avaliar se Account Audit Logs, suporte, drains/arquivos preexistentes,
      EDR ou rede ainda são recuperáveis.

### D. Integridade das evidências

- [ ] Verificar origem, custódia, tamanho, timestamps e SHA-256 do CSV.
- [ ] Recalcular ou testemunhar o hash conforme a política e comparar digests.
- [ ] Confirmar parser, esquema, contagem de 483 registros e erros estruturais.
- [ ] Reconciliar grupos temporais, duplicidades e total.
- [ ] Revisar gaps sem confundir silêncio com perda de logs.
- [ ] Reconciliar total da origem, páginas e linhas exportadas.
- [ ] Reproduzir a busca por `cli_login_postgres` e eventos correlacionáveis.
- [ ] Classificar separadamente integridade do arquivo, completude da exportação
      e completude da fonte.
- [ ] Confirmar que a evidência primária não foi colocada neste repositório.

### E. Riscos residuais

- [ ] Avaliar o risco atual como contido sem inferir o risco histórico.
- [ ] Registrar que uso anterior permanece indeterminado enquanto a cobertura
      histórica não for comprovada.
- [ ] Identificar eventos inconclusivos ou potencialmente suspeitos.
- [ ] Atribuir responsável, prazo e controle compensatório a cada lacuna.
- [ ] Exigir aceite explícito do dono do risco para lacunas irrecuperáveis.

### F. Retenção do JSONL

- [ ] Confirmar que o conteúdo não foi aberto, lido, copiado ou alterado.
- [ ] Revisar inventário do original, serviço Codex, sincronizações, EDR,
      snapshots e backups preexistentes.
- [ ] Confirmar base e prazo de retenção ou os requisitos de eliminação.
- [ ] Verificar segregação de funções e aprovações exigidas.
- [ ] Bloquear eliminação enquanto houver `legal hold`, dependência
      investigativa ou aprovação incompleta.
- [ ] Confirmar que nenhum backup adicional foi criado para a revisão.

### G. Critérios de encerramento formal

- [ ] Contenção tecnicamente confirmada e documentada.
- [ ] Evidência PgBouncer validada ou sua indisponibilidade formalizada.
- [ ] Fontes externas/históricas recuperáveis examinadas ou justificadamente
      descartadas por decisão autorizada.
- [ ] Nenhum evento potencialmente suspeito permanece aberto.
- [ ] Eventos inconclusivos materiais foram resolvidos ou aceitos pelo dono do
      risco.
- [ ] Lacunas de logging foram formalmente aceitas sem serem convertidas em
      prova de ausência.
- [ ] Decisão sobre JSONL e backups foi aprovada e executada quando aplicável.
- [ ] Riscos residuais possuem responsáveis e controles.
- [ ] Termo final usa linguagem limitada às evidências.

## Decisão do revisor

O revisor deve escolher somente uma opção e justificar:

```text
[ ] APROVAR A VALIDAÇÃO DOCUMENTAL
    A documentação é coerente, as limitações estão registradas e as pendências
    podem seguir para decisão humana. Isto não encerra o incidente.

[ ] SOLICITAR COMPLEMENTAÇÃO
    Há evidência recuperável, inconsistência, metadado ausente ou análise que
    precisa ser repetida antes de qualquer decisão.

[ ] ESCALAR INVESTIGAÇÃO
    Existe evento potencialmente suspeito, quebra de custódia, divergência de
    hash, indício de truncamento ou risco material não tratado.

[ ] REJEITAR ENCERRAMENTO
    Os critérios formais, a retenção da evidência ou o aceite dos riscos não
    estão completos.
```

Registro obrigatório:

```text
revisor_alias:
funcao:
data_hora_utc:
decisao:
ressalvas:
pendencias:
responsaveis_e_prazos:
assinatura_ou_aprovacao_no_sistema:
```

## Condições para futura preparação do encerramento

Antes de redigir qualquer termo de encerramento:

1. revisar de forma independente a identificação do CSV, o SHA-256 declarado e
   a cadeia de custódia;
2. concluir e revisar a validação estrutural e temporal do CSV;
3. obter ou declarar irrecuperáveis os metadados de filtros/paginação e logging
   histórico;
4. consultar fontes externas ainda recuperáveis mediante autorização, ou
   documentar a decisão de não consultar;
5. concluir a revisão independente;
6. aprovar a retenção ou eliminação do JSONL e das cópias preexistentes;
7. aceitar formalmente as lacunas de auditoria e riscos residuais;
8. manter a formulação de que ausência de referência não prova ausência de
   acesso indevido.

Se as lacunas permanecerem irrecuperáveis, eventual encerramento deverá ser
registrado como encerramento com lacunas de auditoria formalmente aceitas, não
como comprovação de que nenhum acesso ocorreu.

## Veredito desta etapa

**IDENTIDADE DE CONTEÚDO ENTRE AS CÓPIAS DO CSV CONFIRMADA PELO OPERADOR;
COMPLETUDE DA EXPORTAÇÃO E DA FONTE NÃO COMPROVADAS; JSONL NÃO ACESSADO;
REVISÃO INDEPENDENTE PENDENTE.**

Não há base para declarar ausência comprovada de acesso indevido ou encerrar o
incidente. A próxima ação depende de um operador humano executar as validações
estrutural, temporal e de paginação em ambiente restrito e submeter o digest,
a cadeia de custódia e o resultado sanitizado a um segundo responsável.
