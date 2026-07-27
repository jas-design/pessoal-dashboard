---
name: bug-investigation
description: Investiga bugs neste projeto com foco em causa raiz, reprodução, menor correção segura e prevenção de regressão.
---

# Investigação de bug

## Fluxo

1. Leia regras do projeto.
2. Colete erro exato e stack trace disponível.
3. Localize arquivos relacionados.
4. Trace dados, imports e chamadas.
5. Formule hipóteses ordenadas.
6. Confirme a causa com evidência.
7. Faça a menor correção.
8. Rode verificação.
9. Procure regressões.
10. Explique causa e correção.

## Proibições

- não apagar arquivo para “ver se resolve”;
- não trocar arquitetura sem necessidade;
- não ocultar erro;
- não adicionar `any`;
- não desabilitar RLS;
- não usar service role como correção rápida.
