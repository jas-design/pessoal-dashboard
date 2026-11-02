# Etapa 07C.13B.4 — encerramento documental do incidente de credencial

Data: 22/10/2026. Estado: **credencial contida; encerramento formal pendente de
revisão de logs e tratamento da evidência local**.

## Escopo e origem da nova evidência

Esta etapa registra evidência administrativa fornecida pelo responsável pelo
projeto KAWANA `xjxwyzyfnumfphubuize`:

- papel: `cli_login_postgres`;
- senha expirada em 22/10/2026 às 21:28:48 UTC;
- `rolcanlogin=true`;
- conexões ativas: zero.

A evidência não foi consultada novamente. Não houve acesso à produção,
execução SQL, Supabase CLI, uso de credencial, alteração de banco, role,
workflow ou configuração.

O valor da senha não foi recebido nem registrado neste relatório.

## Classificação atualizada

A credencial exposta foi confirmada como senha PostgreSQL do papel gerenciado
`cli_login_postgres`, e não como senha principal `postgres`, personal access
token, JWT ou chave `service_role`.

**A senha está expirada para novas autenticações por senha desde 22/10/2026 às
21:28:48 UTC.** O fato de `rolcanlogin=true` não revalida uma senha expirada;
ele apenas informa que o papel continua habilitado para login com uma
credencial válida. Uma credencial futura desse mesmo papel não é a senha
exposta.

O total de zero conexões ativas confirma que não restou sessão PostgreSQL ativa
no momento da verificação administrativa. Expiração de senha não encerra por
si só sessões preexistentes, portanto esse dado é necessário para considerar a
contenção atual completa.

Conclusão de contenção:

- novas autenticações com a senha exposta: bloqueadas por expiração;
- sessões ainda ativas: nenhuma;
- rotação da senha principal `postgres`: não indicada por esta evidência;
- alteração de n8n, Astro ou worker: não indicada para conter este segredo.

## Linha do tempo

Os timestamps locais da sessão Codex foram correlacionados sem reproduzir a
saída sensível:

| Evento | Timestamp UTC |
| --- | --- |
| início do comando que solicitou o dry run | 22/10/2026 21:23:41.265 |
| saída que tornou a senha visível | 22/10/2026 21:23:46.853 |
| expiração confirmada da senha | 22/10/2026 21:28:48.000 |

Janela conservadora de possível validade durante o incidente:

```text
22/10/2026 21:23:41.265 UTC até 22/10/2026 21:28:48.000 UTC
```

Duração: 5 minutos e 6,735 segundos. Considerando o momento em que o valor se
tornou visível, a janela foi de 5 minutos e 1,147 segundos.

Para compensar diferenças de relógio, criação assíncrona do login e atraso de
ingestão, o administrador deve revisar pelo menos o intervalo ampliado:

```text
22/10/2026 21:08:41 UTC até 22/10/2026 21:43:48 UTC
```

A investigação deve destacar a janela crítica acima, mas não limitar a busca a
ela se os logs indicarem criação anterior, atraso ou timestamp divergente.

## Logs administrativos a revisar

### PostgreSQL / Logs Explorer

Filtrar por `cli_login_postgres` e registrar somente metadados necessários:

- autenticações bem-sucedidas e rejeitadas;
- início e término de sessões;
- endereço/IP de origem e região, quando disponíveis;
- banco, endpoint direto ou pooler e método TLS;
- `application_name`, especialmente `pg_dump`, `psql` ou cliente inesperado;
- statements ou eventos atribuídos ao papel, se a política de log os registrar;
- erros de senha expirada depois de 21:28:48 UTC.

O IP esperado deve ser comparado pelo administrador com o host que executou a
CLI. O endereço esperado não foi coletado nem inferido neste relatório.

### Pooler / Supavisor

Se o login passou pelo Session pooler, revisar:

- tentativas de autenticação do papel;
- criação e encerramento de conexões backend;
- origem e `application_name`;
- sessões mantidas além do vencimento.

Não é necessário investigar Transaction pooler como método da próxima
auditoria, mas seus logs devem ser incluídos se a evidência administrativa
mostrar que a credencial foi emitida ou usada por esse endpoint.

### Management API / auditoria da organização

Correlacionar:

- solicitação que inicializou `cli_login_postgres`;
- horário de emissão e `VALID UNTIL`/expiração;
- identidade administrativa/PAT que autorizou a CLI;
- revogações, renovações ou novas emissões do mesmo papel;
- eventos incomuns no projeto dentro da janela ampliada.

