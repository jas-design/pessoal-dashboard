# Etapa 07C.13B.11 — inventário de retenção da sessão JSONL

Data de preparação: 23/10/2026. Estado: **INVENTÁRIO DOCUMENTAL PREPARADO;
SESSÃO JSONL NÃO ACESSADA; DECISÃO DE RETENÇÃO OU ELIMINAÇÃO, REVISÃO
INDEPENDENTE E ENCERRAMENTO DO INCIDENTE PENDENTES**.

## Objetivo, escopo e limites

Este relatório prepara a decisão humana sobre a retenção ou eliminação da
sessão do Codex associada à exposição da credencial `cli_login_postgres`.
Foram revisados exclusivamente os relatórios sanitizados das Etapas 07C.13B.9
e 07C.13B.10 e a documentação oficial do Codex pertinente a histórico,
arquivamento e exclusão de sessões.

Nenhuma sessão JSONL foi localizada, enumerada, aberta, lida, pré-visualizada,
copiada, movida, modificada, hashada ou eliminada. Também não houve acesso a
credenciais, produção, Supabase, PostgreSQL, n8n, arquivos `.env`, migrations,
workflows ou configurações. Não foram executados SQL, autenticação, busca
indiscriminada ou comando destrutivo.

Este documento não autoriza qualquer ação operacional sobre a sessão. Ele não
declara ausência de acesso indevido nem encerramento do incidente.

## Evidências existentes sobre a exposição

### Evidências documentais consolidadas

- A ocorrência envolve exposição da senha PostgreSQL da credencial
  `cli_login_postgres` em uma sessão do Codex.
- A senha foi documentada como expirada em 22/10/2026 às 21:28:48 UTC. Isso
  contém o risco de uso futuro da senha expirada, mas não resolve o possível
  uso anterior nem elimina as cópias que possam conter o segredo.
- A janela crítica registrada é 22/10/2026, 21:23:41.265–21:28:48 UTC; a
  janela ampliada é 21:08:41–21:43:48 UTC.
- O CSV PgBouncer autorizado possui SHA-256
  `5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684`,
  483 registros estruturalmente válidos, 40 eventos na janela crítica e 283 na
  janela ampliada.
- Não foi encontrada referência exata a `cli_login_postgres` no corpus
  PgBouncer. Isso significa somente que a referência não foi identificada
  naquele arquivo; não comprova ausência de autenticação ou acesso.
- A completude da exportação PgBouncer, filtros, paginação e cobertura da fonte
  continuam não demonstradas. O estado histórico do logging e outras lacunas
  de auditoria também permanecem pendentes.
- A cadeia de custódia do CSV, a revisão independente e o aceite dos riscos
  residuais ainda não foram concluídos.

### Consequência para a decisão sobre o JSONL

O JSONL pode ser simultaneamente uma fonte primária para reconstrução do
incidente e um recipiente de segredo exposto. Sua eliminação prematura pode
destruir evidência; sua retenção sem controles prolonga a superfície de
exposição. A decisão deve, portanto, ser condicionada ao valor probatório, às
obrigações de retenção, à suficiência das evidências sanitizadas e ao risco de
acesso ou restauração do conteúdo sensível.

## Sessões potencialmente envolvidas

Com base apenas no que já está documentado, é possível identificar o seguinte
conjunto lógico, sem apontar arquivos no sistema:

| Candidato | Base documental | Estado |
| --- | --- | --- |
| sessão original do Codex na qual ocorreu a exposição | os relatórios B.9 e B.10 tratam expressamente de uma sessão JSONL associada ao incidente | existência lógica documentada; UUID, nome e caminho exato desconhecidos neste inventário |
| sessões descendentes ou bifurcadas da sessão original | o Codex admite sessões descendentes/forks, mas os relatórios não registram se houve alguma neste caso | existência não demonstrada; verificação metadata-only pelo operador |
| registro de histórico ou índice que referencie a sessão | a documentação oficial informa persistência local sob `CODEX_HOME`, inclusive `history.jsonl` quando habilitado | aplicabilidade ao ambiente e vínculo com a sessão desconhecidos |
| thread persistida em servidor Codex local ou remoto | o mecanismo oficial admite sessões salvas locais ou em app-server remoto | uso de servidor local/remoto neste incidente não documentado |

