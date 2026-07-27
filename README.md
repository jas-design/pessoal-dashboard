# Hub Pessoal

Dashboard privado construído com Astro, TypeScript, SCSS e Supabase.

## Desenvolvimento

```sh
npm install
npm run dev
```

Scripts disponíveis:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run astro`

## Segurança

- Valores reais ficam somente em `.env`, que é ignorado pelo Git.
- Apenas `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` podem chegar ao navegador.
- Service role, webhook secrets e futuras credenciais Microsoft são exclusivas do servidor.
- Nunca envie `.env`, dumps com dados ou credenciais para o repositório.

Consulte `AGENTS.md` e a documentação em `docs/` antes de alterar arquitetura,
autenticação, banco ou integrações.
