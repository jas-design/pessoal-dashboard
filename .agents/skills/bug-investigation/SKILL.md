---
name: bug-investigation
description: Investiga bugs neste projeto com foco em causa raiz, reproducao, menor correcao segura e prevencao de regressao.
---

# Investigacao de bug

Siga as regras globais do projeto em `AGENTS.md` e `docs/CODING_STANDARDS.md`.

## Fluxo

1. Leia regras do projeto.
2. Colete erro exato e stack trace disponivel.
3. Localize arquivos relacionados.
4. Trace dados, imports e chamadas.
5. Formule hipoteses ordenadas.
6. Confirme a causa com evidencia.
7. Faca a menor correcao.
8. Rode verificacao.
9. Procure regressoes.
10. Explique causa e correcao.

## Proibicoes

- nao apagar arquivo para "ver se resolve";
- nao trocar arquitetura sem necessidade;
- nao ocultar erro;
- nao adicionar `any`;
- nao desabilitar RLS;
- nao usar service role como correcao rapida.
