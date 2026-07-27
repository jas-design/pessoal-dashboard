# Registro de decisões

## ADR-001 — Stack principal

Decisão: Astro + Supabase + n8n.

Razão: compatível com o projeto existente, manutenção simples e boa separação de responsabilidades.

## ADR-002 — OpenClaw

Decisão: não usar no MVP.

Razão: o chat dentro do dashboard e os agentes podem ser implementados com n8n. OpenClaw será avaliado para canais externos e assistente persistente.

## ADR-003 — Dados financeiros

Decisão: cálculos em SQL/TypeScript; IA apenas interpreta e explica.

Razão: reduzir erros e aumentar auditabilidade.

## ADR-004 — Ações sensíveis

Decisão: aprovação humana obrigatória.

Razão: risco operacional e financeiro.

## ADR-005 — OneDrive

Decisão: manter arquivos originais no OneDrive e catálogo/dados extraídos no Supabase.

Razão: evitar duplicação desnecessária e preservar a fonte original.

## ADR-006 — Webhooks n8n

Decisão: navegador não acessa webhooks privados diretamente.

Razão: proteger URLs, secrets, autorização e validação.
