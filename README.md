# Hub Pessoal

Dashboard privado construido com Astro, TypeScript, SCSS e Supabase.

## Desenvolvimento

```sh
npm install
npm run dev
```

Scripts disponiveis:

- `npm run dev`
- `npm run build`
- `npm run preview`
- `npm run astro`
- `npm run supabase:link`
- `npm run supabase:db:push`
- `npm run supabase:db:pull`
- `npm run supabase:db:diff`

## Supabase CLI

O projeto usa o Supabase CLI local via `devDependencies`. Para conectar este
workspace ao projeto remoto:

```sh
npx supabase login
npm run supabase:link
```

Depois de vincular, aplique as migrations locais no Supabase remoto:

```sh
npm run supabase:db:push
```

O project ref configurado no script de link e `hpsgbvcrcnxjmqauaphe`. Tokens,
senhas do banco e service role key devem ficar apenas na maquina local ou no
painel da hospedagem, nunca no Git.

## Seguranca

- Valores reais ficam somente em `.env`, que e ignorado pelo Git.
- Apenas `PUBLIC_SUPABASE_URL` e `PUBLIC_SUPABASE_ANON_KEY` podem chegar ao navegador.
- Service role, webhook secrets e futuras credenciais Microsoft sao exclusivas do servidor.
- Nunca envie `.env`, dumps com dados ou credenciais para o repositorio.

Consulte `AGENTS.md` e a documentacao em `docs/` antes de alterar arquitetura,
autenticacao, banco ou integracoes.
