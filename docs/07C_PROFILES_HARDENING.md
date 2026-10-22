# Etapa 07C — hardening de `public.profiles`

## Diagnóstico confirmado

- A baseline de 20/10/2026 ainda contém `profiles.role TEXT NOT NULL DEFAULT
  'admin'`. O default permite elevação involuntária sempre que um caminho de
  provisionamento autorizado omite `role`.
- Os dois perfis reais existentes são administradores e não são alterados pela
  migration.
- Não há trigger de `auth.users` para `profiles` nem criação/edição de perfil
  no Astro. O serviço de configurações apenas lê o perfil.
- `is_admin()` exige `role='admin'` e `status='active'`.
- `can_access_module()` concede acesso por `user_permissions.can_view` ou por
  `is_admin()`. Portanto `role='user'` não recebe acesso global implícito.
- A baseline pós-hardening confirma que `authenticated` não tem UPDATE amplo
  em `profiles`; há policy de UPDATE, mas falta o privilégio de tabela.

## Contrato global aprovado

`profiles.role` aceita somente:

- `admin`: administrador global ativo, quando `status='active'`;
- `user`: usuário comum, sem bypass global.

O valor deve ser informado explicitamente. Não existe default. Os papéis por
empresa continuam separados: `owner` deriva de `companies.owner_id`; `admin`,
`reviewer` e `viewer` pertencem a `company_members.role`. Eles não são valores
válidos de `profiles.role`.

## Migration proposta

`supabase/migrations/20261019120000_harden_profiles_security.sql`:

1. valida a estrutura, `is_admin()` e a policy existente;
2. recusa papéis globais diferentes de `admin` e `user`;
3. remove `DEFAULT 'admin'` sem atualizar registros;
4. adiciona e valida o CHECK `role in ('admin', 'user')`;
5. mantém criação de perfis restrita a admin ativo e exige role explícita;
6. permite ao autenticado atualizar somente `full_name` e `avatar_url`, sob
   RLS de linha própria ou administração;
7. remove de anon todos os grants da tabela e limita authenticated a SELECT,
   INSERT e UPDATE por coluna, eliminando inclusive TRUNCATE, que ignora RLS;
8. mantém `role`, `status`, `email` e demais colunas sem UPDATE browser-side;
9. mantém `service_role` sujeita a NOT NULL e ao CHECK;
10. endurece apenas o `search_path` de `is_admin()`, sem mudar seu resultado.

A versão anterior, limitada a `admin`, foi preservada em
`scripts/supabase/archive/20261019120000_harden_profiles_security.admin-only-pre-07c11a.sql`.

## Impactos

- Login: não muda. Usuário Auth sem perfil continua autenticável, mas não é
  admin nem usuário provisionado.
- Provisionamento: o processo confiável deve criar o perfil com `admin` ou
  `user` explícito. A migration não cria usuário, perfil ou vínculo.
- Módulos: `user` depende de concessões explícitas em `user_permissions`.
- Financeiro: pertencer a uma empresa não altera o papel global. Os testes
  exigem `current_user_role()='user'` para owner/admin/reviewer/viewer.
- Edição: usuário comum pode editar apenas seus campos visuais; não pode
  elevar role, ativar status ou editar outro perfil.

## Testes e rollback

Os testes em `scripts/supabase/staging/07c-profiles/20-security-tests.sql`
simulam admin, user e candidato sem perfil com `SET ROLE authenticated` e
claims JWT. Eles cobrem role obrigatória, rejeição de papel empresarial,
provisionamento explícito de `user`, acesso a módulos, edição comum e elevação.

O rollback versionado é somente contenção segura: revoga a nova edição de
campos comuns, mas não restaura `DEFAULT 'admin'`, UPDATE amplo nem remove o
CHECK. Em staging, o rollback integral suportado é recriar o ambiente
descartável. Em produção, usar migration corretiva forward-only.

Nenhuma migration foi executada.
