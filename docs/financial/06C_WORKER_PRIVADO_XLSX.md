# Etapa 06C — worker privado XLSX

## Escopo

O worker recebe um XLSX bruto por HTTP, valida autenticação e metadados, grava um arquivo temporário privado, executa o adaptador em subprocesso com limite de memória e remove o temporário antes de responder.

Ele não acessa Supabase, não aprova valores, não publica métricas e não altera workflows n8n. O `company_id` recebido é somente contexto não confiável. A resposta adiciona o warning `company_context_unverified`.

## Endpoints

### `GET /health`

Healthcheck sem dados financeiros. Deve ser acessível somente pela rede interna.

```json
{
  "status": "ok",
  "service": "financial-xlsx-worker",
  "activeJobs": 0,
  "maxConcurrency": 1
}
```

### `POST /v1/extractions/xlsx`

O corpo da requisição é o binário XLSX, sem multipart e sem base64.

Headers obrigatórios:

```text
Authorization: Bearer <FINANCIAL_XLSX_WORKER_SECRET>
Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet
X-Financial-Mapping-Id: kawana-management-report
X-Financial-Mapping-Version: 1
X-Financial-Company-Name: <texto codificado com encodeURIComponent>
X-Financial-Document-Name: <texto codificado com encodeURIComponent>
X-Financial-Document-Etag: <etag ou checksum da origem>
```

Headers opcionais:

```text
X-Financial-Company-Id
X-Financial-Document-Id
X-Financial-External-File-Id
X-Financial-Period-Month: AAAA-MM
```

O worker não confia no `company_id`. O serviço autorizado que criar o job deverá validar que documento, empresa e usuário pertencem ao mesmo escopo antes da futura chamada.

Resposta `200`:

- contrato `financial-extraction.v1`;
- `status: needs_review`;
- `publishable: false`;
- metadata, fatos, movimentações, warnings, conciliações e chaves idempotentes preservados.

Erros principais:

| Status | Código | Situação |
| --- | --- | --- |
| 400 | `invalid_metadata` | Header ausente, duplicado ou inválido |
| 401 | `unauthorized` | Bearer token ausente ou incorreto |
| 413 | `file_too_large` | Corpo acima de 25 MiB |
| 415 | `invalid_mime_type` | Content-Type diferente de XLSX |
| 422 | `invalid_xlsx` | Binário ou estrutura XLSX inválida |
| 422 | `unsupported_mapping` | ID ou versão sem parser registrado |
| 429 | `worker_busy` | Já existe um processamento ativo |
| 504 | `parse_timeout` | Parser excedeu o timeout |

Todas as respostas possuem `X-Request-Id`. Erros inesperados retornam mensagem genérica.

## Execução local

PowerShell:

```powershell
$env:FINANCIAL_XLSX_WORKER_SECRET = "substitua-por-um-segredo-aleatorio-de-32-bytes"
npm run financial:worker
```

Chamada local genérica:

```powershell
curl.exe -X POST "http://127.0.0.1:8787/v1/extractions/xlsx" `
  -H "Authorization: Bearer $env:FINANCIAL_XLSX_WORKER_SECRET" `
  -H "Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" `
  -H "X-Financial-Mapping-Id: kawana-management-report" `
  -H "X-Financial-Mapping-Version: 1" `
  -H "X-Financial-Company-Name: Empresa%20Teste" `
  -H "X-Financial-Document-Name: relatorio.xlsx" `
  -H "X-Financial-Document-Etag: checksum-da-origem" `
  -H "X-Financial-Period-Month: 2026-09" `
  --data-binary "@.local/financial/relatorio.xlsx"
```

Não reutilizar o valor ilustrativo do segredo. Não incluir o token, URL de download ou resposta financeira em logs.

## Isolamento aplicado

- autenticação Bearer com comparação em tempo constante;
- segredo mínimo de 32 bytes;
- limite comprimido de 25 MiB;
- timeout padrão de 30 segundos;
- subprocesso com heap máximo padrão de 256 MiB;
- concorrência inicial igual a 1;
- headers e request timeout limitados;
- arquivo temporário com permissões restritas;
- remoção do diretório temporário antes da resposta;
- logs somente com request ID, método, caminho, status e duração;
- resposta sempre bloqueada para revisão;
- Docker sem porta publicada, usuário não root, filesystem somente leitura, `/tmp` em tmpfs, capabilities removidas e limites de CPU, memória e processos.

O limite de heap e o timeout protegem o processo principal contra XLSX malformado ou expansão excessiva. Se o subprocesso exceder memória, somente ele é encerrado. Em reinício do container, o tmpfs elimina qualquer temporário residual.

## Pacote Docker isolado

O pacote em `workers/financial-xlsx` instala apenas:

- `exceljs@4.4.0`;
- `tsx@4.23.15`.

Ele não inclui Astro, Supabase, ApexCharts ou Sass. O Compose de exemplo usa uma rede `internal: true` e apenas `expose`, sem `ports`.

## Auditoria de dependências

### Dashboard completo

`npm audit --omit=dev` reporta 12 pacotes afetados: 1 crítico, 9 altos e 2 moderados. Portanto, os alertas estão no grafo instalado em produção, não apenas em ferramentas de desenvolvimento.

- O alerta crítico é da versão atual do Astro.
- Os alertas altos de `devalue`, `http-cache-semantics`, `js-yaml`, `nanoid`, `postcss`, `sharp`, `smol-toml`, `source-map-js` e `svgo` entram pelo Astro e suas dependências.
- Preparar atualização isolada do Astro 7.0.5 para a versão 7.4.x compatível, seguida de testes de autenticação, rotas, renderização e build. Essa atualização não foi executada na Etapa 06C.

### Worker isolado

`npm audit --omit=dev` no pacote do worker reporta somente 2 alertas moderados: `exceljs` e seu `uuid@8.3.2` transitivo. Não há alerta crítico ou alto no pacote do worker.

O audit sugere downgrade incompatível do ExcelJS. Não aplicar. O parser não chama diretamente as APIs UUID afetadas. As mitigações atuais são rede privada, autenticação, limite de tamanho, concorrência 1, subprocesso limitado e ausência de escrita em banco. Acompanhar correção upstream ou testar uma substituição/override somente em branch isolada.

Não foi executado `npm audit fix`, `npm audit fix --force`, override ou atualização grande.

## Instalação futura na Hostinger

Antes de qualquer instalação:

1. confirmar se n8n utiliza Docker Compose, container único ou instalação direta;
2. confirmar o nome e o ID reais do workflow `04 - KAWANA - Financial Data Extraction` na instância;
3. identificar a rede Docker privada usada pelo n8n;
4. gerar um segredo aleatório de pelo menos 32 bytes e armazená-lo fora do Git;
5. revisar limites disponíveis de CPU e memória na VPS.

Após aprovação:

1. copiar o código para o servidor;
2. adaptar `docker-compose.example.yml` à rede privada existente;
3. executar `docker compose build` e `docker compose up -d financial-xlsx-worker`;
4. confirmar o healthcheck a partir do container n8n, nunca por uma porta pública;
5. executar um único documento piloto e comparar o contrato com o dry run local;
6. somente depois preparar uma cópia de teste do workflow financeiro.

O workflow 03 e o workflow financeiro de produção permanecem inalterados nesta etapa.
