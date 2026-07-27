# AGENTS.md — Dashboard Executivo com IA

## Objetivo do projeto

Construir um dashboard privado para um único cliente, hospedado na Hostinger, que centralize documentos, e-mails, dados financeiros, análises e agentes de IA.

Stack principal:

- Astro + TypeScript + SCSS no frontend e backend web.
- Supabase para autenticação, PostgreSQL, RLS, Storage, Realtime e auditoria.
- n8n self-hosted na Hostinger para integrações, automações e agentes.
- Microsoft Graph para OneDrive e Outlook.
- API de IA para classificação, extração, RAG, explicação e geração.
- OpenClaw não faz parte do MVP atual.

Leia primeiro:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SECURITY.md`
4. O documento específico da tarefa.

## Regras obrigatórias

- Não exponha chaves, secrets, service role, tokens ou credenciais no frontend.
- Variáveis Astro com prefixo `PUBLIC_` são públicas. Nunca use esse prefixo para secrets.
- O navegador não chama webhooks privados do n8n diretamente.
- Chamadas sensíveis seguem: frontend → endpoint server-side Astro → n8n/Supabase.
- Use Supabase Auth e RLS. Não contorne RLS no navegador.
- `SUPABASE_SERVICE_ROLE_KEY` somente no servidor e apenas quando necessária.
- A IA não realiza cálculos financeiros críticos sozinha. Use SQL ou TypeScript para cálculos e IA para explicação.
- A IA não envia e-mails, exclui/move arquivos ou altera registros financeiros sem aprovação explícita.
- Toda análise deve registrar usuário, origem, documentos, status, resultado e timestamps.
- Preserve a arquitetura e os padrões existentes antes de criar novas abstrações.
- Prefira soluções simples, modulares e fáceis de manter.
- Não introduza OpenClaw, LangChain, CrewAI ou outro framework sem justificativa técnica aprovada.
- Não modifique migrations ou contratos de API silenciosamente.
- Nunca invente nomes de tabelas, colunas ou endpoints. Inspecione o código e as migrations.
- Ao encontrar divergência entre documentação e código, trate o código/migration atual como fonte operacional e informe a divergência.

## Processo de trabalho

Antes de editar:

1. Inspecione os arquivos relacionados.
2. Explique resumidamente o impacto.
3. Liste os arquivos que pretende alterar.
4. Preserve compatibilidade com o código atual.

Depois de editar:

1. Rode verificações disponíveis.
2. Informe o que mudou.
3. Informe testes executados e limitações.
4. Atualize documentação quando alterar arquitetura, schema, segurança ou contrato de integração.

## Comandos esperados

Confirme os scripts em `package.json` antes de executar.

Comandos comuns:

```bash
npm install
npm run dev
npm run build
npm run check
npm run lint
```

Não assuma que todos existem.

## Definição de concluído

Uma tarefa só está concluída quando:

- compila;
- não expõe secrets;
- valida entrada;
- trata erro;
- respeita autenticação e autorização;
- possui estado de loading/erro quando houver UI;
- mantém logs/auditoria quando necessário;
- documentação relevante foi atualizada;
- alterações foram resumidas claramente.

## Roteamento por área

- Astro e UI: `docs/CODING_STANDARDS.md`
- Supabase: `docs/DATABASE.md`
- n8n e agentes: `docs/N8N_AND_AGENTS.md`
- Segurança: `docs/SECURITY.md`
- Microsoft: `docs/MICROSOFT_INTEGRATION.md`
- Roadmap: `docs/ROADMAP.md`
- Decisões: `docs/DECISIONS.md`

## Skills disponíveis

Use as skills quando a tarefa corresponder:

- `project-feature`: implementar feature ponta a ponta.
- `supabase-migration`: alterar banco, migration ou RLS.
- `n8n-workflow`: projetar ou integrar workflow n8n.
- `security-review`: revisar segurança e exposição de dados.
- `bug-investigation`: investigar bug sem mudanças aleatórias.
- `document-ingestion`: implementar ingestão de PDF, DOCX ou XLSX.
