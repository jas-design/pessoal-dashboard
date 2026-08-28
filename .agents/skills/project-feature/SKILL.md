---
name: project-feature
description: Implementa uma funcionalidade ponta a ponta neste dashboard Astro, Supabase e n8n, preservando arquitetura, seguranca, testes e documentacao.
---

# Feature ponta a ponta

Antes de implementar qualquer feature, leia e siga `AGENTS.md` e `docs/CODING_STANDARDS.md`. Regras globais do projeto vencem conveniencia especifica da feature.

## Quando usar

Use para paginas, modulos, endpoints ou integracoes completas.

## Fluxo

1. Leia `AGENTS.md` e `docs/CODING_STANDARDS.md`.
2. Leia os documentos relacionados a area.
3. Inspecione a estrutura existente antes de criar arquivos.
4. Reuse componentes, services, scripts e estilos existentes quando possivel.
5. Confirme contratos, schema e autenticacao.
6. Proponha um plano pequeno.
7. Implemente a menor solucao completa.
8. Valide loading, vazio, erro e autorizacao.
9. Rode build/check/testes disponiveis.
10. Atualize documentacao afetada.
11. Resuma mudancas, testes e pendencias.

## Regras

- Nao criar abstracao prematura.
- Nao misturar refatoracao extensa com feature.
- Criar o menor numero de arquivos necessario.
- Manter Astro/HTML, SCSS, TypeScript de browser e services Supabase separados.
- Nao overengineering.
- Para novos scripts/services, prefira TypeScript simples seguindo `docs/CODING_STANDARDS.md`. Nao use TypeScript avancado nem migre JavaScript nao relacionado.
- Nao expor secrets.
- Nao confiar em dados do navegador.
- Para acoes sensiveis, criar aprovacao.
- Para processos longos, usar job/status.