O PAT não foi o segredo exposto. Ele só deve ser rotacionado se os logs
indicarem comprometimento separado ou uso administrativo inesperado.

## Impacto sobre consumidores

Não há motivo, com a evidência atual, para rotacionar a senha principal do
banco. Portanto, nenhuma indisponibilidade de n8n 03/04, backups, `psql`,
pgAdmin ou outros consumidores deve ser provocada como parte desta contenção.

Os workflows reais n8n 03/04 continuam sem export/configuração versionada. A
distinção permanece relevante para mudanças futuras:

- REST/RPC com `service_role`: independente da senha PostgreSQL;
- node PostgreSQL ou connection string: dependente da senha configurada nesse
  consumidor, mas não há evidência de uso de `cli_login_postgres` pelos
  workflows.

Nenhum workflow deve ser aberto, alterado ou testado para encerrar este
incidente, salvo se a revisão de logs identificar conexão originada do n8n.

## Tratamento seguro da sessão JSONL

O JSONL local do Codex contém o tool output original e deve permanecer
preservado até a conclusão da revisão de logs. Não copiar seu conteúdo nem
produzir novos arquivos com a linha sensível.

Procedimento preparado para execução posterior e autorizada:

1. encerrar a sessão Codex para que o arquivo deixe de receber novas entradas;
2. registrar em inventário restrito somente caminho, tamanho, timestamps e
   SHA-256 do arquivo fechado, sem abrir ou exportar seu conteúdo;
3. manter um extrato sanitizado separado com comando, versão da CLI, papel,
   timestamps, expiração, `rolcanlogin` e contagem de conexões — nunca a senha;
4. confirmar se existe obrigação de retenção, investigação ou legal hold;
5. identificar cópias em backup, sincronização do perfil e retenção do serviço
   Codex, sem baixar ou duplicar o conteúdo;
6. se houver retenção obrigatória, restringir acesso ao arquivo original e
   registrar responsável e prazo;
7. se a eliminação for autorizada, usar o mecanismo suportado pelo Codex para
   excluir a sessão e depois confirmar a remoção do JSONL e das cópias locais
   gerenciáveis;
8. não editar ou redigir o JSONL in-place, pois isso destrói a integridade da
   evidência sem garantir remoção em backups;
9. registrar somente data, responsável, método e resultado da retenção ou
   eliminação.

Nenhuma dessas ações foi executada nesta etapa. O arquivo e os logs foram
preservados.

## Método obrigatório para a próxima auditoria

A próxima auditoria não utilizará `supabase db dump --dry-run` nem qualquer
comando da Supabase CLI para obter credenciais.

O transporte aprovado permanece:

```text
psql -X -v ON_ERROR_STOP=1 --csv -f /audit/preflight.sql
```

Controles obrigatórios:

- PostgreSQL 17 em container descartável;
- SQL e CA montados somente leitura;
- endpoint direto ou Session pooler, nunca Transaction pooler;
- TLS `verify-full`;
- timeouts via `PGOPTIONS`;
- senha digitada interativamente por administrador fora da sessão Codex, sem
  eco, ou `PGPASSFILE` protegido e inacessível ao agente;
- nenhum segredo em linha de comando, stdout, stderr, relatório ou documento;
- uma única sessão, `BEGIN TRANSACTION READ ONLY`, 17 result sets identificados
  e `ROLLBACK` final;
- código de saída e integridade da captura verificados antes de aceitar o
  resultado.

A auditoria remota continua dependente de nova autorização explícita.

## Verificações restantes para encerramento formal

Restam somente:

1. concluir e registrar de forma sanitizada a revisão dos logs PostgreSQL,
   Pooler/Supavisor e Management API na janela crítica e na janela ampliada;
2. confirmar que não houve autenticação ou atividade inesperada com
   `cli_login_postgres` antes da expiração; se houve, abrir investigação de
   incidente separada e ampliar a janela;
3. aprovar a política de retenção da sessão JSONL e de eventuais backups;
4. após a retenção necessária, executar e comprovar o tratamento suportado da
   sessão JSONL sem criar novas cópias do segredo.

## Veredito

**Contenção técnica confirmada; encerramento formal ainda pendente.**

A senha exposta não aceita novas autenticações por senha e não há conexões
ativas. O incidente poderá ser classificado como **ENCERRADO COM EVIDÊNCIAS**
somente após a revisão dos logs não encontrar uso inesperado — ou após eventual
investigação desse uso — e o tratamento da sessão JSONL ser formalmente
decidido e registrado.

Não iniciar auditoria remota automaticamente.
