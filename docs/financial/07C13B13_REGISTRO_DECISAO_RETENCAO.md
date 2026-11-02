# Etapa 07C.13B.13 — registro da decisão de retenção

Data da manifestação: 23/10/2026. Estado: **MANIFESTAÇÃO DE AUTORIDADE E
ESCOLHA DE RETENÇÃO TEMPORÁRIA PROTEGIDA REGISTRADAS; APROVAÇÃO FINAL ASSINADA,
IMPLEMENTAÇÃO DOS CONTROLES E REVISÃO INDEPENDENTE PENDENTES; INCIDENTE NÃO
ENCERRADO**.

## Objetivo, escopo e limites

Este documento formaliza, em nível documental, a manifestação comunicada pelo
responsável pelo projeto sobre as evidências relacionadas ao incidente
`cli_login_postgres`. A modalidade selecionada é retenção temporária protegida,
com a finalidade de preservar evidências para auditoria e revisão independente.

O registro distingue três atos diferentes:

1. a manifestação comunicada de que o responsável possui autoridade;
2. a escolha substantiva da modalidade de retenção temporária protegida;
3. a aprovação final assinada, ainda pendente de identificação, confirmação e
   registro formal.

Este relatório não substitui assinatura, aprovação em sistema corporativo ou
ticket autorizado. Também não concede autorização operacional para inventário,
acesso, alteração de permissões, arquivamento ou exclusão.

Nenhuma sessão JSONL foi localizada, enumerada, aberta, lida, copiada, movida,
renomeada, modificada, hashada ou excluída. Nenhuma permissão foi alterada.
Não houve execução de comando do Codex, autenticação, SQL ou acesso ao
Supabase, PostgreSQL, n8n ou produção. Migrations, workflows e credenciais não
foram modificados.

## Manifestação de autoridade registrada

Foi comunicada a seguinte manifestação, tratada como declaração fornecida pelo
operador/responsável e ainda sujeita a formalização:

| Campo | Registro |
| --- | --- |
| projeto | FABIO Dashboard |
| incidente | exposição da credencial `cli_login_postgres` |
| declarante | responsável pelo projeto; identidade/alias formal pendente |
| autoridade declarada | autoridade para aprovar a retenção das evidências relacionadas ao incidente |
| modalidade escolhida | retenção temporária protegida |
| finalidade | preservar evidências para auditoria e revisão independente |
| data da manifestação | 23/10/2026 |
| horário e timezone da manifestação | não fornecidos |
| reavaliação proposta | 30/10/2026 |
| eliminação | não autorizada |
| leitura de conteúdo sensível | não autorizada |
| controles de acesso | implementação pendente |
| obrigações legais/contratuais | avaliação pendente |
| revisor independente | não designado |

### Valor documental da manifestação

A manifestação permite registrar a intenção, a finalidade e a modalidade
escolhida. Ela não comprova, isoladamente:

- a identidade do signatário;
- o cargo, mandato ou delegação vigente;
- a data/hora UTC exata da decisão;
- a assinatura ou aprovação no sistema oficial;
- a avaliação de `legal hold` e obrigações contratuais;
- a implementação de controles de acesso;
- a autorização para executar inventário metadata-only;
- o aceite dos riscos residuais;
- a conclusão da revisão independente.

Até que esses elementos sejam formalizados, a manifestação funciona como
diretriz de preservação e bloqueio de descarte, não como ordem operacional.

## Decisão substantiva e condições

### Modalidade selecionada

**Retenção temporária protegida**, para preservar a possível evidência primária
sem acessar o conteúdo sensível.

### Período proposto

- início documental da manifestação: 23/10/2026;
- reavaliação proposta: 30/10/2026;
- início operacional da retenção controlada: somente após aprovação final e
  verificação da implementação;
- término ou descarte: não autorizado e não definido nesta etapa.

A data de 30/10/2026 é um marco de reavaliação, não uma data automática de
eliminação, expiração ou conversão para retenção definitiva. Se a aprovação
final não ocorrer até essa data, o caso deve ser escalado sem alterar ou
descartar a evidência.

### Condições vinculantes

