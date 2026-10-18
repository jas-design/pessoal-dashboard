# Etapa 06B — preparação da integração do parser XLSX com n8n

## Estado desta etapa

O adaptador está disponível somente para execução local ou em Node.js no servidor. Ele não chama Supabase, não publica dados, não baixa arquivos, não expõe endpoint HTTP e não modifica workflows n8n.

O contrato continua `financial-extraction.v1`. O adaptador adiciona ao metadata a identificação do mapeamento usado e mantém sempre `status: needs_review` e `publishable: false` nesta fase.

## Contrato de entrada Node.js

```ts
type FinancialXlsxExtractionRequest = {
  binary: Buffer | Uint8Array | ArrayBuffer;
  mimeType?: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
  mapping: {
    id: string;
    version: string;
  };
  company: {
    id: string | null;
    name: string;
  };
  document: {
    id: string | null;
    fileName: string;
    externalFileId?: string | null;
    etag: string;
  };
  periodMonth?: string;
  extractedAt?: string;
  maxFileSize?: number;
};
```

O adaptador não determina empresa, nome do arquivo ou competência. Esses campos devem vir do job autenticado e autorizado. Quando `periodMonth` não for informado, o mapeamento pode detectá-lo no documento.

Validações antes do parsing:

- binário presente e não vazio;
- assinatura ZIP compatível com XLSX;
- MIME type XLSX, quando informado;
- limite padrão de 25 MiB;
- empresa, nome do arquivo e ETag presentes;
- competência no formato `AAAA-MM`, quando informada;
- combinação exata de ID e versão do mapeamento.

## Mapeamentos versionados

O registro atual contém:

```text
kawana-management-report@1 -> parser 06A.1
```

Um novo formato deve receber novo ID. Uma mudança incompatível no layout existente deve receber nova versão. O adaptador não possui regras de células, empresa ou competência; ele apenas valida a entrada e seleciona o mapeamento.

## Contrato de saída

Além dos campos já definidos em `financial-extraction.v1`, o metadata inclui:

```json
{
  "mapping": {
    "id": "kawana-management-report",
    "version": "1",
    "parserVersion": "06A.1"
  }
}
```

Continuam preservados:

- empresa e documento;
- ETag e identificador externo;
- competência e moeda;
- valores em decimal e centavos;
- aba, endereço da célula, fórmula e valor original;
- chave lógica idempotente;
- warnings, conciliações e estatísticas;
- transações bancárias em trilha separada.

Erros de fórmula, conciliações indisponíveis ou divergentes e escopo ambíguo continuam bloqueados para revisão. O adaptador não possui operação de aprovação ou publicação.

## Opções de execução na VPS

| Opção | Vantagens | Riscos e custo operacional | Avaliação |
| --- | --- | --- | --- |
| Serviço Node.js privado | API simples e processo separado do n8n | Exige autenticação interna, timeout, supervisão e uma porta privada | Viável |
| Processo iniciado pelo n8n | Menos componentes e nenhuma API adicional | Pode bloquear ou derrubar o processo do n8n; argumentos e caminhos exigem proteção rigorosa; módulos externos podem não estar disponíveis | Apenas piloto controlado |
| Worker isolado | Limita memória, CPU, concorrência e impacto de XLSX malformado; permite fila e retry | Exige um container ou processo adicional | Recomendado |

### Recomendação

Executar um único worker Node.js em container separado na mesma VPS e na rede interna do n8n. Para o volume inicial, concorrência igual a 1 mantém o custo baixo. O worker recebe o binário e os metadados já autorizados, executa o adaptador e devolve o JSON. Não deve possuir porta pública, service role ou acesso direto às tabelas consolidadas.

O n8n continuará responsável pelo job, retry e auditoria. O worker será responsável apenas por validação e parsing. A futura chamada deve usar autenticação de serviço, limite de payload, timeout, `request_id` e logs sem valores financeiros, binário, URL assinada ou credenciais.

Evitar o Code node para carregar `exceljs` ou processar arquivos grandes dentro do processo principal do n8n. Evitar também interpolar nome de arquivo ou metadados em comandos shell.

## Dependências da VPS

- Node.js `>=22.12.0`, conforme `package.json`;
- dependências instaladas por lockfile com `npm ci`;
- `exceljs@4.4.0` para leitura do XLSX;
- `tsx` somente para execução direta dos fontes TypeScript no piloto e nos testes;
- limite de memória e timeout no processo/container;
- diretório temporário privado, quando necessário, com remoção após o job.

Uma imagem de produção futura pode compilar ou empacotar o worker na etapa de build e instalar somente dependências de runtime. Essa preparação não foi adicionada nesta etapa porque o endpoint e o método de implantação ainda não foram autorizados.

## Análise do npm audit

O audit atual reporta 12 pacotes afetados: 1 crítico, 9 altos e 2 moderados.

- `astro` é dependência direta e concentra o alerta crítico. A versão instalada é 7.0.5 e a versão compatível mais recente detectada é 7.4.0. Preparar uma atualização isolada para 7.4.0, seguida de build e regressão das rotas, é a primeira correção recomendada.
- Os alertas altos de `devalue`, `http-cache-semantics`, `js-yaml`, `nanoid`, `postcss`, `sharp`, `smol-toml`, `source-map-js` e `svgo` entram pelo grafo atual do Astro. Reexecutar o audit depois da atualização do Astro para confirmar o que foi eliminado.
- `exceljs@4.4.0` traz `uuid@8.3.2`, marcado como moderado. O próprio audit propõe downgrade incompatível do ExcelJS para 3.4.0, portanto essa correção não deve ser aplicada. O parser não chama as APIs UUID afetadas diretamente. Manter isolamento, limite de arquivo e acompanhar correção upstream.
- Um override para UUID 11 deve ser avaliado somente em branch isolada com todos os testes do parser, pois rompe a faixa declarada pelo ExcelJS.

Não foi executado `npm audit fix`, `npm audit fix --force` ou atualização de dependências nesta etapa.

## Segurança e operação futura

- O binário deve vir de uma origem privada já autorizada pelo job.
- URLs assinadas, tokens e conteúdo do arquivo não podem aparecer em logs.
- O worker deve rejeitar payload sem ETag, empresa ou mapeamento.
- A chave lógica de cada fato deve ser usada para idempotência no staging futuro.
- O resultado deve chegar primeiro a staging e revisão humana.
- O worker não deve receber `SUPABASE_SERVICE_ROLE_KEY` enquanto não existir necessidade aprovada.
- Arquivos reais e resultados locais permanecem em `.local/`, ignorado pelo Git.

## Pendência de numeração do workflow

O nome operacional informado para a instância KAWANA é `04 - KAWANA - Financial Data Extraction`. A documentação genérica do repositório ainda identifica o workflow 04 como ingestão de e-mail e o 05 como extração financeira. Antes da integração, confirmar o nome e o ID diretamente na instância Hostinger. Nenhum workflow foi alterado.
