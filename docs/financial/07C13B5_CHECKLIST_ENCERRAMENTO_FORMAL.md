# Etapa 07C.13B.5 — checklist de encerramento formal da credencial

Data de preparação: 23/10/2026. Estado: **PENDENTE — CONTENÇÃO
DOCUMENTADA, ENCERRAMENTO FORMAL NÃO APROVADO**.

## Objetivo e limites

Este documento prepara a revisão final do incidente envolvendo a senha
PostgreSQL do papel gerenciado `cli_login_postgres`. Ele não autoriza acesso ao
projeto KAWANA, coleta de logs, autenticação, teste da senha, execução SQL,
preflight, backup, alteração de role ou qualquer operação em produção.

Nesta etapa foram revisados somente documentos e artefatos sanitizados já
existentes no workspace. Não houve conexão ao Supabase/PostgreSQL, chamada à
Management API, execução da Supabase CLI, leitura ou alteração do JSONL da
sessão, acesso ao valor exposto, criação de cópia de credencial, mudança em
migration, workflow n8n ou configuração de produção.

Fontes documentais principais:

- `07C13B3_VERIFICACAO_LOCAL_CONTENCAO_CREDENCIAL_SUPABASE.md`;
- `07C13B4_ENCERRAMENTO_DOCUMENTAL_CREDENCIAL.md`;
- `07C13B1_RECOLETA_SEGURA_AUDITORIA_REMOTA.md`;
- `07C13A_PLANO_IMPLANTACAO_PRODUCAO.md`;
- `scripts/supabase/07c13a-production-readonly-preflight.sql`.

## Evidências confirmadas até esta etapa

| Evidência | Estado | Limite da conclusão |
| --- | --- | --- |
| O comando que originou a exposição foi identificado e não foi repetido | Confirmada por evidência local sanitizada | Não demonstra se a credencial foi usada por terceiros |
| O valor exposto era uma senha PostgreSQL associada a `cli_login_postgres` | Confirmada com alta confiança na Etapa 07C.13B.3 | Não equivale à senha principal `postgres`, PAT, JWT ou `service_role` |
| A saída sensível ficou registrada no tool output e no JSONL local da sessão Codex | Confirmada na Etapa 07C.13B.3 | Retenção remota, sincronizações e backups ainda não foram inventariados por operador autorizado |
| Não foram encontrados marcadores equivalentes nos locais sanitizados examinados na Etapa 07C.13B.3 | Confirmada dentro daquele escopo | Não prova ausência em sistemas externos, backups ou ferramentas de proteção do endpoint |
| A senha expirou em 22/10/2026 às 21:28:48 UTC | Confirmação administrativa registrada na Etapa 07C.13B.4 | Não substitui a revisão de autenticações anteriores à expiração |
| O papel mantinha `rolcanlogin=true` | Confirmação administrativa registrada na Etapa 07C.13B.4 | Uma futura credencial válida do mesmo papel não é a senha exposta |
| Havia zero conexões ativas no momento da verificação administrativa | Confirmação administrativa registrada na Etapa 07C.13B.4 | Não demonstra ausência de sessões já encerradas nem de uso durante a janela do incidente |
| O preflight local contém 17 result sets, transação `READ ONLY` e `ROLLBACK` | Confirmada por revisão estática e ensaio anterior em staging | Nunca foi executado em KAWANA nesta sequência |

Consequentemente, a contenção atual está documentada: a senha exposta não
aceita nova autenticação por senha e não havia sessão PostgreSQL ativa no
momento da verificação. Ainda não há evidência suficiente para afirmar que não
ocorreu uso inesperado antes da expiração.

## Janelas obrigatórias de correlação

Todos os sistemas devem ser consultados em UTC e preservar precisão de
milissegundos quando disponível.

| Janela | Intervalo | Uso |
| --- | --- | --- |
| Crítica | 22/10/2026 21:23:41.265–21:28:48.000 UTC | Destacar qualquer emissão, autenticação, sessão, consulta ou evento administrativo associado ao papel |
| Ampliada | 22/10/2026 21:08:41–21:43:48 UTC | Compensar diferença de relógio, emissão assíncrona, ingestão atrasada e eventos imediatamente anteriores ou posteriores |

