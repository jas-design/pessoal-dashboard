# Etapa 06E — diagnóstico de infraestrutura e plano n8n → Worker XLSX

## Estado e decisão

Esta etapa prepara a integração do workflow `04 - KAWANA - Financial Data Extraction` com o worker validado na 06D. Nada foi implantado e nenhum workflow, container, rede, dado do Supabase ou arquivo financeiro foi alterado.

O desenho recomendado é:

```text
container que executa o HTTP Request do n8n
  -> rede Docker compartilhada já existente
  -> http://financial-xlsx-worker:8787/v1/extractions/xlsx
  -> worker sem `ports`, sem proxy e sem endereço público
```

O arquivo preparado é `workers/financial-xlsx/docker-compose.hostinger.example.yml`. Ele referencia a rede existente como `external: true`; não a cria, não altera seus atributos e não publica a porta 8787. Os valores `N8N_DOCKER_NETWORK` e `FINANCIAL_XLSX_WORKER_SECRET_PATH` são parâmetros de instalação ainda desconhecidos, não credenciais para o repositório.

### Divergência encontrada na revisão da 06D

A 06D informa que `node:22-bookworm-slim` está fixada pelo digest resolvido no build, mas o `Dockerfile` atual contém somente `FROM node:22-bookworm-slim`. Portanto, a base está fixada por tag, não por digest. Antes de um deploy, selecionar e registrar o digest multiarch aprovado para a arquitetura da VPS, reconstruir a imagem e repetir suíte, healthcheck e piloto. O digest não foi inventado nem alterado nesta etapa.

## Rede: diferença entre teste e VPS

O Compose da 06D cria `financial_internal` com `internal: true`. Isso foi correto no teste isolado, mas esse arquivo não conecta o worker ao n8n da VPS. Uma rede declarada como externa não deve receber também `internal: true`: os atributos pertencem à rede já existente e precisam ser apenas inspecionados.

Conflitos que precisam ser eliminados antes do deploy:

- o nome visível no Compose pode diferir do nome real criado no Docker;
- em n8n com queue mode, o nó HTTP pode executar em um worker n8n diferente do container principal; a rede precisa alcançar o executor real;
- uma rede `internal: true` bloqueia saída externa. Anexar o n8n somente a ela poderia interromper Microsoft Graph e outras APIs;
- uma rede existente não interna mantém o worker sem porta pública, mas permite acesso pelos demais containers dessa rede;
- overlay, Swarm, rootless Docker ou rede não `attachable` podem impedir a associação de um serviço Compose separado;
- o alias `financial-xlsx-worker` não pode conflitar com outro serviço na mesma rede;
- sub-rede, IP ou gateway nunca devem ser inventados no novo Compose.

Se a rede atual contiver containers não confiáveis, o desenho de menor privilégio futuro é uma segunda rede interna dedicada, ligada somente ao worker e aos executores n8n. Isso exigiria alterar a configuração/recriar containers do n8n e, portanto, fica fora desta etapa e depende de autorização específica.

## Segredo de serviço

Gerar um único segredo aleatório de pelo menos 32 bytes somente durante a instalação autorizada. O valor não deve entrar em Git, `.env`, argumentos de comando, workflow exportado, ticket, chat ou log.

- Worker: arquivo fora do repositório, pertencente ao administrador e com permissão `0600`, montado como Docker secret em `/run/secrets/financial_xlsx_worker_auth`.
- n8n: o mesmo valor em credencial protegida do tipo Header/Bearer, cifrada pelo mecanismo de credenciais da instância. Confirmar que `N8N_ENCRYPTION_KEY` já é persistente sem solicitar ou copiar seu valor.
- Compose: recebe somente o caminho do arquivo pelo parâmetro `FINANCIAL_XLSX_WORKER_SECRET_PATH`.
- Rotação: criar nova credencial e novo arquivo, coordenar a troca e recriar somente o worker. O worker aceita um segredo por vez, logo a rotação exige uma curta janela coordenada.

O worker continua aceitando `FINANCIAL_XLSX_WORKER_SECRET` para compatibilidade local, mas o Compose da VPS usa `FINANCIAL_XLSX_WORKER_SECRET_FILE`. Configurar ambos faz o processo recusar a inicialização.

## Contrato do nó HTTP Request

Requisição:

