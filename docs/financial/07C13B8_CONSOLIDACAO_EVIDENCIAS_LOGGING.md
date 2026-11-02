# Etapa 07C.13B.8 — consolidação das evidências de logging

Data de preparação: 23/10/2026. Estado: **EVIDÊNCIAS PARCIAIS CONSOLIDADAS —
INCIDENTE NÃO ENCERRADO**.

## Objetivo e limites

Este relatório consolida as evidências de logging fornecidas pelo operador para
o incidente da senha PostgreSQL associada a `cli_login_postgres`. Ele distingue
o que foi observado do que não pode ser demonstrado devido às limitações das
fontes.

As afirmações operacionais deste documento são declarações do operador e não
foram verificadas novamente por este agente. Nesta etapa foram lidos apenas os
relatórios sanitizados 07C.13B.4, 07C.13B.5 e 07C.13B.6. Não houve acesso à
produção, Supabase, PostgreSQL, Management API, credenciais, sessões JSONL,
arquivos `.env`, migrations, workflows ou configurações.

Este documento não autoriza nova coleta, mudança de logging, SQL, autenticação,
contenção, rotação, alteração de produção ou descarte de evidência.

## Linha do tempo mantida

| Marco | Timestamp UTC | Origem da evidência |
| --- | --- | --- |
| início do comando que solicitou o dry run | 22/10/2026 21:23:41.265 | correlação local sanitizada já documentada |
| saída que tornou a senha visível | 22/10/2026 21:23:46.853 | correlação local sanitizada já documentada |
| expiração da senha | 22/10/2026 21:28:48.000 | confirmação administrativa fornecida pelo operador |

Janelas de referência:

```text
Crítica:  22/10/2026 21:23:41.265–21:28:48.000 UTC
Ampliada: 22/10/2026 21:08:41.000–21:43:48.000 UTC
```

Este relatório pressupõe que as buscas declaradas pelo operador tiveram essas
janelas como referência. Ainda precisam ser revisados de forma independente os
limites efetivamente aplicados em cada fonte, timezone, arredondamento,
paginação e completude.

## Evidências fornecidas e classificação

| Fonte/evidência | Observação fornecida | O que sustenta | Limitação determinante | Classificação provisória |
| --- | --- | --- | --- | --- |
| estado da credencial | expirou em 22/10/2026 às 21:28:48 UTC | novas autenticações por essa senha ficaram bloqueadas após o vencimento | não informa se houve uso anterior | contenção confirmada; não prova ausência histórica |
| PostgreSQL | logs examinados não apresentaram autenticação identificável de `cli_login_postgres` | nenhuma autenticação atribuível ao papel foi identificada no conjunto consultado | logging de conexões/desconexões está atualmente desativado; estado histórico desconhecido; cobertura, retenção e classes registradas não foram demonstradas | ausência de evento identificado; não é ausência comprovada de acesso |
| Supavisor | nenhum registro retornado na janela consultada | a consulta declarada não retornou evento do Supavisor | resultado vazio pode decorrer de ausência de tráfego, fonte não usada, retenção, logging, filtro, limite ou indisponibilidade; cobertura não comprovada | ausência de registro utilizável por limitação não resolvida |
| PgBouncer | 483 eventos exportados; análise anterior não identificou referência à credencial | o corpus exportado contém atividade do pooler e nenhuma correspondência foi apontada na análise anterior | integridade, origem, janela exata, timezone, filtros, paginação, completude e revisão independente do corpus ainda não foram confirmados | ausência de referência no corpus observado; conclusão de acesso permanece limitada |
| Organization Audit Logs | indisponíveis no plano Free | explica a ausência dessa fonte administrativa no Dashboard | impede reconstruir por essa fonte ator, rota, status, emissão, renovação e mudanças administrativas; Account Audit Logs ou suporte ainda podem ter cobertura diferente | ausência por indisponibilidade da fonte, não ausência de ação |
| configuração atual | `log_connections=off` e `log_disconnections=off` em Database → Settings → Connection logging | o estado atual não garante geração de eventos de abertura/encerramento | não prova qual era o valor em 22/10/2026 | limitação atual confirmada; estado histórico pendente |

Nenhuma das linhas acima atende, isoladamente ou em conjunto, aos requisitos da
categoria “ausência comprovada de eventos no período coberto” definida na Etapa
07C.13B.6.

## Conclusões que podem ser registradas

### Conclusões sustentadas

- A senha exposta expirou às 21:28:48 UTC e não pode ser usada para uma nova
  autenticação por senha após esse instante.
- Nenhuma autenticação identificável de `cli_login_postgres` foi encontrada nos
  logs PostgreSQL examinados pelo operador.
