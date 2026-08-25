# Production Security Checklist

## Secrets

- Keep real values only in local `.env` files or in the production host secret manager.
- Never commit `.env`, database passwords, access tokens, refresh tokens, private keys or service role keys.
- Only `PUBLIC_SUPABASE_URL` and `PUBLIC_SUPABASE_ANON_KEY` may be exposed to the browser.
- Never use `SUPABASE_SERVICE_ROLE_KEY` in `src/` files that can be bundled for the browser.
- Rotate any secret immediately if it was pasted into chat, committed to Git or uploaded to a ticket.

## Supabase

- Keep RLS enabled on every table reachable from the frontend.
- Use `auth.uid()` policies for user-owned private data.
- Use short-lived signed URLs for private files.
- Use the Supabase CLI login locally; do not store CLI access tokens in the repository.
- Keep `supabase/.temp/` and local dumps out of Git.

## Deployment

- Configure production environment variables in the hosting provider dashboard.
- Do not upload local `.env` files to Hostinger or GitHub.
- Run `npm run build` before deployment.
- Run `npm run supabase:db:push` only after reviewing migrations.
- Review Git changes before every push with `git diff` and `git status --short`.

## Pre-Push Secret Check

Run this before pushing to GitHub:

```sh
git status --short
git diff --cached
rg -n "(service_role|client_secret|refresh_token|access_token|postgres://|postgresql://|sbp_|eyJ)" . -g "!node_modules/**" -g "!.git/**" -g "!.env" -g "!.env.*"
```

The search may show documentation references or package integrity hashes; it
must not show real secret values.