```text
POST http://financial-xlsx-worker:8787/v1/extractions/xlsx
Authorization: Bearer <credencial protegida do n8n>
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
X-Financial-Mapping-Id: kawana-management-report
X-Financial-Mapping-Version: 1
X-Financial-Company-Name: <encodeURIComponent(nome)>
X-Financial-Document-Name: <encodeURIComponent(nome do arquivo)>
X-Financial-Document-Etag: <ETag ou checksum estável da origem>
X-Financial-Company-Id: <opcional; contexto não confiável>
X-Financial-Document-Id: <opcional>
X-Financial-External-File-Id: <opcional>
X-Financial-Period-Month: AAAA-MM <opcional>

Body: propriedade binária do XLSX, em bytes brutos; nunca multipart ou base64.
Timeout do nó n8n: 45 segundos, maior que o limite interno de 30 segundos.
Response format: JSON.
```

No n8n, selecionar explicitamente a propriedade binária produzida pelo download. Não interpolar o binário em expressão JSON. Codificar somente os headers textuais indicados; não registrar URL de origem, token, binário ou resposta financeira completa.

Resposta aceita para prosseguir à área de revisão:

```text
HTTP 200
schemaVersion === "financial-extraction.v1"
status === "needs_review"
publishable === false
```

Qualquer `200` que não satisfaça as três invariantes deve falhar fechado. A resposta carrega metadados, fatos, movimentações, warnings, conciliações e chaves lógicas idempotentes; ela não autoriza publicação. Registrar apenas IDs de correlação, status, duração e versão do contrato. O header `X-Request-Id` deve acompanhar o erro técnico restrito.

### Tratamento por status

| HTTP | Ação do n8n | Retry automático |
| --- | --- | --- |
| `401 unauthorized` | interromper, alertar falha de credencial e conferir rotação/configuração | não |
| `413 file_too_large` | marcar como não processável, registrar tamanho/metadados seguros e encaminhar para tratamento manual | não |
| `422 invalid_xlsx` ou erro de mapeamento | manter arquivo original, registrar código e encaminhar para revisão/correção | não |
| `429 worker_busy` | aguardar com backoff e jitter; não reenviar em paralelo | no máximo 3 tentativas: 5 s, 15 s e 30 s |
| `500` | registrar `X-Request-Id`, falhar de forma segura e investigar saúde/memória | no máximo 1, somente após confirmar idempotência |
| `504 parse_timeout` | registrar timeout e revisar tamanho/complexidade/recursos | não por padrão; uma repetição somente manual e controlada |

Não usar retry genérico do nó para todos os códigos. Um timeout do cliente pode ocorrer depois de o worker terminar, então a ausência de resposta não prova que nada foi processado.

## Memória, payload, timeout e duplicação

- O limite de upload é 25 MiB comprimidos, mas um XLSX pode expandir muito mais em memória.
- n8n pode manter uma cópia do binário, o processo principal do worker recebe o corpo em memória e o subprocesso do parser usa heap de até 256 MiB. O limite de 384 MiB do container cobre o conjunto e pode causar OOM em arquivos extremos.
- `/tmp` tem 64 MiB; comporta um arquivo no limite com folga restrita, não múltiplos jobs. A concorrência permanece em 1.
- Antes do piloto, confirmar o modo de armazenamento binário e a retenção das execuções do n8n. Não mudar essas opções nesta etapa.
- Medir pico de RAM/CPU e duração no piloto. Não aumentar limites sem conferir folga da VPS e não reduzir o timeout do n8n abaixo do worker.
- O worker é stateless e não deduplica requisições. A idempotência deve ser reservada no orquestrador/persistência antes da chamada usando a identidade estável do documento (origem/ID externo ou documento, ETag/checksum, mapeamento e versão). As chaves lógicas da resposta impedem duplicação dos fatos na etapa de staging.
- Uma repetição deve reutilizar a mesma identidade e atualizar/retomar o mesmo job, nunca criar publicação paralela. O contrato de persistência real precisa ser confirmado no workflow antes de habilitar retries.

Em todos os caminhos, preservar `status: needs_review`, revisão humana obrigatória e `publishable: false`. Nenhum resultado do piloto pode alimentar métricas publicadas.

## Procedimento futuro, somente após autorização

### 1. Diagnóstico somente leitura

Executar o inventário abaixo sem exibir variáveis de ambiente ou arquivos de segredo:

```bash
docker version
docker compose version
docker info
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Status}}\t{{.Networks}}'
docker inspect <executor-n8n> --format '{{json .NetworkSettings.Networks}}'
docker network inspect <rede-confirmada>
docker stats --no-stream
df -h
```

Revisar o Compose do n8n com os valores sensíveis ocultos. Não executar `docker inspect` completo, `docker compose config` sem redirecionamento seguro, `env`, `printenv` ou qualquer comando que revele credenciais.

### 2. Validação da configuração preparada

Depois de criar o arquivo de segredo fora do repositório e definir localmente apenas o nome da rede e o caminho do arquivo:

```bash
docker compose -f workers/financial-xlsx/docker-compose.hostinger.example.yml config --quiet
```