Não há, nos relatórios examinados, nome de arquivo, UUID, nome de sessão,
caminho exato, quantidade de arquivos ou comprovação de descendentes. O
operador não deve deduzir o alvo apenas pela data nem fazer varredura ampla no
sistema. A identificação deve partir do identificador já visível no produto,
do registro restrito do caso ou de metadados administrativos autorizados.

## Inventário de metadados

### Metadados já disponíveis

| Campo | Valor/estado documental |
| --- | --- |
| projeto | FABIO Dashboard |
| incidente | exposição da credencial `cli_login_postgres` em sessão do Codex |
| data associada | 22/10/2026 |
| expiração da senha | 22/10/2026 21:28:48 UTC |
| conteúdo sensível esperado | credencial PostgreSQL; não reproduzida neste relatório |
| contenção atual | senha expirada, conforme documentação do incidente |
| decisão de retenção | pendente |
| revisão independente | pendente |
| `legal hold`/obrigação de retenção | desconhecido |
| JSONL acessado nesta etapa | não |
| cópia ou backup criado nesta etapa | não |

### Metadados desconhecidos a serem verificados pelo operador

Sem abrir o conteúdo, o operador autorizado deve registrar em repositório
restrito:

- identificador UUID e, se houver, nome lógico da sessão;
- caminho lógico exato do original, sem publicá-lo em relatório aberto;
- existência, tipo, tamanho e timestamps do sistema de arquivos;
- estado ativo, encerrado ou arquivado e confirmação de que não recebe novas
  gravações;
- existência e identificadores de sessões descendentes/forks;
- proprietário, ACL/permissões, grupos e processos autorizados;
- criptografia do volume e controles do endpoint;
- política efetiva de histórico, prazo e controlador responsável;
- vínculo com histórico/índice local, sem abrir o conteúdo;
- uso de app-server local ou remoto e controlador da persistência;
- mecanismos de sincronização, backup, snapshot, indexação ou EDR aplicáveis;
- cópias preexistentes, seus custodiantes, imutabilidade, expiração e capacidade
  de eliminação seletiva;
- existência de obrigação legal, contratual, regulatória, investigativa ou
  `legal hold`;
- data, método e responsável por eventual ação futura.

O hash do JSONL não integra esta etapa. Embora não exiba o conteúdo, o cálculo
processa os bytes da evidência e exige autorização específica, sessão encerrada
e método aprovado. Se autorizado no futuro, somente o digest e os metadados de
custódia devem ser registrados; não deve ser criada cópia.

## Possíveis locais e mecanismos de retenção

Os itens abaixo são hipóteses de controle a verificar, não afirmações de que
existam no ambiente:

| Local/controlador possível | O que o operador deve confirmar | Estado atual |
| --- | --- | --- |
| sessão original persistida pelo Codex | identificador, estado, metadados, ACL e prazo | desconhecido |
| sessão arquivada e descendentes/forks | existência e relação de parentesco sem abrir transcript | desconhecido |
| histórico/índice sob `CODEX_HOME` | persistência habilitada, referências e política aplicável | desconhecido |
| app-server Codex local ou remoto | uso no incidente, controlador, localização lógica e alcance da exclusão | desconhecido |
| sincronização de perfil, roaming ou nuvem | escopo, conta/controlador, versões e exclusão seletiva | desconhecido |
| backup corporativo ou pessoal preexistente | política, janela, imutabilidade, expiração e restauração | desconhecido |
| snapshot, File History, VSS ou imagem do endpoint | existência, controlador e capacidade de expiração | desconhecido |
| EDR, antivírus, indexação, telemetria ou diagnóstico | eventual captura, retenção, acesso e descarte | desconhecido |
| armazenamento do serviço ou política organizacional | retenção contratual/administrativa e mecanismo de solicitação | desconhecido |

