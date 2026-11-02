# Etapa 07C.13B.6 — procedimento de coleta e correlação de logs

Data de preparação: 23/10/2026. Estado: **PROCEDIMENTO PREPARADO — COLETA NÃO
EXECUTADA; INCIDENTE NÃO ENCERRADO**.

## Objetivo, escopo e proibições

Este documento orienta um operador humano autorizado a investigar possível uso
da senha PostgreSQL exposta do papel gerenciado `cli_login_postgres` antes de
sua expiração. Ele é um roteiro de coleta manual, não uma autorização para
acesso ao projeto KAWANA ou para qualquer ação operacional.

Nesta etapa foram consultados somente os relatórios locais sanitizados das
Etapas 07C.13B.3, 07C.13B.4 e 07C.13B.5 e documentação pública oficial da
Supabase. Não houve acesso ao Supabase, PostgreSQL, Dashboard do projeto,
Management API, credenciais, sessão JSONL, arquivos `.env`, migrations,
workflows ou configurações.

O operador não deve, como parte deste procedimento:

- testar, copiar, revelar, renovar ou reutilizar a senha exposta;
- abrir, alterar ou duplicar o JSONL que contém o valor;
- mudar logging, roles, grants, policies, parâmetros, workflows ou retenção;
- executar SQL no banco de produção;
- instalar Log Drain retroativamente ou tratar uma configuração futura como
  evidência do período passado;
- usar Supabase CLI, `psql`, `pg_dump` ou outro cliente de banco;
- anexar saída bruta ao repositório ou a canal sem controle de acesso;
- executar contenção, rotação ou outra operação destrutiva.

Qualquer necessidade fora da leitura de logs já existentes exige nova
autorização e procedimento próprio.

## Base temporal e fatos de correlação

Usar UTC em toda a investigação. Preservar a precisão original de cada fonte e
registrar quando ela for menor do que milissegundos.

| Marco | Timestamp UTC | Classificação |
| --- | --- | --- |
| início do comando que solicitou o dry run | 22/10/2026 21:23:41.265 | confirmado pelos relatórios locais sanitizados |
| saída que tornou a senha visível | 22/10/2026 21:23:46.853 | confirmado pelos relatórios locais sanitizados |
| expiração administrativa da senha | 22/10/2026 21:28:48.000 | confirmação administrativa registrada na Etapa 07C.13B.4 |

Janelas obrigatórias:

```text
Crítica:  22/10/2026 21:23:41.265–21:28:48.000 UTC
Ampliada: 22/10/2026 21:08:41.000–21:43:48.000 UTC
```

A janela ampliada é a janela mínima de coleta. A crítica deve ser marcada como
subconjunto durante a análise. Se a fonte arredondar limites para minutos, o
operador deve consultar um intervalo externo que cubra completamente a janela
ampliada e aplicar os limites exatos durante a classificação. A referência da
Management API informa que intervalos podem ser arredondados para o minuto;
portanto, eventos marginais não devem ser descartados antes do pós-filtro.

Expandir a busca quando houver emissão anterior, atraso de ingestão, relógio
divergente, sessão ainda aberta no limite, evento correlacionado fora da janela
ou lacuna que possa ocultar o início/fim de uma atividade. Registrar o novo
intervalo e a justificativa; não substituir silenciosamente as janelas acima.

## O que a documentação permite afirmar

As verificações abaixo devem ser refeitas pelo operador na data da coleta,
porque plano, interface, retenção e campos podem mudar:

- Logs do projeto podem ser consultados no Logs/Explorer e separados por
  fontes como `postgres_logs` e `supavisor_logs`.
- Logs PostgreSQL só mostram eventos de conexão quando o logging de conexões
  estava habilitado. Logging ativado depois do incidente não recupera eventos
  passados.
- O IP registrado pelo PostgreSQL pode ser o do Supavisor, pooler dedicado ou
  Data API, e não o IP original do cliente.