O operador deve registrar o timezone apresentado pela fonte, a conversão para
UTC, a precisão e eventual atraso conhecido de ingestão. Se um evento
correlacionado estiver próximo ao limite, se houver relógio divergente ou se a
emissão tiver ocorrido antes da janela ampliada, a busca deve ser expandida e
o novo intervalo justificado. Ausência de eventos só é conclusiva quando a
fonte confirma cobertura e retenção integrais do período.

## Checklist de coleta por operador autorizado

### Preparação comum

- [ ] Designar operador com acesso mínimo necessário e revisor independente.
- [ ] Registrar número do caso, fonte consultada, projeto, intervalo UTC e
      horário da coleta, sem registrar senha, token ou string de conexão.
- [ ] Confirmar previamente a retenção, disponibilidade, timezone e possíveis
      lacunas de cada fonte.
- [ ] Consultar primeiro a janela ampliada e marcar separadamente os eventos da
      janela crítica.
- [ ] Preservar apenas metadados necessários e resultados sanitizados; não
      exportar secrets, payloads ou conteúdo financeiro.
- [ ] Calcular totais por resultado: sucesso, rejeição, início de sessão,
      término de sessão e evento administrativo.
- [ ] Para cada evento relevante, registrar timestamp UTC, fonte, tipo,
      resultado, papel, origem normalizada, endpoint e identificador de
      correlação disponível.
- [ ] Comparar IP/região e `application_name` com a máquina e o processo
      esperados, usando inventário mantido pelo operador — nunca por inferência
      deste agente.
- [ ] Submeter a coleta e a conclusão a revisão por uma segunda pessoa.

### PostgreSQL / Logs Explorer

- [ ] Filtrar pelo papel exato `cli_login_postgres` na janela ampliada.
- [ ] Localizar autenticações bem-sucedidas e rejeitadas, inclusive falhas por
      expiração após 21:28:48 UTC.
- [ ] Correlacionar abertura, duração e encerramento de sessões; verificar se
      alguma atravessou o instante de expiração.
- [ ] Registrar IP/região de origem, banco, endpoint direto ou pooler,
      `application_name` e propriedades TLS somente quando disponíveis.
- [ ] Procurar `psql`, `pg_dump`, clientes desconhecidos ou nomes de aplicação
      ausentes/incompatíveis com a tentativa documentada.
- [ ] Revisar statements ou eventos atribuídos ao papel somente se a política
      de logging os tiver capturado, evitando exportar dados consultados.
- [ ] Documentar explicitamente cobertura, retenção e eventuais gaps dos logs.

Critério de aceite: nenhuma autenticação bem-sucedida, sessão ou atividade
incompatível com a ação administrativa conhecida; eventos esperados
correlacionados por horário, origem e cliente; zero sessão remanescente; e
cobertura integral comprovada. Uma rejeição posterior por senha expirada é
compatível com a contenção, mas deve ser explicada se a origem for inesperada.

Critério de escalonamento: qualquer sucesso não explicado, origem/cliente
desconhecido, sessão além do esperado, acesso a objetos, ausência material de
logs ou divergência temporal. Nesse caso, não encerrar: preservar metadados,
ampliar a janela e abrir investigação separada de possível uso indevido.

### Pooler / Supavisor

- [ ] Consultar eventos do Session pooler e identificar o endpoint efetivamente
      relacionado à emissão ou tentativa documentada.
- [ ] Incluir Transaction pooler somente se os eventos administrativos ou de
      PostgreSQL indicarem emissão ou uso por esse endpoint.
- [ ] Correlacionar tentativa de autenticação, conexão do cliente, conexão
      backend, reutilização e encerramento.
- [ ] Registrar origem, região, endpoint, identificador de sessão/conexão e
      `application_name`, quando presentes.
- [ ] Verificar conexões backend ou sessões lógicas mantidas além de
      21:28:48 UTC e confirmar seu encerramento.
- [ ] Comparar contagens e identificadores com os eventos PostgreSQL para
      detectar lacunas ou duplicação causada pelo pooling.
- [ ] Documentar cobertura, retenção e limitações do Supavisor.

Critério de aceite: apenas o fluxo esperado, origem reconhecida, correlação
consistente com PostgreSQL e nenhuma sessão ou backend inesperado persistente.

Critério de escalonamento: conexão sem par esperado, origem desconhecida,
sessão persistente, divergência de contagens/horários ou falta de cobertura que
impeça excluir uso não autorizado.

### Management API / auditoria administrativa

- [ ] Identificar a solicitação que inicializou `cli_login_postgres` sem
      recuperar ou exibir a senha.