- finalidade limitada a auditoria e revisão independente;
- nenhuma leitura do conteúdo sensível;
- nenhuma eliminação, limpeza, arquivamento ou descarte;
- nenhuma cópia, movimento, renomeação, modificação ou hash;
- nenhuma alteração de permissões sem autorização técnica separada;
- nenhuma localização automática ou busca indiscriminada;
- metadados somente após autorização específica e delimitada;
- avaliação legal/contratual obrigatória;
- designação obrigatória de revisor independente;
- manutenção das lacunas de logs e do risco histórico como pendências;
- nova decisão humana na reavaliação de 30/10/2026.

## Estado da aprovação

| Elemento | Estado | Evidência necessária |
| --- | --- | --- |
| declaração de autoridade | registrada por manifestação comunicada | identidade e vínculo formal |
| escolha da modalidade | registrada | confirmação assinada |
| finalidade | registrada | aprovação assinada |
| data da manifestação | registrada como 23/10/2026 | horário UTC e registro de origem |
| reavaliação | proposta para 30/10/2026 | confirmação no ato assinado |
| proibição de eliminação | registrada | deve permanecer expressa na aprovação |
| proibição de leitura | registrada | deve permanecer expressa na aprovação |
| aprovação final | pendente | assinatura ou aprovação no sistema oficial |
| autorização metadata-only | não concedida | autorização separada e delimitada |
| controles de acesso | não implementados/verificados | plano aprovado e evidência sanitizada de implementação |
| avaliação legal/contratual | pendente | parecer ou registro de aplicabilidade |
| revisão independente | pendente | designação e parecer de segundo responsável |
| aceite dos riscos residuais | pendente | decisão expressa do dono do risco |

## Registro formal para aprovação final

O bloco abaixo deve ser preenchido e assinado pelo responsável autorizado. Ele
não deve conter senha, transcript, connection string, token, caminho sensível
ou qualquer conteúdo da sessão.

```text
registro_id:
projeto: FABIO Dashboard
incidente: cli_login_postgres
etapa: 07C.13B.13

nome_ou_alias_do_responsavel:
cargo_ou_funcao:
base_da_autoridade_ou_delegacao:
identidade_validada_por:
canal_oficial_de_aprovacao:

modalidade: retencao_temporaria_protegida
finalidade: preservar evidencias para auditoria e revisao independente
data_da_manifestacao: 2026-10-23
data_hora_da_aprovacao_utc:
data_de_reavaliacao: 2026-10-30
evento_de_revisao_antecipada:

leitura_de_conteudo_autorizada: nao
eliminacao_autorizada: nao
arquivamento_codex_autorizado: nao
alteracao_de_permissoes_autorizada: nao
inventario_metadata_only_autorizado: nao, exige ato separado

legal_hold: sim | nao | pendente
obrigacoes_legais_contratuais:
custodiante_designado:
operador_designado:
revisor_independente_designado:
dono_do_risco:

condicoes_obrigatorias:
excecoes_aprovadas:
riscos_residuais_reconhecidos:
justificativa:

decisao_final:
[ ] APROVAR A RETENCAO TEMPORARIA PROTEGIDA
[ ] APROVAR COM RESSALVAS
[ ] SOLICITAR COMPLEMENTACAO
[ ] REJEITAR

assinatura_ou_aprovacao_no_sistema:
referencia_do_ticket:
```

O registro somente deve ser classificado como aprovação final quando identidade,
autoridade, decisão, condições, timestamp UTC e assinatura ou aprovação no
sistema estiverem completos e verificáveis.

## Minuta de autorização para inventário metadata-only

**ESTADO DESTA MINUTA: NÃO AUTORIZADA. NÃO EXECUTAR.**

Esta minuta prepara uma futura autorização separada. O responsável deve
preenchê-la e assiná-la antes de qualquer identificação ou consulta de
metadados.