- Campos estruturados não são garantidos em todos os eventos. O texto do evento
  pode conter detalhes ausentes nos campos estruturados.
- O Logs/Explorer impõe limites de resultado; uma lista com o limite atingido
  não prova que todos os eventos foram coletados.
- Retenção de logs depende do plano e pode ser reduzida por estado de uso
  degradado. O plano atual não comprova o plano ou a retenção vigentes em
  22/10/2026.
- Platform Audit Logs registram ações de Dashboard/Platform API de membros da
  organização, mas a documentação os limita aos planos Team e Enterprise; o
  Dashboard não oferece exportação direta e a retenção depende do plano.
- O endpoint de logs unificados da Management API consulta logs do projeto; ele
  é um canal de consulta e não deve ser confundido com Platform Audit Logs da
  organização.
- Logs de Supavisor são apresentados como Pooler Logs. Isso não garante que
  cada autenticação, origem ou encerramento tenha sido registrado no período.

Uma consulta vazia nunca deve ser promovida automaticamente a “nenhum acesso”.

## Papéis humanos mínimos

| Papel | Responsabilidade | Não deve acumular |
| --- | --- | --- |
| aprovador da coleta | autorizar fontes, janela, acesso e local de evidência | execução e aprovação final sozinho |
| operador | consultar as fontes com menor privilégio e produzir evidência sanitizada | decidir sozinho a classificação final |
| revisor independente | reproduzir filtros/contagens e revisar correlações | editar a coleta original sem registrar a mudança |
| responsável pelo incidente | aceitar pendências/riscos ou abrir investigação ampliada | dispensar lacuna sem justificativa |
| custodiante de evidência | controlar acesso, integridade, retenção e descarte | armazenar segredo no repositório do projeto |

O operador e o revisor devem conhecer previamente apenas os metadados
sanitizados necessários: papel, projeto, janelas, comando sem saída e origem
esperada fornecida pelo responsável pela execução. Eles não precisam conhecer
a senha.

## Gate 1 — validar se cada fonte existe e cobre o período

Preencher antes de procurar eventos. Uma resposta desconhecida bloqueia a
conclusão de ausência, mas não impede registrar as limitações encontradas.

| Verificação | PostgreSQL | Supavisor/Pooler | Platform Audit/Management |
| --- | --- | --- | --- |
| fonte aparece na interface autorizada | [ ] | [ ] | [ ] |
| plano em 22/10/2026 identificado | [ ] | [ ] | [ ] |
| retenção aplicável ao incidente confirmada | [ ] | [ ] | [ ] |
| período ainda disponível integralmente | [ ] | [ ] | [ ] |
| timezone e precisão conhecidos | [ ] | [ ] | [ ] |
| atraso de ingestão conhecido | [ ] | [ ] | [ ] |
| logging da classe de evento estava habilitado antes do incidente | [ ] | [ ] | [ ] |
| limites de linhas/paginação conhecidos | [ ] | [ ] | [ ] |
| campos necessários existem em pelo menos parte dos eventos | [ ] | [ ] | [ ] |
| lacunas, indisponibilidade ou degradação documentadas | [ ] | [ ] | [ ] |

Checklist de integridade e cobertura:

- [ ] Registrar nome exato da fonte e da tela/canal usado.
- [ ] Registrar início e fim efetivamente aceitos pela fonte em UTC.
- [ ] Registrar o evento mais antigo e o mais novo disponíveis ao redor da
      janela, sem assumir que representam os limites reais de retenção.
- [ ] Confirmar a configuração histórica de `log_connections`,
      `log_disconnections`, statement logging e pgAudit, quando essa informação
      já estiver disponível administrativamente. Não alterá-la.
- [ ] Distinguir configuração atual de configuração vigente em 22/10/2026.
- [ ] Verificar avisos de retenção, quota, limite, timeout, erro de consulta,
      truncamento, amostragem e paginação.