- [ ] Registrar horário de solicitação, emissão e expiração/`VALID UNTIL`, além
      do identificador não secreto do evento.
- [ ] Identificar a conta administrativa ou PAT que autorizou a CLI e confirmar
      que pertence ao operador esperado, sem registrar o token.
- [ ] Correlacionar versão da CLI, ação solicitada e projeto com a cadeia já
      documentada.
- [ ] Procurar revogação, renovação, reemissão ou nova credencial para o mesmo
      papel na janela ampliada e no período subsequente disponível.
- [ ] Procurar alterações administrativas incomuns no projeto associadas à
      mesma identidade ou origem.
- [ ] Confirmar o mecanismo suportado que tornou aquela senha específica
      inválida, distinguindo-o da senha principal `postgres`.
- [ ] Documentar cobertura, retenção e lacunas da auditoria administrativa.

Critério de aceite: uma única emissão esperada, identidade/origem autorizada,
expiração coincidente com 21:28:48 UTC, nenhuma reemissão ou alteração
inesperada e correlação consistente com PostgreSQL/Supavisor.

Critério de escalonamento: emissão adicional, identidade desconhecida, evento
administrativo incompatível, diferença de expiração, indício de comprometimento
do PAT ou falta de trilha suficiente. A rotação do PAT só deve ser considerada
em investigação autorizada se houver evidência de comprometimento separado.

## Evidências que ainda precisam ser obtidas

| Evidência pendente | Responsável mínimo | Forma aceitável e sanitizada |
| --- | --- | --- |
| Cobertura e resultado dos logs PostgreSQL nas duas janelas | Administrador Supabase/PostgreSQL | Relatório com filtros, totais, eventos relevantes, timezone, retenção e gaps; sem dados consultados ou secrets |
| Cobertura e resultado do Pooler/Supavisor | Administrador Supabase | Mesmos metadados, com correlação de sessão/backend e endpoint |
| Emissão, identidade autorizadora, expiração e ausência de reemissão na Management API | Administrador da organização Supabase | IDs não secretos, timestamps UTC, ator esperado e conclusão revisada |
| Origem/IP e cliente esperados para comparação | Operador responsável pela execução original | Registro administrativo do host/processo, sem credenciais |
| Evidência de revisão independente | Revisor de segurança | Nome/função, data, escopo revisto e decisão assinada/aprovada no sistema definido pela organização |
| Inventário de retenção do JSONL, serviço Codex, sincronização de perfil, proteção de endpoint e backups | Responsável por segurança/privacidade e custodiante dos backups | Local lógico, controlador, política, prazo, acesso e capacidade de eliminação; sem copiar o conteúdo |
| Decisão formal de retenção ou eliminação | Dono do dado, segurança e jurídico/compliance quando aplicável | Base, prazo, responsáveis, escopo e método aprovado |
| Comprovação da disposição autorizada | Operador autorizado | Data, mecanismo suportado, escopo, resultado e exceções; nunca a linha sensível |

Capturas de tela ou exportações brutas não são obrigatórias se aumentarem a
exposição. Quando a política exigir evidência primária, ela deve ficar em
repositório restrito de incidentes, com acesso auditado e redação de secrets;
este repositório de código deve receber apenas a conclusão sanitizada.

## Critérios objetivos para a sessão JSONL e eventuais backups

### Gate de decisão

A decisão só pode ser aprovada quando todos os itens abaixo estiverem
respondidos e registrados:

- [ ] Existe obrigação legal, contratual, regulatória, investigativa ou `legal
      hold` que exija preservar o original?
- [ ] Os logs foram revisados ou a investigação ativa ainda depende do JSONL?
- [ ] Um extrato sanitizado contém metadados suficientes para auditoria sem o
      segredo?
- [ ] Foram inventariados o arquivo original, retenção do serviço Codex,
      sincronizações, backups e ferramentas de proteção do endpoint, sem abrir
      ou duplicar o conteúdo?
- [ ] Estão definidos proprietário, pessoas com acesso, local de custódia,
      prazo, revisão periódica e evento de descarte?
- [ ] O mecanismo de eliminação é suportado e seu alcance/limitações em backups
      são conhecidos?

### Aprovar retenção restrita somente se

Todos os critérios aplicáveis forem atendidos:

