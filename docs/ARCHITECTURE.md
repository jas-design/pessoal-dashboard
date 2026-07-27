# Arquitetura

## Visão geral

```text
Browser
  |
  v
Astro Dashboard
  |-- páginas e componentes
  |-- endpoints server-side
  |-- validação de sessão
  |
  +--> Supabase
  |      |-- Auth
  |      |-- PostgreSQL
  |      |-- RLS
  |      |-- Storage
  |      |-- Realtime
  |
  +--> n8n na Hostinger
         |-- Microsoft Graph
         |-- OneDrive
         |-- Outlook
         |-- processamento
         |-- agentes
         |-- workflows
         |-- callbacks
```

## Responsabilidades

### Astro

- interface;
- autenticação de sessão;
- endpoints server-side;
- validação de payload;
- criação e consulta de jobs;
- apresentação de resultados;
- central de aprovações;
- não armazenar regras complexas de automação que pertencem ao n8n.

### Supabase

- Auth;
- dados de negócio;
- RLS;
- catálogo de documentos;
- transações financeiras;
- análises;
- histórico;
- aprovações;
- auditoria;
- embeddings e busca vetorial, quando implementados.

### n8n

- integração com Microsoft;
- sincronização;
- extração;
- transformação;
- roteamento de agentes;
- execução assíncrona;
- tratamento de falhas;
- atualização de status;
- ações aprovadas.

### IA

- classificar;
- resumir;
- extrair campos;
- selecionar ferramentas permitidas;
- explicar achados;
- responder com fontes.

A IA não deve ser a autoridade sobre:

- cálculos;
- permissões;
- exclusões;
- transferências;
- mudanças financeiras;
- autorização de acesso.

## Fluxo de job

```text
1. Usuário envia ação pelo dashboard.
2. Astro valida sessão e payload.
3. Astro cria `analysis_jobs`.
4. Astro chama webhook privado do n8n.
5. n8n processa e atualiza status.
6. Resultado é salvo no Supabase.
7. Dashboard recebe atualização ou consulta status.
8. Ações sensíveis viram `agent_approvals`.
```

Status padrão:

- `queued`
- `processing`
- `waiting_approval`
- `completed`
- `failed`
- `cancelled`

## Organização sugerida do Astro

Adapte à estrutura real:

```text
src/
  components/
  layouts/
  lib/
    supabase/
      client.ts
      server.ts
  pages/
    api/
      agents/
      documents/
      n8n/
    dashboard.astro
    documentos.astro
    financeiro.astro
    analises.astro
    aprovacoes.astro
  services/
  styles/
  types/
```

## Contratos entre sistemas

Todo payload interno deve incluir, quando aplicável:

- `request_id`
- `job_id`
- `user_id`
- `action`
- `created_at`
- dados específicos da ação

Nunca confie em `user_id` enviado pelo navegador. Derive-o da sessão autenticada no servidor.
