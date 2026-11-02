# Etapa 07C.13B.12 — plano de retenção temporária protegida do JSONL

Data da decisão comunicada: 23/10/2026. Estado: **RETENÇÃO TEMPORÁRIA PROPOSTA
— IMPLEMENTAÇÃO E APROVAÇÃO PENDENTES; SESSÃO JSONL NÃO ACESSADA; INCIDENTE NÃO
ENCERRADO**.

## Objetivo, escopo e limites

Este documento registra a orientação preliminar comunicada pelo operador para
reter temporariamente, sob proteção, a sessão do Codex associada à exposição
da credencial `cli_login_postgres`. A finalidade é preservar a possível
evidência primária enquanto permanecem pendentes a revisão independente, o
inventário de controladores e a decisão humana definitiva.

A seleção da alternativa não equivale a aprovação, implementação ou alteração
do estado da evidência. Nenhum responsável está designado por este relatório e
nenhum controle técnico é declarado como já aplicado.

Nesta etapa, nenhuma sessão JSONL foi localizada, enumerada, aberta, lida,
pré-visualizada, hashada, copiada, movida, renomeada, arquivada, modificada ou
eliminada. Não foram alteradas permissões, configurações do Codex, migrations,
workflows, credenciais ou sistemas de produção. Não houve acesso ao Supabase,
PostgreSQL ou n8n, nem execução de SQL ou autenticação.

## Decisão preliminar registrada

| Campo | Registro |
| --- | --- |
| alternativa comunicada | retenção temporária protegida |
| data | 23/10/2026 |
| objeto lógico | sessão do Codex associada à exposição de `cli_login_postgres` |
| natureza | orientação preliminar de preservação |
| aprovação do responsável autorizado | pendente |
| implementação dos controles | pendente |
| revisão independente | pendente |
| prazo de revisão | a definir e aprovar |
| sessão identificada por UUID/caminho | não |
| acesso ao conteúdo autorizado | não |
| decisão definitiva de retenção ou descarte | pendente |

A orientação vigora apenas como bloqueio de alteração ou descarte não
autorizado. Ela não autoriza localizar automaticamente a sessão, abrir o
transcript, criar cópias, modificar ACLs, arquivar ou excluir dados.

## Base documental e risco residual

### Evidências consolidadas

- A senha de `cli_login_postgres` foi documentada como expirada em 22/10/2026
  às 21:28:48 UTC.
- O CSV PgBouncer autorizado teve identidade binária confirmada pelo SHA-256
  `5e8d2e90497c1962da94f366e122052ce77865fe4a25e023b9ef26ad4190f684`.
- Foram reproduzidos 483 registros válidos, sendo 40 na janela crítica e 283
  na janela ampliada.
- Nenhuma referência exata a `cli_login_postgres` foi identificada no CSV.
- Não foram encontrados IDs duplicados, timestamps inválidos ou registros
  malformados no corpus preservado.

### Limitações que permanecem abertas

- A integridade interna do CSV não comprova completude da exportação ou da
  fonte.
- Filtros, limite, total da origem, ordenação e paginação não foram
  reconciliados.
- O estado histórico de `log_connections` e `log_disconnections` não foi
  comprovado; as configurações observadas estavam desativadas.
- Os logs PostgreSQL examinados não trouxeram autenticação identificável da
  credencial, mas autenticações não registradas não podem ser reconstruídas.
- Supavisor não retornou registros na janela consultada; resultado vazio não
  comprova ausência de conexão.
- Organization Audit Logs estavam indisponíveis no plano Free, o que representa
  ausência da fonte, não ausência de atividade administrativa.
- A cadeia de custódia da transferência do CSV, sua paginação e a cobertura
  histórica das fontes ainda dependem de revisão humana.
- O UUID, nome, caminho, estado, descendentes e controladores da sessão JSONL
  permanecem desconhecidos.

Consequentemente, o risco histórico permanece **indeterminado**: a expiração
contém o uso futuro da senha expirada, mas não comprova que não houve uso antes
de 21:28:48 UTC. A retenção temporária preserva a possibilidade de revisão sem
converter ausência de registros em ausência de acesso.

