---
name: supabase-migration
description: Cria ou revisa migrations, tabelas, indices, constraints e politicas RLS do Supabase com seguranca e compatibilidade.
---

# Migration Supabase

Siga as regras globais do projeto em `AGENTS.md` e `docs/CODING_STANDARDS.md`. Regras de seguranca e banco desta skill podem ser mais restritivas que as regras gerais.

## Fluxo obrigatorio

1. Leia `AGENTS.md`, `docs/DATABASE.md` e `docs/SECURITY.md`.
2. Inspecione migrations existentes.
3. Procure uso das tabelas/colunas no codigo.
4. Defina impacto e compatibilidade.
5. Crie nova migration; nao edite migration aplicada.
6. Inclua tipos corretos, defaults, constraints, indices, timestamps, RLS e policies.
7. Verifique service role e frontend.
8. Produza instrucao de validacao.
9. Atualize tipos gerados, quando o projeto usar.
10. Documente impacto.

## Regras financeiras

- dinheiro em `numeric`;
- moeda explicita;
- nao usar float;
- preservar origem;
- criar chave idempotente quando aplicavel.