```text
autorizacao_id:
vinculo_com_registro_b13:
aprovador:
operador_autorizado:
data_hora_inicio_utc:
data_hora_expiracao_utc:

finalidade_exclusiva:
identificar a sessao, seu estado, descendentes e controladores de retencao sem
abrir, ler, hashizar, copiar ou alterar conteudo

alvo_inicial_fornecido:
session_uuid_ou_alias: <obrigatorio; nao usar busca ampla>
fonte_administrativa_autorizada:

campos_permitidos:
- existencia
- UUID/ID ou alias controlado
- nome logico ja visivel administrativamente
- estado ativo, encerrado ou arquivado
- tipo, tamanho e timestamps do sistema de arquivos
- relacao pai/descendente
- proprietario, grupos e ACL em modo somente leitura
- controlador, politica de retencao e expiracao
- inclusao em sincronizacao ou backup, sem acesso a copia

acoes_proibidas:
- abrir, visualizar, pesquisar ou interpretar o transcript
- calcular hash
- copiar, mover, renomear, compactar ou exportar
- alterar ACL, atributo, timestamp, configuracao ou estado
- arquivar, excluir, limpar ou truncar
- enumerar diretorios ou arquivos fora do alvo delimitado
- baixar ou restaurar copias e backups
- ampliar o escopo sem nova autorizacao

criterios_de_interrupcao:
- alvo ambiguo ou UUID ausente
- exibicao automatica de conteudo
- sessao ainda em gravacao
- necessidade de escrita ou de permissao adicional
- divergencia de identidade ou parentesco
- controlador nao previsto
- legal hold ou bloqueio tecnico identificado

registro_de_saida_permitido:
- metadados sanitizados, estados e contagens agregadas
- nenhum segredo, transcript, caminho sensivel ou identificador desnecessario

decisao:
[ ] AUTORIZAR NO ESCOPO ACIMA
[ ] AUTORIZAR COM RESSALVAS
[ ] NAO AUTORIZAR

assinatura_ou_aprovacao_no_sistema:
data_hora_utc:
```

Sem alvo inicial inequívoco, operador nominal, fonte autorizada, prazo e
assinatura, a minuta permanece sem efeito. Este documento não preenche nem
marca a opção de autorização.

## Critérios para implementação dos controles de acesso

A implementação permanece pendente e requer autorização separada. Antes de
qualquer mudança de permissão, devem ser satisfeitos todos os critérios:

### Governança

- [ ] aprovação final assinada e verificável;
- [ ] custodiante e operador nominalmente designados;
- [ ] revisor independente designado;
- [ ] finalidade, escopo, prazo e data de reavaliação confirmados;
- [ ] avaliação de `legal hold` e obrigações contratuais registrada;
- [ ] plano de mudança, impacto, validação e reversão aprovado;
- [ ] segregação entre aprovação, execução e revisão, quando viável;
- [ ] sistema de registro/ticket definido.

### Identidade e escopo

- [ ] sessão identificada inequivocamente por metadata-only autorizado;
- [ ] estado encerrado e ausência de novas gravações confirmados;
- [ ] descendentes, sincronizações e backups classificados ou marcados como
      desconhecidos com risco formalizado;
- [ ] permissões atuais registradas sem alteração;
- [ ] contas e grupos que devem manter acesso listados nominalmente;
- [ ] nenhum alvo fora do escopo incluído.

### Desenho do controle

- [ ] menor privilégio e necessidade de conhecer;
- [ ] contas individuais, sem compartilhamento;
- [ ] autenticação forte e endpoint protegido segundo política aplicável;
- [ ] acesso de leitura somente quando necessário, sem autorização de conteúdo;
- [ ] trilha auditável de concessão, uso, revisão e revogação;
- [ ] prevenção de cópia, exportação, indexação ou sincronização adicional;
- [ ] tratamento de restaurações e backups preexistentes;
- [ ] expiração/revogação alinhada à reavaliação de 30/10/2026;
- [ ] método de validação que não abra nem leia a evidência.

### Execução e validação

- [ ] janela e operador aprovados;
- [ ] mudança aplicada somente pelo responsável designado;
- [ ] nenhuma alteração de conteúdo, nome, local, timestamp ou formato;
- [ ] resultado validado por metadados e logs administrativos sanitizados;
- [ ] falha, desvio ou impacto inesperado causa interrupção e escalonamento;
- [ ] revisor independente recebe apenas o registro sanitizado;
- [ ] implementação e exceções são registradas com timestamp UTC.

O atendimento documental desses critérios não autoriza a execução. A mudança
de ACL ou de configuração exige ato técnico específico posterior.

## Proteção contra divulgação

Relatórios, tickets e aprovações devem usar alias da evidência e conter apenas
estado, função, datas, controles, exceções e conclusões agregadas. É proibido
registrar:

- senha, fragmento ou transformação da senha;
- transcript, mensagem bruta ou screenshot;
- connection string, URI, token, cookie ou chave;
- caminho exato que amplie a exposição;
- identificadores internos desnecessários;
- IP completo, payload ou dado pessoal sem necessidade e autorização.