- A consulta declarada ao Supavisor não retornou registros na janela usada.
- O conjunto exportado do PgBouncer contém 483 eventos e a análise anterior não
  apontou referência ao papel investigado.
- Organization Audit Logs não estavam disponíveis no plano Free informado.
- `log_connections` e `log_disconnections` estão atualmente desativados.
- Não foi comprovado o estado histórico desses parâmetros durante a janela do
  incidente.

### Conclusões proibidas com a evidência atual

- “Não ocorreu autenticação com a credencial.”
- “Não houve acesso indevido.”
- “Os logs cobrem integralmente todas as tentativas e sessões.”
- “O resultado vazio do Supavisor comprova que o pooler não foi usado.”
- “Os 483 eventos do PgBouncer representam todos os eventos possíveis.”
- “Nenhuma permissão ou configuração foi alterada.”
- “Nenhuma nova emissão ou renovação administrativa ocorreu.”
- “O incidente está encerrado.”

Redação oficial permitida nesta etapa:

> Não foram identificadas referências a `cli_login_postgres` nas evidências de
> PostgreSQL e PgBouncer examinadas, e a consulta ao Supavisor não retornou
> registros. Como a cobertura histórica do logging de conexões e desconexões
> não foi comprovada e a auditoria da organização não estava disponível no
> plano informado, não é possível excluir autenticações ou atividades que não
> tenham sido registradas.

## Impossibilidade de reconstrução a partir das fontes atuais

Quando `log_connections` não está habilitado, uma conexão PostgreSQL
bem-sucedida pode não produzir o conjunto de eventos necessário para atribuir
usuário, origem e instante da autenticação. Quando `log_disconnections` não
está habilitado, o encerramento e a duração da sessão podem não ser
reconstruíveis. Ativar essas opções agora não recria eventos passados.

O estado atual desativado não demonstra que elas também estavam desativadas em
22/10/2026. Contudo, enquanto o estado histórico permanecer desconhecido, a
ausência de correspondência nos logs não pode ser interpretada como cobertura
integral de autenticações e sessões.

Também não é possível reconstruir com segurança a atividade somente a partir
de:

- zero resultados no Supavisor, sem prova de retenção e cobertura;
- eventos PostgreSQL que possam conter apenas o IP do pooler;
- 483 eventos do PgBouncer sem validação de completude e cadeia de custódia;
- ausência de Platform/Organization Audit Logs no plano;
- confirmação posterior de zero conexões ativas, que é pontual e não mostra
  sessões já encerradas.

Se nenhum arquivo histórico, drain, auditoria de conta, telemetria de endpoint
ou registro do provedor existir, autenticações não registradas poderão
permanecer tecnicamente irrecuperáveis. Essa lacuna deve ser aceita formalmente
como risco residual; não deve ser convertida em prova negativa.

## Avaliação por fonte conforme a taxonomia da Etapa 07C.13B.6

| Fonte | Categoria provisória | Fundamentação | O que poderia mudar a categoria |
| --- | --- | --- | --- |
| PostgreSQL | B — ausência de registros conclusivos por limitação de logging | nenhuma autenticação identificada, mas estado histórico e cobertura de connection logging não comprovados | comprovação de configuração histórica, retenção/cobertura integral, filtros reproduzidos e revisão independente |
| Supavisor | B — ausência de registros por limitação não resolvida | consulta vazia sem prova suficiente de disponibilidade, retenção e rota usada | confirmação da fonte, retenção, endpoint, filtros, limites e cobertura integral |
| PgBouncer | B — ausência de referência no conjunto disponível, com cobertura não comprovada | há 483 eventos, mas o corpus e a análise ainda não foram validados de forma independente | cadeia de custódia, hash, janela, contagem total, paginação, campos, filtros e revisão independente aprovados |
| Organization Audit Logs | B — fonte indisponível | plano Free não disponibiliza a trilha da organização | evidência histórica externa, Account Audit Logs ou resposta do suporte com cobertura equivalente |
| expiração/zero conexões posterior | evidência de contenção, fora das categorias de ausência histórica | limita novas autenticações e comprova estado pontual posterior | não elimina a lacuna histórica |

Não há, nas evidências fornecidas, evento que possa ser classificado como
atividade potencialmente suspeita. Isso significa apenas que nenhum sinal
suspeito foi identificado nos conjuntos examinados; não reduz as limitações de
cobertura.

## Validação pendente do corpus PgBouncer

Os 483 eventos constituem a principal evidência positiva de que uma fonte de
pooler retornou dados. Antes de aceitar o resultado da análise anterior, um
operador e um revisor independentes devem confirmar, sem colocar a exportação
neste repositório:

- [ ] origem exata da exportação e nome da fonte (`pgbouncer_logs` ou
      equivalente);
