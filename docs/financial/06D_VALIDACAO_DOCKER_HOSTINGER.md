# Etapa 06D — validação Docker e preparação para Hostinger

## Resultado local

A imagem `fabio-financial-xlsx-worker:06d-local` foi construída e executada no Docker Desktop com engine Linux. A validação usou somente segredo fictício, rede Docker interna e arquivos em `.local/`, que permanece ignorado pelo Git.

Configuração verificada no container:

- usuário `node`, sem execução como root;
- nenhum `ports` ou binding no host; apenas `expose: 8787` na rede interna;
- filesystem raiz somente leitura;
- `/tmp` em `tmpfs` de 64 MiB com `noexec`, `nosuid` e `nodev`;
- limite de 384 MiB de memória, 0,75 CPU e 64 processos;
- todas as capabilities removidas e `no-new-privileges` habilitado;
- concorrência máxima igual a 1;
- subprocesso do parser limitado a 256 MiB de heap;
- timeout de processamento de 30 segundos;
- healthcheck interno ativo.

O contexto enviado ao build é limitado por `.dockerignore`. A imagem contém somente o pacote Node isolado, as dependências instaladas, o parser, o adaptador, os mapeamentos e os arquivos do worker. Arquivos `.local`, documentação, testes, Git, variáveis de ambiente e o restante do dashboard não entram no contexto do Docker.

## Testes no container

| Cenário | Resultado |
| --- | --- |
| `GET /health` | `200`, serviço saudável, `maxConcurrency: 1` |
| XLSX sintético | `200`, `financial-extraction.v1`, `needs_review`, `publishable: false` |
| XLSX real local | `200`, 12 abas e 612 fatos, sem publicar valores |
| Bearer inválido | `401 unauthorized` |
| XLSX corrompido | `422 invalid_xlsx` |
| Arquivo acima de 25 MiB | `413 file_too_large` |
| Segundo processamento simultâneo | `429 worker_busy` |
| Timeout forçado | `504 parse_timeout` |
| Limpeza de temporários | nenhum arquivo de job permaneceu após sucesso ou erro |

O primeiro teste do arquivo real expôs uma falha no subprocesso: a resposta IPC era enviada e o canal era desconectado sem aguardar o callback de conclusão. Respostas pequenas passavam, mas a resposta real expirava. `parse-child.ts` agora aguarda o envio antes de desconectar, e um teste de regressão cobre respostas maiores. Depois da correção, o arquivo real concluiu dentro do timeout original.

Os logs inspecionados contêm somente evento do serviço, request ID, método, rota, status e duração. Não foram encontrados conteúdo financeiro, nomes de documentos, metadados de empresa, URLs, segredo ou corpo de resposta.

As respostas completas do teste local foram mantidas apenas em `.local/docker-validation/`. Nenhum valor financeiro é reproduzido neste documento.

## Contrato para o n8n

O alvo futuro é o workflow `04 - KAWANA - Financial Data Extraction`. Ele não foi alterado nesta etapa.

O nó HTTP Request deverá chamar, pela rede Docker privada:

```text
POST http://<nome-dns-interno-do-worker>:8787/v1/extractions/xlsx
Authorization: Bearer <segredo armazenado como credencial do n8n>
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
X-Financial-Mapping-Id: kawana-management-report
X-Financial-Mapping-Version: 1
X-Financial-Company-Name: <encodeURIComponent(nome)>
X-Financial-Document-Name: <encodeURIComponent(nome do arquivo)>
X-Financial-Document-Etag: <etag ou checksum da origem>
X-Financial-Company-Id: <contexto ainda não confiável, opcional>
X-Financial-Document-Id: <id do documento, opcional>
X-Financial-External-File-Id: <id externo, opcional>
X-Financial-Period-Month: AAAA-MM

Body: binário XLSX bruto, sem multipart e sem base64
```

No n8n, o HTTP Request deve habilitar envio de binário e apontar para a propriedade binária produzida pelo download anterior. A resposta é JSON `financial-extraction.v1`. O fluxo posterior deve continuar exigindo `status === "needs_review"` e `publishable === false`; o worker não valida a autorização do `company_id` e não pode publicar ou aprovar dados.

O segredo deve ficar em credencial/variável protegida do n8n e do container, nunca no workflow exportado ou nos logs. O nó deve evitar salvar binário e resposta financeira em execuções de produção além do período necessário para revisão.