- [ ] Executar primeiro contagens agregadas por fonte/tipo/resultado; depois
      coletar detalhes mínimos. Se o detalhe atingir o limite, dividir a janela
      em subintervalos sem sobreposição e reconciliar os totais.
- [ ] Verificar que resultados vazios mantêm cabeçalhos/consulta identificável
      e que não são resposta parcial, erro ou filtro incompatível.
- [ ] Usar um evento conhecido e não sensível já existente antes/depois da
      janela, quando disponível, para validar timezone e funcionamento da
      consulta. Não gerar evento novo.
- [ ] Registrar versão/data da documentação usada para interpretar a fonte.
- [ ] Se o período não estiver disponível, verificar Log Drains ou arquivo
      corporativo que já existiam em 22/10/2026. Não criar drain nesta etapa.
- [ ] Se nenhuma fonte cobrir o período, preparar chamado restrito ao suporte
      Supabase perguntando sobre disponibilidade e retenção histórica; não
      enviar senha, token, JSONL ou saída sensível.

## Gate 2 — coleta manual dos logs PostgreSQL

### Canal preferencial

Usar o Dashboard autorizado: **Logs/Explorer → Run SQL → fonte Logs**, com a
janela ampliada. A consulta ocorre no repositório de logs/ClickHouse, não no
banco PostgreSQL. Não selecionar a fonte Database e não executar SQL contra
produção.

O uso do endpoint de logs da Management API é alternativa somente se houver
autorização específica e terminal seguro fora do alcance do agente. O token
deve permanecer em mecanismo protegido, nunca em relatório, histórico ou
comando compartilhado. O procedimento não fornece nem solicita esse token.

### Passes obrigatórios de busca

O operador deve registrar a consulta/filtro sanitizado e o total de cada pass:

1. fonte `postgres_logs` e campo estruturado de usuário/role igual a
   `cli_login_postgres`, se o campo estiver presente;
2. fonte `postgres_logs` e ocorrência literal do nome do papel no texto do
   evento, para cobrir mensagens sem campo estruturado;
3. eventos de conexão/autenticação no período: conexão recebida, autenticada,
   autorizada, rejeitada, encerrada e erros `FATAL` relacionados;
4. sessões ou desconexões atribuíveis ao papel, incluindo duração quando
   registrada;
5. statements, command tags, erros ou objetos relacionados ao papel, apenas se
   statement logging/pgAudit os registravam;
6. mudanças de role, grants, revokes, ownership ou parâmetros relacionadas ao
   papel, somente se a classe de DDL/auditoria estava registrada;
7. falhas por senha expirada após 21:28:48 UTC dentro da janela ampliada.

Campos mínimos a observar quando disponíveis:

- timestamp original, ID do evento, fonte e severidade;
- usuário/role, database e `application_name`;
- mensagem de conexão/autenticação e resultado;
- origem registrada e indicação de que pode ser IP intermediário;
- SQLSTATE, command tag e objeto afetado, sem copiar texto SQL sensível;
- identificador de processo/sessão/conexão que permita correlação;
- método de autenticação/TLS apenas quando efetivamente registrado.

Não procurar a senha e não incluir o valor em nenhum filtro. Se qualquer evento
exibir credencial, connection string, token, dados pessoais ou conteúdo
financeiro, interromper sua transcrição, marcar `CONTEUDO_SENSIVEL_PRESENTE` e
encaminhar somente ao custodiante autorizado.

### Limitações que devem acompanhar a conclusão

- `log_connections=false` no período impede afirmar ausência de autenticações
  bem-sucedidas a partir dessa classe de logs.
- `log_disconnections=false` impede reconstruir com segurança término/duração.
- statement logging/pgAudit ausente impede afirmar ausência de operações SQL.
- IP de Supavisor/pooler no PostgreSQL não identifica a origem do cliente.
- ausência de campo estruturado exige busca também no texto, mas texto truncado
  ou não gravado mantém a conclusão limitada.

## Gate 3 — coleta manual do Supavisor / Session Pooler