- [ ] janela solicitada e janela efetivamente retornada em UTC;
- [ ] timezone e precisão dos timestamps;
- [ ] horário, responsável e método da exportação;
- [ ] tamanho e SHA-256 do arquivo fechado no repositório restrito;
- [ ] retenção e disponibilidade que cobriam o período;
- [ ] contagem total na fonte igual a 483, e não apenas limite/página/export;
- [ ] inexistência de truncamento, paginação não coletada ou erro parcial;
- [ ] campos/texto pesquisados pelo nome exato do papel;
- [ ] buscas por autenticação, falha, abertura, encerramento e identificadores
      mesmo quando o nome do papel não estiver presente;
- [ ] correlação com database, endpoint, origem, cliente e timestamps, quando
      disponíveis;
- [ ] ausência de secrets no artefato sanitizado;
- [ ] reprodução da análise por pessoa diferente do operador original.

Se a exportação tiver exatamente 483 linhas, mas a interface limitar o
resultado a um número superior, isso ainda não prova completude: a contagem da
fonte, os limites e a paginação precisam ser registrados separadamente.

## Evidências históricas ou externas potencialmente recuperáveis

Nenhuma fonte abaixo foi consultada nesta etapa. O responsável pelo incidente
deve decidir se o benefício da coleta justifica o acesso e autorizar cada uma.
Somente fontes que já registravam dados em 22/10/2026 podem preencher a lacuna;
habilitar logging novo não produz evidência retroativa.

| Fonte potencial | Evidência que pode fornecer | Condição/limitação | Prioridade sugerida |
| --- | --- | --- | --- |
| configuração histórica de logging no provedor | valores de `log_connections`, `log_disconnections`, statement logging e pgAudit durante a janela | pode exigir suporte; configuração atual não basta | alta |
| Supabase Account Audit Logs da conta que autorizou a CLI | ação, ator, IP, target, rota/status associados à conta | cobre somente a conta consultada e não substitui auditoria da organização | alta |
| suporte Supabase | retenção interna, emissão/expiração do login gerenciado, semântica das fontes e eventual histórico de configuração | disponibilidade não garantida; chamado deve ser sanitizado | alta |
| Log Drain ou arquivo corporativo preexistente | cópia histórica de `postgres_logs`, `supavisor_logs`, `pgbouncer_logs` ou outros streams | só é útil se estava configurado antes do incidente e reteve a janela | alta |
| exportação original dos 483 eventos PgBouncer | reanálise completa, integridade, campos e correlação | deve permanecer no repositório restrito; não duplicar | alta |
| logs de endpoint/EDR do host que executou a CLI | processo, árvore de execução, conexão de rede e destino | somente se a telemetria já existia e ainda está retida | média |
| firewall, NAT, proxy, DNS ou rede corporativa | conexão de saída do host para endpoint/porta do banco ou pooler | pode indicar conexão, mas normalmente não prova autenticação nem role | média |
| histórico de execução e traces locais já sanitizados | comando, versão da CLI, processo e timestamps | a Etapa 07C.13B.3 já encontrou evidência local limitada; não abrir o JSONL | média |
| backups/arquivos de observabilidade preexistentes | logs removidos da interface principal por retenção | inventariar sem restaurar indiscriminadamente; restauração exige autorização | baixa a média |

Consultas futuras devem registrar uma das seguintes respostas para cada fonte:
`recuperada`, `indisponível`, `retenção expirada`, `não existia no período` ou
`não autorizada`. “Não verificada” não deve ser tratada como indisponível.

## Evidências administrativas ainda faltantes

- identidade/alias do ator que autorizou a emissão;
- ação ou rota administrativa que criou/inicializou o login;
- origem e status da chamada administrativa;
- comprovação de que não houve renovação/reemissão na janela;
- histórico dos parâmetros de connection logging;
- confirmação de retenção e cobertura das fontes consultadas;
- cadeia de custódia e integridade da exportação PgBouncer;
- atestado da origem esperada do host/processo para correlação;
- revisão independente dos filtros, contagens e conclusões.

A indisponibilidade de Organization Audit Logs no plano Free pode tornar parte
dessa lista irrecuperável. Account Audit Logs, arquivos preexistentes e suporte
devem ser considerados, mas sua existência e retenção não podem ser presumidas.

## Avaliação dos riscos residuais

Esta avaliação separa risco operacional atual de incerteza histórica. Não é
uma quantificação probabilística.