Qualquer exibição acidental de conteúdo deve causar interrupção imediata. O
conteúdo não deve ser copiado para o registro; o evento deve ser tratado pelo
procedimento de incidente aplicável.

## Pendências obrigatórias

- [ ] identificar formalmente o responsável e validar sua autoridade;
- [ ] obter aprovação final assinada ou registrada no sistema oficial;
- [ ] registrar horário UTC e referência do ticket;
- [ ] confirmar ou ajustar a reavaliação de 30/10/2026;
- [ ] designar custodiante, operador e dono do risco;
- [ ] avaliar preservação legal, contratual, regulatória e `legal hold`;
- [ ] designar revisor independente;
- [ ] decidir separadamente sobre a autorização metadata-only;
- [ ] executar inventário somente se a minuta for aprovada;
- [ ] aprovar e implementar controles de acesso por ato separado;
- [ ] validar os controles sem acessar o conteúdo;
- [ ] inventariar descendentes, sincronizações e backups preexistentes;
- [ ] manter filtros, paginação, logging histórico e cadeia de custódia como
      lacunas até sua resolução ou aceite formal;
- [ ] obter aceite expresso do dono do risco sobre eventual uso anterior à
      expiração e demais riscos residuais;
- [ ] realizar a reavaliação e decidir entre prorrogação, retenção conforme
      política ou futura eliminação autorizada.

## Critérios para revisão independente

O segundo responsável deve confirmar:

- [ ] a declaração de autoridade não foi tratada como assinatura inexistente;
- [ ] a modalidade, finalidade e datas foram transcritas corretamente;
- [ ] 30/10/2026 é reavaliação, não descarte automático;
- [ ] leitura, eliminação, arquivamento e alteração de ACL permanecem proibidos;
- [ ] a autorização metadata-only está em minuta e não foi concedida;
- [ ] nenhum JSONL foi localizado ou acessado por esta etapa;
- [ ] os controles de acesso não foram declarados como implementados;
- [ ] obrigações de preservação legal/contratual permanecem pendentes;
- [ ] sincronizações, backups e descendentes não foram presumidos;
- [ ] as lacunas dos logs não foram convertidas em prova de ausência;
- [ ] o risco de eventual uso anterior à expiração permanece indeterminado;
- [ ] os riscos residuais têm dono, prazo e aceite formal antes do encerramento;
- [ ] segregação de funções e sanitização são suficientes;
- [ ] nenhuma decisão de descarte ou encerramento foi inferida.

Decisões possíveis do revisor:

```text
[ ] VALIDAR O REGISTRO DOCUMENTAL
[ ] VALIDAR COM RESSALVAS E PRAZO
[ ] SOLICITAR COMPLEMENTACAO
[ ] ESCALAR POR RISCO, AUTORIDADE OU CUSTODIA
[ ] REJEITAR A FORMALIZACAO
```

## Estado atualizado

| Item | Estado em 23/10/2026 |
| --- | --- |
| manifestação de autoridade | registrada como declaração comunicada |
| modalidade escolhida | retenção temporária protegida |
| finalidade | preservação para auditoria e revisão independente |
| reavaliação | proposta para 30/10/2026 |
| aprovação final assinada | pendente |
| autorização metadata-only | minuta preparada; não concedida |
| controles de acesso | critérios preparados; implementação pendente |
| leitura de conteúdo | não autorizada |
| eliminação/limpeza/arquivamento | não autorizados |
| avaliação legal/contratual | pendente |
| revisor independente | pendente de designação |
| aceite dos riscos residuais | pendente |
| encerramento do incidente | bloqueado |

## Veredito desta etapa

**A MANIFESTAÇÃO DE AUTORIDADE, A FINALIDADE E A ESCOLHA PELA RETENÇÃO
TEMPORÁRIA PROTEGIDA FORAM REGISTRADAS EM 23/10/2026. A APROVAÇÃO FINAL AINDA
REQUER IDENTIDADE, BASE DE AUTORIDADE, TIMESTAMP UTC E ASSINATURA OU REGISTRO NO
SISTEMA OFICIAL. A REAVALIAÇÃO DE 30/10/2026 É PROPOSTA E NÃO AUTORIZA DESCARTE.**

A autorização metadata-only não foi concedida, os controles de acesso não
foram implementados, as obrigações legais/contratuais não foram avaliadas e o
revisor independente não foi designado. Nenhuma operação sobre a evidência está
autorizada por este documento. O incidente permanece aberto.