### Canal preferencial

No Dashboard autorizado, selecionar **Pooler Logs** ou a fonte
`supavisor_logs`, mantendo a janela ampliada. Confirmar que o endpoint usado no
evento original era o Session Pooler antes de atribuir eventos a essa rota.
Incluir `pgbouncer_logs` ou outra fonte somente se houver evidência de pooler
dedicado; incluir Transaction Pooler somente se os registros indicarem que ele
participou do fluxo.

### Passes obrigatórios de busca

1. ocorrências de `cli_login_postgres` em campos estruturados disponíveis e no
   texto do evento;
2. eventos de autenticação iniciada, aceita, rejeitada ou encerrada;
3. erros de credencial/database, inclusive fechamento durante autenticação;
4. abertura e término da conexão cliente e da conexão backend, quando
   distinguíveis;
5. timeout, terminação do cliente, falha de roteamento ou pool saturation que
   possa explicar evento incompleto;
6. origem/IP, região, nó do pooler, modo de pooling, endpoint,
   `application_name` e IDs de correlação, somente quando presentes;
7. conexões ou sessões lógicas que atravessem 21:28:48 UTC.

### Correlação com PostgreSQL

- Não exigir relação 1:1 entre conexão cliente e backend: pooling pode
  reutilizar backends.
- Preferir ID compartilhado de sessão/conexão/request. Proximidade temporal
  sozinha é indício, não prova de identidade.
- Comparar direção do evento, role, database, nó/endpoint e resultado.
- Tratar o IP do Supavisor observado pelo PostgreSQL como intermediário; a
  origem do cliente só pode ser afirmada se a camada do pooler a registrar.
- Registrar conexões do cliente sem backend correspondente e backends sem
  cliente explicável como divergências a revisar, não como ataque confirmado.

Se Pooler Logs não tiverem retenção, granularidade ou campos suficientes,
classificar a lacuna explicitamente e solicitar confirmação ao suporte. Não
preencher campos ausentes por inferência.

## Gate 4 — atividades administrativas e Management API

### Fonte primária: Platform Audit Logs

Para ações de Dashboard/Platform API, o operador deve verificar primeiro os
**Audit Logs da organização**. A documentação atual informa disponibilidade
somente nos planos Team e Enterprise, retenção dependente do plano e ausência
de exportação pelo Dashboard.

Se a organização não tiver esse recurso, verificar os **Account Audit Logs**
da conta que iniciou a operação, quando acessíveis, e registrar a cobertura
mais estreita. Uma conta individual não substitui a auditoria da organização
para excluir ações de outros atores.

### Eventos a procurar

- solicitação que inicializou/criou o login gerenciado;
- ação/rota da Platform API ou CLI associada à emissão;
- ator, tipo de token, IP, target e status da resposta, quando apresentados;
- horário de solicitação, emissão e expiração/validade, se registrados;
- revogação, renovação, reemissão ou nova solicitação para o mesmo papel;
- mudanças de configuração do banco, logging, rede ou projeto;
- alterações administrativas de roles ou permissões relacionadas;
- ações incomuns do mesmo ator, token type ou origem na janela ampliada.

Registrar o ator por alias no artefato sanitizado. E-mail, token, identificador
de token e IP completo devem permanecer apenas na evidência primária restrita
quando necessários à investigação.

### Canal secundário: logs unificados via Management API

O endpoint `GET /v1/projects/{ref}/analytics/endpoints/logs` pode consultar o
stream unificado do projeto com fonte e intervalo explícitos. Ele não é prova,
por si, de que chamadas administrativas da Platform API estejam presentes.
Usá-lo apenas para reproduzir as buscas de `postgres_logs` e
`supavisor_logs`, ou para outra fonte cuja presença tenha sido confirmada.

Controles se esse canal for autorizado:

- intervalo máximo conforme a documentação e limites exatos pós-filtrados;
- fonte explícita; sem SQL, o endpoint pode consultar somente eventos de API
  Gateway e produzir conclusão errada para este incidente;