## Princípios da retenção temporária

Enquanto a proposta não for aprovada e implementada, devem prevalecer os
seguintes princípios:

1. não alterar o estado atual da evidência;
2. não abrir o conteúdo nem pesquisar a senha ou trechos da conversa;
3. não criar cópia de trabalho, exportação ou backup adicional;
4. não mover, renomear, arquivar, compactar, truncar ou excluir a sessão;
5. não alterar permissões sem autorização específica e plano de reversão;
6. usar somente metadados necessários, sob escopo escrito e alvo inequívoco;
7. separar custódia, aprovação, execução e revisão sempre que viável;
8. registrar apenas informações sanitizadas em documentos de circulação;
9. definir prazo curto e evento de reavaliação antes da implementação;
10. manter o encerramento do incidente bloqueado enquanto as condições formais
    não forem atendidas.

## Controles necessários

Os controles abaixo são requisitos propostos. Todos permanecem pendentes de
aprovação e implementação verificável.

### Acesso restrito

- acesso nominal e individual, sem contas compartilhadas;
- princípio do menor privilégio e necessidade de conhecer;
- autorização escrita por função, finalidade, escopo e prazo;
- autenticação forte e proteção do endpoint conforme política aplicável;
- registro auditável de concessão, uso, revisão e revogação de acesso;
- proibição de preview, indexação manual, parser, busca textual ou abertura em
  editor sem autorização investigativa separada;
- revisão periódica da lista de autorizados durante a retenção;
- revogação ao fim do prazo ou da finalidade;
- nenhuma mudança de ACL antes da aprovação técnica e do custodiante.

### Preservação sem propagação

- manter o original em seu local e formato atuais;
- não gerar hash nesta etapa;
- não criar cópia, espelho, anexo, exportação ou screenshot do conteúdo;
- inventariar apenas cópias preexistentes por meio de políticas e metadados;
- impedir que restaurações rotineiras reintroduzam o segredo sem controle;
- documentar backups imutáveis e sua expiração, sem criar exceção informal;
- não usar arquivamento do Codex como substituto de retenção aprovada ou
  descarte.

### Monitoramento e rastreabilidade

- designar custodiante e canal restrito para o registro da decisão;
- registrar toda ação autorizada por ticket, executor e timestamp UTC;
- registrar resultado, exceções e impacto sem conteúdo sensível;
- revisar alertas ou evidências de acesso não autorizado pelos mecanismos já
  existentes, sem habilitar nova coleta nesta etapa;
- tratar qualquer acesso inesperado, mudança de tamanho/timestamp ou quebra de
  custódia como motivo de suspensão e escalonamento.

## Segregação de funções e responsáveis a designar

| Função | Responsabilidade | Estado |
| --- | --- | --- |
| responsável pelo incidente/Segurança | aprovar finalidade, risco e período provisório | a designar |
| custodiante da evidência | manter referência controlada e cadeia de custódia | a designar |
| administrador do Codex/responsável técnico | validar método metadata-only e alcance dos mecanismos | a designar |
| dono do sistema ou dado | aprovar impacto e necessidade da retenção | a designar |
| Jurídico/Compliance/Privacidade | avaliar obrigação de retenção e `legal hold`, quando aplicável | a designar |
| responsável por backup/sincronização | inventariar controladores e restauração | a designar |
| operador autorizado | executar somente tarefas expressamente aprovadas | a designar |
| revisor independente | revisar evidências, controles, lacunas e decisão | a designar |
| dono do risco | aceitar formalmente riscos residuais e lacunas irrecuperáveis | a designar |

Sempre que possível, o operador não deve ser simultaneamente o aprovador ou o
revisor independente. O custodiante não deve autorizar sozinho acesso ao
conteúdo nem descarte.

## Procedimento metadata-only proposto

Este procedimento não está autorizado por este relatório. Ele somente poderá
ser executado por operador humano após aprovação explícita e delimitada.

### Pré-condições

