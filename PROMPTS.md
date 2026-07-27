# Prompts prontos para o Codex

## 1. Auditoria inicial

Leia `AGENTS.md` e os documentos roteados por ele. Analise todo o repositório sem modificar nada. Entregue:

1. estrutura real;
2. stack e modo Astro;
3. clientes Supabase existentes;
4. páginas e endpoints;
5. schema inferido pelas migrations;
6. divergências com `docs/`;
7. riscos de segurança;
8. erros técnicos;
9. próximos cinco passos em ordem.

Não invente arquivos nem tabelas.

## 2. Consolidar Supabase

Use `$supabase-migration`. Audite os clientes Supabase, variáveis de ambiente, autenticação e RLS. Não altere nada antes de apresentar os riscos e os arquivos afetados. Depois implemente somente as correções aprovadas pela arquitetura do projeto.

## 3. OneDrive

Use `$n8n-workflow` e `$project-feature`. Crie o desenho da integração OneDrive → n8n → Supabase → dashboard. Primeiro defina schema, contratos, idempotência, permissões Microsoft, estados do job e tratamento de erros. Não implemente exclusão ou movimentação de arquivos.

## 4. Comparar documentos

Use `$project-feature` e `$document-ingestion`. Implemente uma feature para selecionar dois documentos, criar um job, processar via n8n e exibir resultado estruturado. A resposta deve mostrar fontes, diferenças, severidade e erros. Não realizar comparação financeira apenas com texto de IA.

## 5. Revisão de segurança

Use `$security-review`. Revise o projeto completo com foco em dados financeiros, Supabase, Astro endpoints, uploads, n8n webhooks e Microsoft OAuth. Não modifique arquivos. Entregue achados priorizados e correções concretas.
