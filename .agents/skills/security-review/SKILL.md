---
name: security-review
description: Revisa código, endpoints, Supabase, uploads, webhooks e agentes para identificar exposição de secrets, falhas de autorização e riscos de dados.
---

# Revisão de segurança

## Verificar

- secrets no frontend;
- uso incorreto de `PUBLIC_*`;
- service role;
- ausência de RLS;
- IDOR;
- validação de sessão;
- validação de payload;
- upload inseguro;
- signed URL longa;
- path traversal;
- logs com dados sensíveis;
- webhook exposto;
- prompt injection;
- ação destrutiva sem aprovação;
- SQL dinâmico;
- dependências desnecessárias;
- mensagens de erro excessivas.

## Saída

Classifique:

- crítico;
- alto;
- médio;
- baixo.

Para cada achado:

- arquivo/local;
- cenário;
- impacto;
- correção mínima;
- validação.