- [ ] ticket ou autorização identifica finalidade, operador, aprovador e prazo;
- [ ] alvo inicial é fornecido por UUID/ID, nome lógico já conhecido ou
      referência do registro restrito, sem varredura por data ou conteúdo;
- [ ] fontes administrativas permitidas estão listadas nominalmente;
- [ ] campos de metadados permitidos e proibidos estão documentados;
- [ ] sessão está encerrada ou o operador interromperá sem alterá-la;
- [ ] método não abre, lê, hashia ou copia o transcript;
- [ ] local seguro para o registro sanitizado está definido;
- [ ] critério de interrupção para alvo ambíguo ou conteúdo exibido está
      aprovado.

### Escopo permitido

Para a sessão original e eventuais descendentes, registrar somente:

- UUID/ID ou alias controlado;
- nome lógico, se já exposto pela interface administrativa;
- estado ativo, encerrado ou arquivado;
- existência, tipo, tamanho e timestamps do sistema de arquivos;
- relação pai/descendente, sem itens do transcript;
- proprietário, grupos e ACL, sem modificar permissões;
- localização lógica restrita e controlador responsável;
- política de retenção e expiração aplicável.

Para sincronizações e backups, consultar apenas inventários administrativos,
configurações documentadas e políticas já existentes para registrar:

- controlador e responsável;
- inclusão ou exclusão do local lógico;
- janela de retenção e expiração;
- imutabilidade e capacidade de eliminação seletiva;
- processo de restauração e controle contra reintrodução;
- existência de versões ou réplicas, sem baixá-las ou abri-las.

Para histórico ou serviço Codex, confirmar somente a modalidade de
persistência aplicável, existência de referência à sessão e alcance conhecido
dos mecanismos de arquivamento ou exclusão. Não executar esses mecanismos.

### Proibições e critérios de interrupção

Interromper e escalar se:

- o alvo não puder ser identificado sem busca ampla;
- a interface ou ferramenta exibir automaticamente conteúdo da conversa;
- houver necessidade de hash, leitura, cópia ou mudança de permissão;
- a sessão ainda estiver recebendo gravações;
- houver divergência entre UUID, nome, parentesco ou local esperado;
- for identificado `legal hold`, bloqueio técnico ou controlador não previsto;
- a ação puder alterar timestamps, atributos ou conteúdo;
- o escopo precisar incluir outro arquivo ou sistema não autorizado.

Nenhuma extensão de escopo deve ser presumida. Uma nova autorização específica
é obrigatória antes de prosseguir.

## Controles contra divulgação de credenciais

### Dados proibidos em relatórios e tickets gerais

- senha, fragmento ou transformação reversível da senha;
- connection string, URI, token, cookie ou chave;
- conteúdo do transcript ou mensagens brutas;
- caminho exato do arquivo quando ele ampliar a exposição;
- IDs internos sem necessidade; usar alias controlado;
- IP completo, payload, dado pessoal ou identificador de cliente;
- screenshots de sessão, console, configuração ou segredo.

### Dados permitidos no relatório sanitizado

- alias da evidência e do operador;
- existência `sim/não/desconhecido`;
- estado `ativo/encerrado/arquivado/desconhecido`;
- contagens agregadas;
- timestamps UTC estritamente necessários;
- classificação de controle, prazo, aprovação e resultado;
- marcador `CONTEUDO_SENSIVEL_PRESENTE`, sem transcrição;
- riscos, limitações, exceções e responsáveis.

Antes de publicar qualquer registro, o autor e um segundo responsável devem
aplicar revisão de sanitização. Se um segredo for exibido acidentalmente, não o
copiar para o relatório: interromper, restringir o registro afetado e acionar o
procedimento de incidente aplicável.

## Modelo de aprovação humana