- ClickHouse SQL, seleção mínima de colunas e limite explícito;
- permissão mínima `analytics_logs_read`/escopo equivalente;
- status HTTP e erro lógico verificados antes de interpretar o resultado;
- token inacessível ao agente e ausente de arquivos, histórico e evidência;
- saída bruta não armazenada neste repositório.

## Eventos e classificação inicial

| Evento | Sinal esperado/benigno possível | Sinal que exige investigação |
| --- | --- | --- |
| emissão do login | uma solicitação ligada ao operador e comando documentados | emissão adicional, ator/origem/horário desconhecido |
| autenticação bem-sucedida | somente fluxo estritamente correlacionado à operação conhecida, se ela chegou a autenticar | qualquer sucesso não explicado ou após expiração |
| autenticação falha | tentativa esperada ou expiração, com origem explicada | origem desconhecida, repetição, brute force ou tentativa posterior não explicada |
| início/término de sessão | duração e encerramento compatíveis | sessão sem término, duração incomum ou além de 21:28:48 UTC |
| origem | host/região previamente atestados pelo responsável | IP/ASN/região incompatível ou indisponível onde deveria existir |
| cliente | versão/processo documentados | `psql`, `pg_dump`, aplicação ou nome ausente sem explicação |
| permissões | nenhuma mudança esperada nesta etapa | `GRANT`, `REVOKE`, `ALTER ROLE`, owner ou policy inesperados |
| operação SQL | metadado estritamente compatível, se registrado | leitura ampla, DDL, DML, enumeração ou objeto inesperado |
| ação administrativa | chamada esperada, target e status coerentes | renovação, reemissão, mudança de configuração ou ator inesperado |

Um sinal suspeito abre investigação; ele não deve ser rotulado como
comprometimento confirmado sem validação adicional.

## Formato obrigatório da evidência sanitizada

O repositório do projeto pode receber somente um relatório sanitizado. Saída
primária, se exigida pela política, deve ficar no repositório restrito de
incidentes sob controle do custodiante.

### Cabeçalho da coleta

```text
caso_id: <identificador interno não secreto>
coletado_por: <função ou alias>
revisado_por: <função ou alias, inicialmente vazio>
coleta_iniciada_utc: <timestamp>
coleta_finalizada_utc: <timestamp>
projeto_alias: KAWANA
janela_solicitada_utc: 2026-10-22T21:08:41.000Z/2026-10-22T21:43:48.000Z
janela_critica_utc: 2026-10-22T21:23:41.265Z/2026-10-22T21:28:48.000Z
fonte: <postgres_logs|supavisor_logs|platform_audit|account_audit|outra>
canal: <Dashboard Logs|Explorer Logs|Organization Audit|canal aprovado>
retencao_confirmada: <sim|nao|desconhecida>
cobertura: <integral|parcial|indisponivel>
limites: <linhas, paginação, truncamento, atraso, gaps>
consulta_id_ou_hash: <referência não secreta, se permitido>
```

### Registro sanitizado de evento

```text
evento_alias: EVT-0001
timestamp_utc: <timestamp e precisão originais>
na_janela_critica: <sim|nao>
fonte: <fonte>
categoria: <emissao|auth_sucesso|auth_falha|sessao_inicio|sessao_fim|permissao|operacao|administrativa>
resultado: <sucesso|falha|desconhecido>
papel: cli_login_postgres
ator_alias: <ATOR-01|nao_disponivel>
origem_alias: <ORIGEM-01|intermediario_pooler|nao_disponivel>
cliente_normalizado: <valor não sensível ou não_disponivel>
endpoint_normalizado: <direto|session_pooler|transaction_pooler|desconhecido>
correlacao: <IDs não secretos/aliases e fundamento>
classificacao: <esperado|inconclusivo|potencialmente_suspeito>
justificativa: <sem dados pessoais, SQL ou secrets>
```

