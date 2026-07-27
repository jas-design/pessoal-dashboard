---
name: project-feature
description: Implementa uma funcionalidade ponta a ponta neste dashboard Astro, Supabase e n8n, preservando arquitetura, segurança, testes e documentação.
---

# Feature ponta a ponta

## Quando usar

Use para páginas, módulos, endpoints ou integrações completas.

## Fluxo

1. Leia `AGENTS.md`.
2. Leia os documentos relacionados à área.
3. Inspecione a implementação atual.
4. Confirme contratos, schema e autenticação.
5. Proponha um plano pequeno.
6. Implemente a menor solução completa.
7. Valide loading, vazio, erro e autorização.
8. Rode build/check/testes disponíveis.
9. Atualize documentação afetada.
10. Resuma mudanças, testes e pendências.

## Regras

- Não criar abstração prematura.
- Não misturar refatoração extensa com feature.
- Não expor secrets.
- Não confiar em dados do navegador.
- Para ações sensíveis, criar aprovação.
- Para processos longos, usar job/status.