A documentação oficial informa que o Codex guarda estado local sob
`CODEX_HOME` e pode manter `history.jsonl` quando a persistência está habilitada.
Ela também permite configurar a persistência futura e o limite do histórico.
Essas opções não demonstram o estado histórico desta máquina e não constituem
eliminação retroativa da sessão. Consulte a
[configuração avançada oficial do Codex](https://learn.chatgpt.com/docs/config-file/config-advanced).

Não se deve presumir que a exclusão da sessão principal alcance backups,
snapshots, sincronizações, caches, retenção contratual ou sistemas externos. O
alcance de cada controlador deve ser confirmado separadamente.

## Riscos de retenção e eliminação

### Retenção

Benefícios:

- preserva a fonte primária para revisão independente e cadeia de custódia;
- permite esclarecer cronologia, escopo e contexto se as demais fontes forem
  inconclusivas;
- evita destruição incompatível com investigação, contrato ou `legal hold`.

Riscos:

- mantém uma credencial histórica e possivelmente outros dados sensíveis
  acessíveis a usuários, malware, indexadores ou processos autorizados em
  excesso;
- pode propagar ou perpetuar o segredo por sincronização, backup e restauração;
- prolonga exposição sem necessidade se não houver finalidade e prazo;
- pode gerar obrigação adicional de proteção, auditoria e descarte futuro.

### Eliminação

Benefícios:

- reduz a superfície de exposição do segredo na cópia controlada;
- atende minimização de dados quando não existe base legítima para retenção;
- reduz o risco de restauração ou reutilização acidental, desde que todos os
  controladores aplicáveis sejam tratados.

Riscos:

- destrói evidência primária antes da revisão independente;
- pode violar obrigação legal, contratual, regulatória ou `legal hold`;
- pode impedir a reconstrução posterior de fatos não cobertos pelos logs;
- pode excluir sessões descendentes, conforme o mecanismo empregado;
- pode dar falsa impressão de eliminação completa se backups, sincronizações ou
  retenção remota permanecerem;
- é irreversível no mecanismo de exclusão permanente e não deve ser usado como
  teste.

## Alternativas de tratamento

### A. Retenção temporária protegida

Aplicável enquanto a revisão independente, o inventário de controladores ou a
decisão jurídica estiverem pendentes.

Condições mínimas:

- sessão encerrada e sem novas gravações;
- acesso nominal, mínimo, auditável e restrito aos responsáveis;
- endpoint e volume protegidos, sem criar cópia adicional;
- proibição de abrir o conteúdo salvo autorização investigativa específica;
- custodiante, finalidade, prazo curto e data de reavaliação definidos;
- bloqueio ou controle de restauração que possa reintroduzir o segredo;
- registro de exceções para cópias imutáveis preexistentes.

### B. Retenção conforme política de segurança

Aplicável quando houver base investigativa, legal, contratual ou regulatória.

Condições mínimas:

- política e fundamento citados no registro da decisão;
- classificação da informação, prazo e evento de descarte definidos;
- segregação de funções e revisão periódica de acesso;
- inventário de original, referências, descendentes e cópias preexistentes;
- controles documentados de backup e restauração;
- eliminação futura designada a um responsável e sujeita a nova aprovação.

### C. Eliminação autorizada pelo mecanismo suportado do Codex

Aplicável somente após todos os gates da seção de aprovação. A documentação
oficial diferencia arquivamento de exclusão: `codex archive` apenas arquiva uma
sessão salva, enquanto `codex delete <SESSION>` a elimina permanentemente por
ID ou nome. O comando interativo `/delete` elimina a sessão atual e as sessões
descendentes após confirmação. Consulte a
[referência da CLI](https://learn.chatgpt.com/docs/cli/reference) e os
[comandos de desenvolvedor](https://learn.chatgpt.com/docs/developer-commands).

Regras para eventual execução humana:

- não editar, truncar ou apagar manualmente o JSONL;
- identificar inequivocamente a sessão por UUID/ID antes da ação;
- preferir fluxo com confirmação; não usar opção sem prompt como rotina;
- confirmar previamente o possível alcance sobre descendentes;
- obter todas as aprovações por escrito e registrar o ticket/decisão;
- executar somente por operador autorizado, fora desta etapa;
- registrar data/hora UTC, executor, versão, método, alvo lógico, resultado e
  exceções, sem conteúdo sensível;
- verificar por metadados que a sessão deixou de estar disponível;
- tratar separadamente backups, sincronizações e retenção externa.

No app-server, a operação oficial `thread/delete` também é descrita como
exclusão permanente da thread persistida e de seus descendentes. Isso confirma
o alcance funcional do mecanismo, mas não prova purga em controladores externos
ao serviço. Consulte a
[documentação oficial do app-server](https://learn.chatgpt.com/docs/app-server).

**Arquivamento não equivale a eliminação.** Ele pode retirar a sessão da lista
ativa, mas preserva o transcript e, portanto, não atende sozinho a uma decisão
de descarte.

## Matriz de decisão

| Condição | Retenção temporária protegida | Retenção por política | Eliminação suportada |
| --- | --- | --- | --- |
| revisão independente pendente | **preferida** | possível se já houver base | bloqueada, salvo aceite excepcional e formal do dono do risco |
| `legal hold` ou obrigação de retenção | possível | **obrigatória conforme a regra aplicável** | bloqueada |
| valor probatório ainda material | **preferida** | possível | bloqueada até preservação documental suficiente e aprovação |
| ausência de finalidade legítima após revisão | somente até executar decisão | não indicada | **preferida**, com aprovações e inventário completos |
| backups imutáveis sem exclusão seletiva | reter sob controle e documentar | seguir expiração da política | eliminar o original gerenciável e registrar exceção/expiração do backup |
| sessão/descendentes não identificados de modo inequívoco | manter estado atual protegido | não decidir ainda | bloqueada |
| mecanismo e alcance de exclusão não confirmados | manter estado atual protegido | possível | bloqueada |
| riscos residuais não aceitos | reter e escalar | reter conforme base | bloqueada |

Escolher retenção não autoriza abrir o conteúdo. Escolher eliminação não
autoriza executá-la até que todos os aprovadores e o operador designado tenham
registrado a decisão.

## Aprovações humanas necessárias

Antes de qualquer eliminação, devem constar no registro restrito:

- responsável pelo incidente/Segurança: confirma valor probatório, contenção e
  riscos residuais;
- custodiante da evidência: confirma identidade lógica, estado e cadeia de
  custódia;
- dono do dado ou do sistema: aprova finalidade, prazo e impacto;
- Jurídico/Compliance/Privacidade, quando aplicável: confirma ausência de
  `legal hold` e obrigações de retenção;
- administrador do Codex ou responsável técnico: confirma mecanismo suportado,
  alvo e alcance sobre descendentes/local ou remoto;
- responsável por backup/sincronização: confirma cópias preexistentes,
  expiração, exceções e controle de restauração;
- segundo revisor independente: valida evidências, limitações, matriz e
  suficiência da trilha sanitizada;
- dono do risco: aceita formalmente lacunas irrecuperáveis e risco residual.

Uma mesma pessoa não deve aprovar, custodiar e executar sozinha a eliminação
quando a organização permitir segregação de funções.

## Checklist do operador para documentar a decisão

### 1. Identificação metadata-only

- [ ] Confirmar que a sessão está encerrada e não recebe gravações.
- [ ] Obter UUID/ID e nome lógico por interface ou metadado autorizado, sem
      abrir o transcript.
- [ ] Registrar o caminho exato somente no registro restrito.
- [ ] Registrar existência, tipo, tamanho e timestamps sem hash ou leitura de
      conteúdo nesta etapa.
- [ ] Registrar proprietário, ACL e proteção do volume/endpoint.
- [ ] Confirmar se existem descendentes/forks e registrar somente seus IDs.
- [ ] Não pesquisar por senha, conteúdo ou trechos da conversa.

### 2. Retenção distribuída

- [ ] Confirmar a política efetiva de histórico do Codex no momento do
      incidente, sem alterá-la.
- [ ] Confirmar uso ou não de app-server local/remoto.
- [ ] Verificar sincronização de perfil, roaming e nuvem aplicáveis.
- [ ] Verificar backups, snapshots, VSS/File History e imagens preexistentes.
- [ ] Verificar EDR, antivírus, indexação, diagnóstico ou telemetria aplicável.
- [ ] Registrar controlador, custodiante, prazo, imutabilidade e eliminação
      seletiva para cada local existente.
- [ ] Não criar cópia ou backup adicional durante o inventário.

### 3. Base da decisão

- [ ] Confirmar `legal hold` e obrigações legais, contratuais ou regulatórias.
- [ ] Confirmar se a revisão independente precisa do original.
- [ ] Confirmar suficiência das evidências sanitizadas para auditoria futura.
- [ ] Documentar riscos de retenção e eliminação.
- [ ] Selecionar uma única alternativa: temporária, por política ou eliminação.
- [ ] Definir prazo, evento de reavaliação e responsável.
- [ ] Registrar exceções de backups imutáveis e controles de restauração.

### 4. Aprovação e eventual execução

- [ ] Obter aprovações nominais exigidas e respectivos timestamps UTC.
- [ ] Obter parecer do revisor independente.
- [ ] Confirmar alvo e alcance do mecanismo imediatamente antes da ação.
- [ ] Se a decisão for reter, aplicar somente controles aprovados, sem mover ou
      copiar o arquivo.
- [ ] Se a decisão for eliminar, designar operador humano e usar somente o
      mecanismo suportado do Codex, com confirmação.
- [ ] Não executar exclusão enquanto houver sessão ativa, alvo ambíguo,
      aprovação incompleta, `legal hold` ou dependência investigativa.
- [ ] Registrar o resultado sem senha, transcript, token ou outro segredo.
- [ ] Não tratar eliminação local como prova automática de purga externa.

### Modelo de registro sanitizado

```text
decisao_id:
session_id_alias:
session_uuid_confirmado: sim/nao
sessao_encerrada: sim/nao
descendentes_identificados: sim/nao/desconhecido
conteudo_acessado: nao
copias_novas_criadas: nao
controladores_inventariados: <lista de classes, sem caminhos sensiveis>
legal_hold: sim/nao/desconhecido
base_da_decisao:
alternativa: retencao_temporaria | retencao_politica | eliminacao_suportada
prazo_ou_data_de_reavaliacao:
excecoes_de_backup:
riscos_residuais:
aprovador_seguranca:
aprovador_dono_do_dado:
aprovador_juridico_compliance:
revisor_independente:
operador_designado:
metodo_suportado_planejado:
execucao_realizada: nao | sim, somente apos autorizacao
data_hora_utc:
resultado_sanitizado:
ticket_ou_registro_de_aprovacao:
```

## Pendências para revisão independente

O segundo responsável ainda deve:

- [ ] confirmar a identidade lógica da sessão sem abrir o conteúdo;
- [ ] confirmar se há descendentes/forks ou persistência local/remota;
- [ ] revisar existência, ACL, criptografia, estado encerrado e metadados;
- [ ] validar o inventário de sincronizações, backups, snapshots, EDR e
      retenção do serviço;
- [ ] verificar obrigações de retenção e eventual `legal hold`;
- [ ] confirmar a suficiência da evidência sanitizada antes de qualquer
      eliminação;
- [ ] revisar o alcance do mecanismo suportado, inclusive descendentes;
- [ ] reproduzir ou aprovar as conclusões técnicas do CSV PgBouncer;
- [ ] resolver ou aceitar formalmente as lacunas de filtros, paginação,
      logging histórico e cadeia de custódia;
- [ ] recomendar uma alternativa e registrar ressalvas, responsáveis e prazo;
- [ ] manter o encerramento formal bloqueado até decisão e aceite de riscos.

## Condições para decisão e encerramento futuro

A decisão sobre o JSONL estará pronta somente quando:

1. a sessão e eventuais descendentes estiverem inequivocamente identificados;
2. o inventário metadata-only dos controladores estiver completo;
3. obrigações de retenção e `legal hold` tiverem sido avaliados;
4. valor probatório e suficiência da trilha sanitizada tiverem sido aprovados;
5. revisão independente e segregação de funções estiverem registradas;
6. riscos residuais e lacunas de auditoria tiverem dono e aceite formal;
7. alternativa, prazo, método, alcance e operador estiverem aprovados;
8. backups e restaurações tiverem tratamento ou exceção documentados.

Mesmo após uma futura decisão e execução sobre o JSONL, o encerramento formal
do incidente continuará condicionado às demais pendências das Etapas B.9 e
B.10, especialmente filtros/paginação, cadeia de custódia, revisão
independente e aceite humano dos riscos residuais.

## Veredito desta etapa

**A EVIDÊNCIA JSONL NÃO FOI ACESSADA NEM ALTERADA POR ESTA ETAPA. NÃO HÁ
IDENTIFICADOR, CAMINHO OU INVENTÁRIO DE CONTROLADORES CONFIRMADOS NOS RELATÓRIOS
EXAMINADOS. A OPÇÃO PROVISÓRIA SEGURA É MANTER O ESTADO ATUAL SOB ACESSO
RESTRITO, SEM NOVAS CÓPIAS, ATÉ A IDENTIFICAÇÃO METADATA-ONLY, A REVISÃO
INDEPENDENTE E AS APROVAÇÕES HUMANAS.**

Nenhuma retenção definitiva, alteração, arquivamento ou eliminação foi
executada ou autorizada por este relatório. O incidente permanece aberto.