```text
aprovacao_id:
projeto: FABIO Dashboard
etapa: 07C.13B.12
data_da_orientacao_preliminar: 2026-10-23
alternativa_proposta: retencao_temporaria_protegida

responsavel_pelo_incidente:
custodiante_da_evidencia:
dono_do_sistema_ou_dado:
administrador_codex_responsavel_tecnico:
responsavel_backup_sincronizacao:
juridico_compliance_privacidade: aplicavel | nao_aplicavel | pendente
revisor_independente:
dono_do_risco:
operador_autorizado:

finalidade_da_retencao:
fundamento_investigativo_legal_contratual:
legal_hold: sim | nao | desconhecido
session_id_alias:
uuid_confirmado_sem_conteudo: sim | nao
sessao_encerrada: sim | nao | desconhecido
escopo_metadata_only_autorizado:
fontes_administrativas_autorizadas:
campos_de_metadados_permitidos:
acoes_expressamente_proibidas:

inicio_da_retencao_aprovada_utc:
prazo_de_retencao:
data_de_revisao_utc:
evento_de_revisao_antecipada:
criterios_de_descarte:
criterios_para_retencao_definitiva:
tratamento_de_descendentes:
tratamento_de_sincronizacoes_backups:
excecoes_e_justificativa:
riscos_residuais_aceitos:

decisao: aprovar | aprovar_com_ressalvas | solicitar_complementacao | rejeitar
justificativa:
condicoes_obrigatorias:
assinaturas_ou_aprovacoes_no_sistema:
data_hora_utc:
```

Uma aprovação incompleta, sem prazo, sem finalidade, com `legal hold`
desconhecido ou com alvo ambíguo não autoriza implementação.

## Pendências de implementação

- [ ] designar formalmente todos os responsáveis aplicáveis;
- [ ] confirmar que a sessão está encerrada, sem abrir o conteúdo;
- [ ] obter aprovação escrita para o inventário metadata-only;
- [ ] identificar inequivocamente a sessão por metadado autorizado;
- [ ] identificar descendentes/forks sem abrir transcripts;
- [ ] inventariar sincronizações, backups, snapshots, EDR e retenção do serviço;
- [ ] avaliar `legal hold` e obrigações de retenção;
- [ ] aprovar finalidade, prazo curto, data e evento de reavaliação;
- [ ] aprovar controles de acesso e segregação de funções;
- [ ] implementar controles somente por operador autorizado;
- [ ] verificar a implementação sem acessar o conteúdo;
- [ ] registrar exceções de backups imutáveis e controles de restauração;
- [ ] submeter o pacote sanitizado ao revisor independente;
- [ ] obter aceite formal dos riscos residuais;
- [ ] manter bloqueados arquivamento, exclusão e mudança de ACL até autorização
      separada.

## Critérios para revisão independente

O revisor deve ser diferente do operador e, sempre que possível, do aprovador.
Sua análise deve confirmar:

- [ ] a alternativa está registrada como proposta, não como decisão final;
- [ ] a finalidade de preservação é legítima, necessária e proporcional;
- [ ] o prazo e a data de reavaliação são definidos e não indefinidos;
- [ ] UUID/ID, estado e descendentes foram tratados somente por metadados;
- [ ] não houve abertura, leitura, hash, cópia, movimento ou alteração do JSONL;
- [ ] nenhum backup adicional foi criado;
- [ ] acesso nominal, menor privilégio e segregação foram implementados;
- [ ] sincronizações, backups e restaurações foram inventariados ou marcados
      explicitamente como desconhecidos;
- [ ] o relatório sanitizado não contém credencial ou conteúdo sensível;
- [ ] as conclusões do CSV PgBouncer foram preservadas sem extrapolação;
- [ ] ausência de referência à credencial não foi tratada como ausência de uso;
- [ ] filtros, paginação, logging histórico e cadeia de custódia permanecem
      identificados como lacunas quando não resolvidos;
- [ ] o risco de eventual uso anterior à expiração foi mantido como
      indeterminado;
- [ ] responsáveis, exceções, riscos e prazos possuem registro verificável;
- [ ] nenhuma conclusão de encerramento foi emitida.

Decisões possíveis do revisor:

```text
[ ] APROVAR A IMPLEMENTAÇÃO DA RETENÇÃO TEMPORÁRIA
[ ] APROVAR COM RESSALVAS E PRAZO
[ ] SOLICITAR COMPLEMENTAÇÃO
[ ] ESCALAR POR RISCO OU QUEBRA DE CUSTÓDIA
[ ] REJEITAR A IMPLEMENTAÇÃO
```

