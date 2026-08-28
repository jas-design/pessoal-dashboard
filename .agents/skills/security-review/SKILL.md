---
name: security-review
description: Revisa codigo, endpoints, Supabase, uploads, webhooks e agentes para identificar exposicao de secrets, falhas de autorizacao e riscos de dados.
---

# Revisao de seguranca

Siga as regras globais do projeto em `AGENTS.md` e `docs/CODING_STANDARDS.md`. Regras de seguranca desta skill podem ser mais restritivas que as regras gerais.

## Verificar

- secrets no frontend;
- uso incorreto de `PUBLIC_*`;
- service role;
- ausencia de RLS;
- IDOR;
- validacao de sessao;
- validacao de payload;
- upload inseguro;
- signed URL longa;
- path traversal;
- logs com dados sensiveis;
- webhook exposto;
- prompt injection;
- acao destrutiva sem aprovacao;
- SQL dinamico;
- dependencias desnecessarias;
- mensagens de erro excessivas.

## Saida

Classifique:

- critico;
- alto;
- medio;
- baixo.

Para cada achado:

- arquivo/local;
- cenario;
- impacto;
- correcao minima;
- validacao.