1. há obrigação de retenção ou necessidade investigativa documentada;
2. o prazo é definido e mínimo, com data/evento de reavaliação;
3. o original permanece único, sem novas cópias de trabalho;
4. acesso é nominal, mínimo, auditado e limitado aos responsáveis pelo caso;
5. armazenamento e backups possuem proteção compatível com credencial;
6. o arquivo é fechado antes de registrar somente caminho lógico, tamanho,
   timestamps e SHA-256; o conteúdo não é aberto, exportado ou indexado;
7. existe plano de eliminação ao término da obrigação, incluindo o tratamento
   possível de backups conforme sua política de ciclo de vida.

### Aprovar eliminação somente se

Todos os critérios forem atendidos:

1. contenção e revisão dos logs foram aprovadas, ou eventual investigação de
   uso indevido foi concluída;
2. não há `legal hold` nem obrigação de retenção;
3. o extrato sanitizado e as aprovações preservam a trilha necessária;
4. dono do dado, segurança e jurídico/compliance quando aplicável autorizaram
   explicitamente o escopo e o método;
5. a sessão foi encerrada e o mecanismo suportado pelo Codex foi identificado;
6. cópias locais gerenciáveis, sincronizações e backups foram inventariados;
7. a eliminação pode ser comprovada sem reproduzir o valor, e remanescentes em
   backup recebem prazo de expiração e controles compensatórios documentados.

Não editar nem redigir o JSONL in-place. Não criar cópia para realizar
sanitização. Backups imutáveis que não permitam eliminação seletiva devem
permanecer inacessíveis ao uso normal, seguir o prazo de expiração vigente e
ter restauração condicionada a controles que impeçam reintrodução do segredo.
Se qualquer gate estiver sem resposta, a decisão permanece pendente e o
original deve ser preservado com acesso restrito, sem novas cópias.

## Checklist para o futuro preflight remoto

Este checklist é somente preparatório. Sua execução exige autorização nova e
explícita, depois do tratamento formal deste incidente. Não usar a Supabase CLI
para obter credenciais e não repetir `supabase db dump --dry-run`.

### Pré-condições e segregação

- [ ] Incidente da credencial anterior formalmente tratado, sem reutilizar a
      senha exposta.
- [ ] Escopo, janela, operador e revisor aprovados; projeto e endpoint conferidos
      por duas pessoas.
- [ ] Cliente PostgreSQL 17 em container descartável e confiável.
- [ ] SQL e cadeia CA montados somente leitura; nenhum secret no workspace,
      imagem, histórico, linha de comando, stdout ou stderr.
- [ ] Endpoint direto ou Session pooler aprovado; Transaction pooler proibido.
- [ ] Autenticação digitada interativamente por administrador fora da sessão
      Codex, sem eco, ou `PGPASSFILE` criado fora do repositório, protegido,
      montado somente leitura e inacessível ao agente.
- [ ] O agente não possui capacidade de ler a senha/passfile, variáveis do
      processo, clipboard, terminal do operador ou saída que possa exibi-los.
- [ ] Diretórios de saída sanitizada e descarte do container definidos.

### TLS e limites de execução

- [ ] `PGSSLMODE=verify-full` efetivamente aplicado.
- [ ] CA confiável correta fornecida por caminho somente leitura; hostname do
      endpoint corresponde ao certificado e não foi substituído por IP/alias.
- [ ] Falha de CA, hostname ou negociação TLS causa aborto; não reduzir para
      `verify-ca`, `require` ou modo permissivo.
- [ ] `statement_timeout=30000`, `lock_timeout=5000` e
      `idle_in_transaction_session_timeout=60000` aplicados por `PGOPTIONS`.
- [ ] `psql -X -v ON_ERROR_STOP=1 --csv -f /audit/preflight.sql` executa o
      arquivo diretamente em uma única sessão, sem SQL posicional.

### Critérios de aceitação da captura

- [ ] Código de saída `0`, com `BEGIN`, `transaction_read_only=on` e `ROLLBACK`.
- [ ] Exatamente 17 result sets identificados por `section`, inclusive
      cabeçalhos para resultados vazios: `database_context`, `required_roles`,
      `required_schemas`, `required_relations`, `profiles_columns`,
      `profiles_constraints`, `profiles_role_status_counts`,
      `profiles_incompatible_values`, `target_constraints`, `target_policies`,
      `effective_table_privileges`, `target_functions`,
      `financial_private_access`, `supabase_admin_owned_application_objects`,
      `default_privileges`, `financial_company_readiness` e
      `migration_history`.