Revisar a saída sanitizada se for necessário usar `config`; não armazená-la porque versões do Compose podem materializar caminhos ou outros valores. Build, `up`, conexão de rede e criação da credencial n8n exigem nova autorização.

### 3. Healthcheck

Após um deploy autorizado, primeiro conferir o healthcheck do container. Depois testar a partir de cada container que possa executar o nó HTTP:

```bash
docker exec <executor-n8n> node -e "fetch('http://financial-xlsx-worker:8787/health').then(async r => { console.log(r.status, await r.json()); process.exit(r.ok ? 0 : 1) }).catch(() => process.exit(1))"
```

Aceitar somente `200`, `status: "ok"`, `activeJobs: 0` e `maxConcurrency: 1`. Confirmar também que não existe binding da porta 8787 no host.

### 4. Piloto de um arquivo

1. Não editar os workflows 03 ou 04. Preparar, mediante autorização, uma execução manual isolada/cópia desativada que use a mesma propriedade binária e credencial.
2. Usar um único XLSX autorizado, já conhecido e dentro do limite; não executar lote.
3. Reservar a identidade idempotente antes da chamada e impedir qualquer ramo de publicação.
4. Validar HTTP 200, schema, ETag/checksum, documento, competência, warnings, conciliações, `needs_review` e `publishable: false`.
5. Repetir deliberadamente a mesma identidade apenas no ambiente de piloto e confirmar que não surge um segundo conjunto persistido.
6. Conferir duração, pico de memória/CPU, limpeza de `/tmp` e logs sem nomes, conteúdo ou valores financeiros.
7. Submeter o resultado à revisão humana e encerrar sem publicar.

### 5. Rollback

Como o worker não persiste dados, parar e remover somente seu serviço:

```bash
docker compose -f workers/financial-xlsx/docker-compose.hostinger.example.yml stop financial-xlsx-worker
docker compose -f workers/financial-xlsx/docker-compose.hostinger.example.yml rm -f financial-xlsx-worker
```

Não remover a rede externa, não alterar o n8n e não apagar o arquivo original. Revogar/remover a credencial do piloto após confirmar que nenhum fluxo a utiliza. Se houver uma imagem anterior aprovada, restaurar a tag e recriar somente o worker.

## Informações exatas necessárias da VPS antes da instalação

Não enviar valores de secrets, tokens, `.env`, conteúdo financeiro ou exports de credenciais. Precisamos apenas de:

1. sistema operacional, arquitetura, Docker Engine, Compose v2 e indicação de Docker rootless ou Swarm;
2. método atual de implantação do n8n, diretório/projeto Compose e imagem/versão exata;
3. nomes dos containers/serviços e qual deles executa nós em produção;
4. modo de execução do n8n: regular ou queue mode, quantidade de workers/replicas e uso de Redis;
5. nomes das redes ligadas a cada executor n8n e, para a rede candidata: driver, scope, `Internal`, `Attachable`, sub-rede e containers participantes;
6. confirmação de que o alias `financial-xlsx-worker` está livre nessa rede;
7. configuração atual de armazenamento de binários do n8n, diretório/volume correspondente e limites de payload;
8. timeout global de execução, timeout do HTTP Request, concorrência e política atual de retries do n8n;
9. política de retenção/pruning de execuções e se o workflow salva binário e resposta em sucesso/erro;
10. nome/ID confirmado do workflow `04 - KAWANA - Financial Data Extraction`, mantendo-o inalterado;
11. nome da propriedade binária entregue pelo nó de download e tamanho máximo/percentis dos XLSX esperados, sem fornecer os arquivos;
12. origem autorizada de empresa, documento, ETag/checksum, competência e IDs usados nos headers;
13. mecanismo idempotente atual do workflow/job e comportamento real diante de reexecução, sem inventar tabela ou coluna;
14. CPU, RAM, swap e disco livres, consumo atual dos containers e limites já aplicados ao n8n;
15. driver e retenção de logs do Docker, além do monitoramento disponível para OOM, reinício e healthcheck;
16. caminho administrativo aprovado para os arquivos do worker e para o arquivo de segredo, com owner/UID/GID e permissões, sem fornecer o conteúdo;
17. disponibilidade de DNS entre containers e acesso da VPS ao registry/npm para build, ou preferência por imagem construída e transferida por pipeline confiável;
18. política de backup/rollback, janela de manutenção e pessoa responsável por autorizar instalação, piloto e eventual rotação da credencial;
19. arquitetura da VPS e digest aprovado da imagem base Node/imagem final para que o build seja reproduzível.

Sem essas respostas, especialmente executor real, rede, modo binário, recursos e idempotência, a instalação permanece bloqueada.
