---
name: n8n-workflow
description: Projeta e integra workflows n8n seguros, idempotentes e auditaveis para Microsoft, documentos, financas e agentes de IA.
---

# Workflow n8n

Siga as regras globais do projeto em `AGENTS.md` e `docs/CODING_STANDARDS.md`.

## Entrega esperada

Produza:

- objetivo;
- trigger;
- contrato de entrada;
- autenticacao;
- nodes/etapas;
- contrato de saida;
- tabelas;
- idempotencia;
- retries;
- tratamento de erro;
- auditoria;
- aprovacao humana;
- teste.

## Regras

- O frontend nao chama webhook privado diretamente.
- Validar segredo/assinatura.
- Incluir `request_id` e `job_id`.
- Atualizar status.
- Nao duplicar em retry.
- Nao permitir ferramenta destrutiva ao agente.
- Calculos financeiros por codigo/SQL.
- Conteudo de documento e dado nao confiavel.