### Resumo por fonte

```text
eventos_totais_examinados: <n>
eventos_relevantes: <n>
auth_sucesso: <n|nao_registrado>
auth_falha: <n|nao_registrado>
sessoes_inicio: <n|nao_registrado>
sessoes_fim: <n|nao_registrado>
alteracoes_permissao: <n|nao_registrado>
acoes_administrativas: <n|nao_registrado>
eventos_esperados: <n>
eventos_inconclusivos: <n>
eventos_potencialmente_suspeitos: <n>
conclusao_da_fonte: <categoria definida abaixo>
pendencias: <lista>
```

Regras de sanitização:

- nunca registrar senha, PAT, JWT, chave, cookie, header de autorização,
  connection string, JSONL ou variável de ambiente;
- usar aliases estáveis dentro do caso para IPs, e-mails, atores e IDs que não
  precisem aparecer no relatório;
- manter a tabela de correspondência, se necessária, somente no cofre do caso;
- não copiar SQL completo, payload, dados pessoais ou valores financeiros;
- registrar tipo/command tag/objeto normalizado em vez do conteúdo;
- não usar hash simples de segredo como forma de sanitização;
- se um campo puder conter segredo, omiti-lo e registrar apenas
  `CONTEUDO_SENSIVEL_PRESENTE`;
- preservar na evidência restrita o hash SHA-256 do arquivo de exportação
  fechado, quando houver exportação autorizada, junto com tamanho, origem,
  custodiante e timestamps. O hash não substitui a cadeia de custódia;
- não criar exportação bruta quando a transcrição sanitizada e revisável for
  suficiente, especialmente para Platform Audit Logs sem exportação suportada.

## Quatro conclusões permitidas por fonte

### A — ausência comprovada de eventos no período coberto

Usar somente quando todos forem verdadeiros:

- a fonte e a classe de evento estavam habilitadas antes e durante toda a
  janela;
- retenção e disponibilidade cobrem integralmente a janela ampliada;
- timezone, precisão, arredondamento, atraso e limites foram validados;
- filtros estruturados e busca textual foram executados;
- contagens foram reconciliadas e nenhum limite/truncamento foi atingido;
- eventos de controle já existentes demonstram que a fonte estava registrando;
- o revisor independente reproduziu a busca e confirmou zero correspondências.

Redação permitida: “Nenhum evento correspondente foi encontrado na fonte X,
para as classes Y, durante a janela integralmente coberta Z.” Não generalizar
para classes ou fontes não cobertas.

### B — ausência de registros por limitação de logging

Usar quando a consulta retorna zero ou não há dados, mas pelo menos uma destas
condições existe:

- classe de evento desabilitada ou configuração histórica desconhecida;
- retenção expirada, plano incompatível ou Log Drain inexistente no período;
- fonte indisponível, gap, quota/degradação, erro, truncamento ou limite;
- campos/fonte não capturam a informação necessária;
- Platform Audit Logs indisponíveis no plano ou apenas Account Audit parcial.

Redação obrigatória: “A fonte não permite concluir ausência de atividade; não
há registro utilizável devido a <limitação>.”

### C — eventos inconclusivos

Usar quando existem registros relevantes, porém faltam elementos para ligá-los
ou excluí-los do incidente, por exemplo:

- timestamp próximo sem ID compartilhado;
- IP do pooler sem origem do cliente;
- ator, role, cliente, resultado ou término ausente;
- divergência entre fontes ou relógios;
- evento truncado ou duplicado por pooling.

Cada evento inconclusivo precisa de hipótese, evidência faltante, responsável e
prazo. Não convertê-lo em esperado somente por proximidade temporal.

### D — atividade potencialmente suspeita

Usar quando houver, entre outros:

