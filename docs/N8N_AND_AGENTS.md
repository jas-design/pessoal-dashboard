# n8n e agentes

## Papel do n8n

n8n é o orquestrador principal.

Ele deve:

- receber requests autenticadas;
- sincronizar dados;
- chamar Microsoft Graph;
- processar documentos;
- chamar modelos de IA;
- executar regras;
- atualizar jobs;
- solicitar aprovação;
- registrar auditoria.

## Workflows iniciais

```text
01-microsoft-auth-healthcheck
02-onedrive-file-sync
03-document-extraction-indexing
04-outlook-email-ingestion
05-financial-data-extraction
06-document-comparison
07-secretary-agent-router
08-human-approval-executor
```

## Agente roteador

O agente pode selecionar somente ferramentas explicitamente permitidas:

- `search_documents`
- `get_document`
- `compare_documents`
- `list_financial_alerts`
- `compare_financial_periods`
- `get_email_summary`
- `draft_email_reply`
- `create_approval_request`

Ferramentas destrutivas não ficam diretamente disponíveis.

## Regras financeiras

Comparações objetivas devem ser implementadas com código ou SQL:

- duplicidade;
- diferença de total;
- documento sem pagamento;
- pagamento sem documento;
- valor fora da tolerância;
- datas incoerentes;
- diferença entre períodos;
- fornecedor fora do padrão.

A IA explica os resultados.

## Webhooks

- usar URL privada;
- validar segredo ou assinatura;
- incluir `request_id`;
- rejeitar replay quando aplicável;
- validar payload;
- não aceitar `user_id` como autoridade;
- registrar erro sem revelar segredo.

## Idempotência

Sincronizações devem usar:

- `external_id`;
- `checksum`;
- `source_modified_at`;
- chaves únicas quando apropriado.

Reexecutar workflow não deve duplicar arquivos ou transações.

## Tratamento de falha

- atualizar job para `failed`;
- salvar mensagem segura;
- guardar detalhes técnicos em log restrito;
- definir retry;
- evitar loops infinitos;
- manter rastreabilidade.
