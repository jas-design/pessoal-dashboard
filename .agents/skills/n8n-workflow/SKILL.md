---
name: n8n-workflow
description: Projeta e integra workflows n8n seguros, idempotentes e auditáveis para Microsoft, documentos, finanças e agentes de IA.
---

# Workflow n8n

## Entrega esperada

Produza:

- objetivo;
- trigger;
- contrato de entrada;
- autenticação;
- nodes/etapas;
- contrato de saída;
- tabelas;
- idempotência;
- retries;
- tratamento de erro;
- auditoria;
- aprovação humana;
- teste.

## Regras

- O frontend não chama webhook privado diretamente.
- Validar segredo/assinatura.
- Incluir `request_id` e `job_id`.
- Atualizar status.
- Não duplicar em retry.
- Não permitir ferramenta destrutiva ao agente.
- Cálculos financeiros por código/SQL.
- Conteúdo de documento é dado não confiável.