- autenticação bem-sucedida não explicada;
- origem, região, ator, token type ou cliente incompatíveis;
- repetição automatizada ou tentativa após a expiração sem causa conhecida;
- sessão atravessando a expiração ou sem encerramento explicável;
- emissão/renovação adicional da credencial;
- alteração de permissões, role, owner, logging ou configuração;
- operação SQL inesperada atribuível ao papel;
- tentativa de ocultação, gap provocado ou divergência material de auditoria.

Ação: interromper a aprovação, preservar metadados, informar o responsável pelo
incidente e solicitar autorização para investigação ampliada. Não testar a
senha, alterar produção ou declarar comprometimento sem procedimento aprovado.

## Matriz de correlação final

O operador deve preencher uma linha por evento/cluster, usando aliases:

| Cluster | Platform Audit | Supavisor | PostgreSQL | Origem atestada | Relação | Classificação | Pendência |
| --- | --- | --- | --- | --- | --- | --- | --- |
| COR-001 | EVT-A001 | EVT-S001 | EVT-P001 | ORIGEM-01 | ID compartilhado/role/tempo | esperado | nenhuma |

Regras:

1. ID compartilhado é a correlação mais forte.
2. Ator + target + role + endpoint + origem + sequência temporal formam
   correlação circunstancial; explicitar quais elementos faltam.
3. Timestamp isolado não basta.
4. Eventos esperados podem não formar pares 1:1 por causa do pooling.
5. Todo evento relevante deve aparecer na matriz ou receber justificativa.
6. Totais da matriz devem reconciliar com os resumos por fonte.

Sequência esperada, se registrada:

```text
ação autorizada na Platform API
  -> emissão/inicialização do login gerenciado
  -> tentativa no Session Pooler
  -> autenticação/conexão PostgreSQL
  -> término cliente/backend
  -> expiração administrativa às 21:28:48 UTC
```

A sequência é hipótese de correlação, não prova de que todos os eventos tenham
existido ou sido registrados.

## Revisão independente

O revisor deve receber filtros, contagens, resumos sanitizados, matriz de
correlação, documentação de cobertura e referência à evidência primária
restrita. Não deve receber a senha nem o JSONL.

Checklist do revisor:

- [ ] confirmar que operador e revisor são pessoas distintas;
- [ ] conferir janelas exatas e conversão UTC;
- [ ] confirmar que a ampliada contém integralmente a crítica;
- [ ] verificar plano, retenção, configuração histórica e limites por fonte;
- [ ] reproduzir filtros e contagens, ou justificar por que a reprodução é
      inviável sem criar nova cópia sensível;
- [ ] conferir filtros estruturados e busca textual;
- [ ] verificar se limite/paginação foi reconciliado;
- [ ] revisar alias, sanitização e ausência de secrets;
- [ ] reconciliar totais por fonte com a matriz;
- [ ] contestar correlações baseadas somente em timestamp;
- [ ] confirmar a categoria A, B, C ou D de cada fonte;
- [ ] listar lacunas, falsos positivos possíveis e dependências externas;
- [ ] registrar decisão, data, função, ressalvas e ações exigidas.

## Critérios de aprovação humana

### Aprovar a coleta como tecnicamente completa

Somente quando:

1. todas as fontes disponíveis foram consultadas nas duas janelas;
2. cobertura, logging histórico, retenção, timezone, limites e gaps foram
   registrados;
3. totais e detalhes foram reconciliados sem truncamento silencioso;
4. toda evidência foi sanitizada e a evidência primária está sob custódia;
5. cada fonte recebeu categoria A, B, C ou D com justificativa;
6. o revisor independente reproduziu ou validou a coleta;
7. pendências têm responsável e prazo.

“Coleta tecnicamente completa” não significa “incidente encerrado”. Uma fonte
pode estar corretamente classificada como limitada ou inconclusiva.

### Bloquear aprovação e escalar

Se houver categoria D, evento inconclusivo material, origem desconhecida,
emissão adicional, mudança de permissão, sessão inexplicada, cobertura
insuficiente não aceita ou exposição de segredo na coleta.