| Dimensão | Avaliação | Fundamentação | Tratamento pendente |
| --- | --- | --- | --- |
| uso futuro da senha exposta | contido | senha expirada e zero conexões ativas na verificação administrativa | manter registro de contenção; não testar a senha |
| uso antes da expiração | indeterminado | nenhuma referência identificada, porém logging histórico e cobertura não comprovados | buscar fontes recuperáveis ou aceitar formalmente a lacuna |
| reconstrução de sessões | limitada | connection/disconnection logging atuais desativados e estado histórico desconhecido | obter histórico ou declarar irrecuperabilidade |
| atividade via pooler | parcialmente observada | Supavisor vazio; 483 eventos PgBouncer sem correspondência apontada | validar exportação, rota e completude |
| atividade administrativa | não observável pela fonte da organização | Organization Audit Logs indisponíveis no plano Free | Account Audit Logs/suporte, se disponíveis |
| alterações de permissão/operações SQL | indeterminadas | não há comprovação de statement logging/pgAudit para a janela | verificar configuração histórica e evidência alternativa |
| exposição continuada da evidência | aberta | JSONL contém a saída sensível e a decisão de retenção permanece pendente | decisão humana segundo a Etapa 07C.13B.5 |
| confiança da conclusão | limitada | ausência de referências não equivale a cobertura completa | revisão independente e aceite formal das lacunas |

Não há base técnica para atribuir probabilidade numérica ao uso indevido. O
risco atual de nova autenticação com a senha está contido; o risco histórico de
uso não observado permanece indeterminado.

## Decisões e operações que permanecem pendentes

### Retenção do JSONL e eventuais backups

Permanece integralmente pendente o gate da Etapa 07C.13B.5:

- obrigação legal, contratual, investigativa ou `legal hold`;
- inventário de retenção do serviço, sincronizações e backups;
- responsável, acesso, prazo e evento de descarte;
- decisão formal de retenção restrita ou eliminação por mecanismo suportado;
- comprovação sanitizada da decisão executada.

Este relatório não abriu, leu, copiou, alterou, hashou ou excluiu o JSONL.

### Revisão independente

Uma pessoa diferente do operador deve:

- reproduzir ou validar os filtros nas janelas crítica e ampliada;
- revisar cobertura, retenção, timezone, precisão, limites e paginação;
- validar o corpus PgBouncer e sua cadeia de custódia;
- confirmar a classificação B de cada fonte ou justificar mudança;
- verificar que nenhuma conclusão extrapola as classes efetivamente logadas;
- confirmar a sanitização e ausência de credenciais nos relatórios;
- documentar lacunas irrecuperáveis, falsos negativos possíveis e ressalvas;
- registrar aprovação, rejeição ou pedido de investigação adicional.

### Aceite humano do risco

Se as fontes históricas não puderem ser recuperadas, o responsável por
segurança e o dono do risco devem decidir explicitamente se aceitam que não é
possível provar ausência de autenticações ou operações não registradas. O
aceite deve informar fundamento, impacto potencial, controles compensatórios,
responsável, prazo de revisão e por que nova coleta não alteraria a conclusão.

Aceitar a lacuna não a transforma em evidência de ausência.

## Condições necessárias para encerramento formal

O incidente permanece aberto até que todos os itens aplicáveis sejam atendidos:

1. validar de forma independente o escopo, filtros, janelas e resultado das
   coletas PostgreSQL, Supavisor e PgBouncer;
2. validar integridade, completude e cadeia de custódia dos 483 eventos;
3. obter o estado histórico de connection/disconnection logging ou documentar
   formalmente que ele é irrecuperável;
4. consultar, mediante autorização, Account Audit Logs, arquivos/drains
   preexistentes e suporte Supabase, ou registrar sua indisponibilidade;
5. resolver ou aceitar formalmente as limitações que impedem provar ausência
   de acesso;
6. confirmar que não há evento inconclusivo material nem atividade
   potencialmente suspeita aberta nos conjuntos disponíveis;
7. concluir a revisão independente e registrar seus aprovadores e ressalvas;
8. decidir e executar, quando autorizado, a retenção ou eliminação suportada do
   JSONL e eventuais backups, sem reproduzir o segredo;
9. atribuir responsável, prazo e controle compensatório a cada risco residual;
10. produzir termo final sanitizado que não declare mais do que as fontes
    permitem concluir.

Caso nenhuma evidência histórica adicional exista, o encerramento só poderá
ser considerado como encerramento com lacuna de auditoria explicitamente
aceita, nunca como ausência comprovada de acesso indevido.

## Veredito desta etapa

**CONTENÇÃO MANTIDA; AUSÊNCIA DE USO INDEVIDO NÃO COMPROVADA; ENCERRAMENTO
FORMAL PENDENTE.**

As fontes examinadas não apresentaram referência identificável à credencial,
mas as limitações de logging e auditoria impedem excluir acessos não
registrados. Permanecem pendentes a recuperação possível de evidência
histórica/externa, a validação independente do corpus PgBouncer, a decisão de
retenção do JSONL e o aceite humano dos riscos residuais.