- [ ] stdout e stderr capturados separadamente e verificados contra exposição
      de secrets antes de qualquer retenção ou compartilhamento.
- [ ] Nenhuma função da aplicação executada e nenhum dado pessoal ou financeiro
      retornado; somente catálogo e contagens agregadas previstas.
- [ ] Resultado revisado por duas pessoas e comparado ao baseline aprovado.
- [ ] Qualquer erro, seção ausente, estado diferente de `READ ONLY`, falha TLS,
      divergência estrutural ou suspeita de segredo provoca aborto e No-Go.

Mesmo que o preflight seja aprovado, ele não autoriza backup, migration,
`db push`, `migration repair`, implantação ou correção de dados.

## Riscos residuais

- Os logs das três fontes ainda não comprovam ausência de uso indevido na
  janela crítica ou ampliada.
- Retenção limitada ou gaps podem impedir uma conclusão negativa definitiva.
- O JSONL original contém o valor exposto; retenção prolongada aumenta o risco
  de acesso, sincronização ou restauração futura.
- Cópias sob controle do serviço Codex, backup, sincronização de perfil ou
  proteção de endpoint ainda não foram inventariadas formalmente.
- `rolcanlogin=true` mantém o papel utilizável por credenciais futuras, embora
  não reative a senha expirada.
- A zero conexão observada é pontual e não exclui sessões anteriores já
  encerradas.
- Configurações reais dos workflows n8n 03/04 continuam não versionadas; não há
  evidência de que tenham usado o papel, mas essa hipótese deve ser investigada
  somente se os logs indicarem origem compatível com n8n.
- O preflight remoto continua não executado e não fornece evidência atual da
  configuração de produção.

## Operações que exigem autorização humana explícita

- acesso e exportação sanitizada de logs PostgreSQL, Supavisor e Management API;
- ampliação de janela ou abertura de investigação de possível uso indevido;
- consulta administrativa adicional ao papel ou contato com suporte Supabase;
- decisão de retenção, `legal hold`, restrição, hashing do arquivo fechado ou
  eliminação da sessão JSONL e de cópias gerenciáveis;
- alteração de políticas de backup, sincronização ou retenção do serviço;
- rotação de PAT, senha principal ou qualquer outra credencial;
- inspeção ou alteração de workflows n8n;
- preparação e execução do preflight remoto com autenticação fora do alcance
  do agente;
- qualquer backup, restauração, migration ou implantação posterior.

## Critérios para encerramento formal

O incidente só pode receber o estado **ENCERRADO COM EVIDÊNCIAS** quando todos
os critérios forem satisfeitos:

1. PostgreSQL, Pooler/Supavisor e Management API possuem cobertura comprovada
   da janela ampliada, com destaque para a janela crítica, ou toda lacuna foi
   avaliada e aceita formalmente como risco por segurança;
2. nenhuma autenticação, sessão, consulta, origem, cliente, emissão ou ação
   administrativa inesperada permanece sem explicação;
3. se houve atividade inesperada, a investigação separada foi concluída e as
   medidas de resposta foram aprovadas — a simples expiração não basta;
4. expiração às 21:28:48 UTC, zero sessões remanescentes e ausência de
   reemissão da mesma credencial foram correlacionadas entre as fontes;
5. revisão independente aprovou a evidência sanitizada e registrou as
   limitações de retenção/cobertura;
6. inventário da sessão JSONL, serviço, sincronizações e backups foi concluído;
7. retenção ou eliminação recebeu decisão formal, foi executada por mecanismo
   suportado quando aplicável e teve resultado registrado sem reproduzir o
   segredo;
8. riscos residuais aceitos possuem responsável, justificativa, prazo e
   controle compensatório;
9. o registro final identifica aprovadores, data, fontes, janelas e decisão,
   sem credenciais nem conteúdo sensível.

O preflight remoto não é requisito para demonstrar o encerramento desta
credencial; ele é uma etapa operacional futura e separada. Contudo, não deve
ser executado enquanto o tratamento formal deste incidente não tiver sido
aprovado e não houver autorização específica para a nova coleta.

## Veredito desta etapa

**PENDENTE — NÃO DECLARAR O INCIDENTE ENCERRADO.**

A contenção está documentada, mas a ausência de uso inesperado ainda depende
da correlação de logs por operador autorizado, e o destino da sessão JSONL e
de eventuais backups ainda depende de decisão formal. Nenhuma etapa operacional
deve ser iniciada automaticamente a partir deste checklist.