O responsável pelo incidente deverá decidir, com segurança e jurídico/compliance
quando aplicável, entre ampliar a investigação, consultar suporte, aplicar nova
contenção autorizada ou aceitar formalmente uma lacuna residual. Nenhuma dessas
ações é autorizada por este procedimento.

### Condição mínima para futura conclusão de ausência de uso inesperado

- fontes disponíveis classificadas como A, ou limitações B formalmente aceitas
  com controles compensatórios;
- nenhum evento C material pendente;
- nenhum evento D aberto;
- emissão/expiração e ausência de reemissão correlacionadas na auditoria
  administrativa disponível;
- zero sessão remanescente já documentada e nenhuma sessão histórica
  inexplicada encontrada;
- revisão independente e aprovação do responsável pelo incidente.

Mesmo atendida essa condição, o encerramento formal também depende do
tratamento da sessão JSONL e de eventuais backups definido na Etapa 07C.13B.5.

## Dependências e escalonamentos previstos

- acesso humano autorizado ao projeto e à organização Supabase;
- identificação do plano e retenção vigentes em 22/10/2026;
- confirmação da configuração histórica de logging;
- atestado sanitizado do host/IP/região/processo esperados;
- disponibilidade de Platform Audit Logs, Account Audit Logs ou suporte;
- eventual Log Drain/arquivo corporativo já existente no período;
- custodiante e repositório restrito de incidentes;
- suporte Supabase para lacunas ou semântica não documentada;
- revisor independente e aprovador humano.

Ao abrir chamado, incluir apenas projeto, papel, versão da CLI, comando sem
saída, timestamps UTC, fontes ausentes e pergunta objetiva. Não anexar segredo,
token, connection string, JSONL ou saída bruta que possa contê-los.

## Riscos residuais

- Retenção expirada ou logging desabilitado pode tornar impossível comprovar a
  ausência de uso.
- Logs PostgreSQL podem mostrar apenas o IP intermediário do pooler.
- Pooling rompe a relação 1:1 entre cliente e backend.
- Campos ausentes, truncamento e limites podem deixar eventos inconclusivos.
- Platform Audit Logs podem não estar disponíveis no plano ou período.
- Account Audit Logs cobrem somente a conta consultada.
- O endpoint de logs da Management API não substitui a auditoria administrativa
  da organização.
- Uma sessão estabelecida antes da expiração poderia ter continuado ativa; a
  observação posterior de zero conexões é pontual.
- A coleta pode revelar novos dados sensíveis e exige interrupção/sanitização.
- O JSONL e possíveis cópias/retentores externos continuam como risco separado
  até decisão formal da Etapa 07C.13B.5.

## Referências oficiais consultadas

Consultadas em 23/10/2026; o operador deve verificar novamente na execução:

- [Logs in Studio](https://supabase.com/docs/guides/observability/logs)
- [Query logs with SQL](https://supabase.com/docs/guides/observability/advanced-log-filtering)
- [Log sources and fields](https://supabase.com/docs/guides/observability/log-field-reference)
- [Postgres log configurations](https://supabase.com/docs/guides/database/postgres/postgres-log-config)
- [Supavisor / Pooler Logs](https://supabase.com/docs/guides/database/supavisor)
- [Platform Audit Logs](https://supabase.com/docs/guides/security/platform-audit-logs)
- [Management API — Get project logs](https://supabase.com/docs/reference/api/v1-get-project-logs)
- [Log Drains](https://supabase.com/docs/guides/observability/log-drains)
- [Pricing — retenção e disponibilidade por plano](https://supabase.com/pricing)

## Veredito desta etapa

**PROCEDIMENTO PREPARADO; COLETA E CORRELAÇÃO CONTINUAM PENDENTES.**

Um operador autorizado ainda precisa confirmar disponibilidade, cobertura e
retenção de cada fonte antes de consultar os eventos. Este documento não prova
ausência de acesso, não autoriza operação em produção e não encerra o incidente.