A aprovação da retenção temporária não constitui aprovação de retenção
definitiva, descarte ou encerramento do incidente.

## Condições para futura decisão

### Retenção definitiva conforme política

Somente poderá ser considerada quando:

- existir fundamento legal, contratual, regulatório ou investigativo formal;
- a classificação da informação e a política aplicável estiverem definidas;
- prazo, revisão periódica, custódia e descarte futuro estiverem aprovados;
- acessos e restaurações forem auditáveis;
- todos os controladores conhecidos tiverem tratamento documentado;
- a revisão independente concluir pela proporcionalidade da retenção.

### Eliminação pelo mecanismo suportado do Codex

Somente poderá ser considerada quando:

- a sessão e eventuais descendentes estiverem identificados sem ambiguidade;
- não houver `legal hold` ou obrigação de retenção;
- o valor probatório tiver sido satisfeito por evidência sanitizada suficiente,
  ou a perda probatória tiver aceite formal do dono do risco;
- a revisão independente estiver concluída;
- filtros/paginação, cadeia de custódia e lacunas de logs tiverem sido resolvidos
  ou formalmente aceitos;
- o alcance do mecanismo suportado sobre sessão e descendentes estiver
  confirmado;
- sincronizações e backups gerenciáveis tiverem tratamento aprovado;
- exceções imutáveis tiverem expiração e controle de restauração registrados;
- dono do dado, Segurança e Jurídico/Compliance, quando aplicável, tiverem
  aprovado método, alvo e momento;
- um operador humano diferente do revisor estiver designado;
- a comprovação futura registrar somente metadados sanitizados.

Arquivamento não deve ser tratado como eliminação. Nenhum comando de
arquivamento ou exclusão está autorizado por este plano.

### Critérios de descarte a preencher na aprovação

O formulário deve definir objetivamente:

1. evento que encerra a necessidade investigativa;
2. confirmação de conclusão ou aceite das lacunas da revisão independente;
3. ausência de `legal hold` e obrigações de retenção;
4. suficiência do pacote de evidências sanitizadas;
5. identificação inequívoca de original e descendentes;
6. tratamento de sincronizações, backups e restaurações;
7. aprovadores e operador autorizado;
8. método suportado, verificação metadata-only e registro de exceções.

## Estado atualizado e dependências humanas

| Item | Estado em 23/10/2026 | Dependência humana |
| --- | --- | --- |
| alternativa de tratamento | retenção temporária protegida proposta | aprovação formal |
| identificação da sessão | pendente | operador autorizado com escopo metadata-only |
| descendentes/forks | desconhecidos | inventário autorizado |
| sincronizações e backups | desconhecidos | responsáveis pelos controladores |
| controles de acesso | requisitos definidos; implementação não verificada | custodiante, Segurança e administrador técnico |
| prazo de revisão | não definido | aprovadores e dono do risco |
| `legal hold`/obrigações | desconhecidos | Jurídico/Compliance/Privacidade, quando aplicável |
| revisão independente | pendente | segundo responsável |
| risco histórico de uso | indeterminado | revisão das fontes e aceite do risco |
| decisão definitiva ou descarte | bloqueada | gates, aprovações e mecanismo confirmado |
| encerramento do incidente | bloqueado | critérios formais das etapas anteriores |

## Veredito desta etapa

**RETENÇÃO TEMPORÁRIA PROTEGIDA SELECIONADA COMO ORIENTAÇÃO PRELIMINAR EM
23/10/2026. IMPLEMENTAÇÃO, RESPONSÁVEIS, PRAZO, INVENTÁRIO METADATA-ONLY,
APROVAÇÃO E REVISÃO INDEPENDENTE PERMANECEM PENDENTES.**

Até que essas dependências sejam atendidas, a instrução é não alterar o estado
da evidência e não executar qualquer ação operacional sobre a sessão. As
lacunas de logging do Supabase e o risco residual de eventual uso anterior à
expiração continuam registrados. O incidente permanece aberto.