## Dependências e vulnerabilidades

O pacote isolado do worker possui duas dependências diretas: `exceljs@4.4.0` e `tsx@4.23.15`. A imagem usa `node:22-bookworm-slim` fixada pelo digest resolvido no build.

`npm audit --omit=dev` reportou 2 vulnerabilidades moderadas e nenhuma alta ou crítica:

- `uuid@8.3.2`, transitiva de `exceljs`, possui o advisory `GHSA-w5hq-g745-h8pq` sobre falta de verificação de limites nas APIs UUID v3/v5/v6 quando recebem buffer;
- `exceljs` aparece como afetado por depender dessa versão de `uuid`.

O parser não chama as APIs UUID v3/v5/v6; no ExcelJS encontrado, UUID é usado internamente como v4 em transformação de formatação condicional. O risco residual permanece moderado porque arquivos XLSX são entrada não confiável e a dependência ainda está no grafo. As mitigações são autenticação privada, rede interna, limite de 25 MiB, concorrência 1, subprocesso com heap limitado, timeout, filesystem somente leitura, tmpfs e ausência de escrita no banco.

O `npm audit` propõe downgrade do ExcelJS para 3.4.0 como correção incompatível. Não aplicar: ele pode introduzir regressões e não é uma atualização segura. Antes do deploy, consultar uma correção upstream ou validar em branch isolada um override de `uuid` compatível, com toda a suíte e o XLSX real. Não foi executado `npm audit fix --force`.

## Plano de instalação futura na VPS

Pré-requisitos:

- Docker Engine Linux com Compose v2;
- acesso SSH administrativo à VPS;
- ao menos 384 MiB de memória e 0,75 CPU disponíveis para o worker, além dos recursos do n8n;
- código do worker disponível em diretório privado;
- segredo aleatório com pelo menos 32 bytes, armazenado fora do Git;
- nome real do container/serviço n8n e sua rede Docker identificados antes de qualquer alteração.

Inventário somente leitura na VPS:

```bash
docker version
docker compose version
docker ps --format 'table {{.Names}}\t{{.Image}}\t{{.Networks}}'
docker inspect <container-n8n> --format '{{json .NetworkSettings.Networks}}'
docker network inspect <rede-confirmada-do-n8n>
```

Preparação do segredo e validação do Compose, após autorização:

```bash
install -d -m 700 /opt/fabio-financial-worker
cd /opt/fabio-financial-worker
umask 077
openssl rand -base64 48 > .worker-secret
export FINANCIAL_XLSX_WORKER_SECRET="$(cat .worker-secret)"
docker compose -f workers/financial-xlsx/docker-compose.example.yml config --quiet
```

O Compose de instalação deverá declarar a rede confirmada como `external: true`, sem inventar ou recriar a rede do n8n. Não adicionar `ports`. Exemplo de adaptação conceitual:

```yaml
services:
  financial-xlsx-worker:
    networks:
      - n8n_private

networks:
  n8n_private:
    external: true
    name: <rede-confirmada-do-n8n>
```

Build e inicialização futuros, somente após revisão e autorização:

```bash
docker compose -f <compose-aprovado>.yml build --pull financial-xlsx-worker
docker compose -f <compose-aprovado>.yml up -d financial-xlsx-worker
docker compose -f <compose-aprovado>.yml ps
docker compose -f <compose-aprovado>.yml logs --tail 50 financial-xlsx-worker
```

Healthcheck a partir do container n8n, sem porta pública:

```bash
docker exec <container-n8n> node -e "fetch('http://<servico-worker>:8787/health').then(async r => { console.log(r.status, await r.json()); process.exit(r.ok ? 0 : 1) })"
```

Antes de conectar o workflow, executar um único XLSX sintético e depois um único documento piloto real. Comparar schema, ETag, documento, competência, rastreabilidade, warnings, idempotência e bloqueio de publicação. Não processar documentos em massa até aprovação explícita.

## Rollback da futura instalação

O worker é isolado e ainda não possui persistência. O rollback não requer alterações no Supabase ou nos workflows:

```bash
docker compose -f <compose-aprovado>.yml stop financial-xlsx-worker
docker compose -f <compose-aprovado>.yml rm -f financial-xlsx-worker
```

Se uma tag anterior aprovada existir, restaurar essa tag no Compose e recriar somente o serviço. Não remover nem recriar a rede compartilhada do n8n.
