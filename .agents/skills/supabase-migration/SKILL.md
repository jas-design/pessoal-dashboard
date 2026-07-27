---
name: supabase-migration
description: Cria ou revisa migrations, tabelas, índices, constraints e políticas RLS do Supabase com segurança e compatibilidade.
---

# Migration Supabase

## Fluxo obrigatório

1. Leia `AGENTS.md`, `docs/DATABASE.md` e `docs/SECURITY.md`.
2. Inspecione migrations existentes.
3. Procure uso das tabelas/colunas no código.
4. Defina impacto e compatibilidade.
5. Crie nova migration; não edite migration aplicada.
6. Inclua:
   - tipos corretos;
   - defaults;
   - constraints;
   - índices;
   - timestamps;
   - RLS;
   - policies.
7. Verifique service role e frontend.
8. Produza instrução de validação.
9. Atualize tipos gerados, quando o projeto usar.
10. Documente impacto.

## Regras financeiras

- dinheiro em `numeric`;
- moeda explícita;
- não usar float;
- preservar origem;
- criar chave idempotente quando aplicável.
