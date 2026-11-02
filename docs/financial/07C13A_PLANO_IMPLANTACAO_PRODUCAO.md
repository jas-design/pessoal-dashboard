# Etapa 07C.13A — plano seguro de implantação em produção

Data de preparação: 22/10/2026. Este documento não autoriza nem executa acesso
ao Supabase KAWANA. O projeto de produção informado é
`xjxwyzyfnumfphubuize`; o staging validado foi `kawana-07c11-staging`.

## Conjunto congelado

O arquivo `scripts/supabase/07c13a-production-migrations.sha256` registra a
ordem e os hashes do conjunto que passou por 121 testes e três postflights.
Os hashes foram recalculados no workspace e coincidem com os relatórios de cada
ensaio local.

| Ordem | Migration | SHA-256 | Dependência principal |
| --- | --- | --- | --- |
| 1 | `20261016120000_create_company_members.sql` | `2845303CB49417384FD93A380A19ED86B7AF81FE77B9F6AD506521A7BFDDCEB8` | `companies`, `auth.users`, `is_admin()` e a policy SELECT ampla comprovada |
| 2 | `20261016121000_secure_financial_review_access.sql` | `3045E06A2A64AC320EDAABFBEC3D003A827CE32ECA6AF4B5516F183C38405862` | migration 1 e contratos reais das tabelas/RPCs financeiras |
| 3 | `20261017120000_protect_financial_private.sql` | `F354289DE2EB92D0DD7B6A39321FF30168875F1A714BF2B0A84BF365B8F4F817` | migration 2 e os quatro pares wrapper/implementação |
| 4 | `20261019120000_harden_profiles_security.sql` | `F2FF71E47BFA8E9FF52E9AAFDF437854FCBD8616E0002974E85F19B2F592CD1E` | `profiles`, `is_admin()` e valores globais compatíveis `admin`/`user` |
| 5 | `20261020160000_remove_remaining_public_dashboard_access.sql` | `5863D4109ED5AEF01C0BAE48E4E8055312CF12501CFF188FC4323234EA352DB8` | 13 tabelas existentes e policies públicas inventariadas |
| 6 | `20261020161000_harden_public_default_privileges.sql` | `5DE8AE0D33E25875A663C778D1C7A46E929AC9207DDCC1E24D70079CA6964D38` | helpers existentes e defaults de `postgres` em `public` |
| 7 | `20261022120000_revoke_postgres_global_default_function_execute.sql` | `06660E24CF18E2E3D5AC126DF1008B41B8971326DAFCD4D6F2AA944BC14FD516` | migration 6; revoga o default global de EXECUTE para funções futuras |

As sete migrations estão rastreadas e sem diff no commit local atual
`cbc01d1` (`database setup`). No momento desta validação, somente os três
artefatos 07C.13A estavam não rastreados. Antes de produção, o conjunto completo
precisa de revisão humana, commit/tag aprovado, árvore de trabalho limpa e nova
conferência contra este manifesto. Nenhuma migration deve ser editada; qualquer
mudança gera uma nova versão e repete integralmente o staging.

O `supabase/.temp/project-ref` local aponta para KAWANA, mas o script
`supabase:link` do `package.json` aponta para outro project ref. Portanto não se
deve usar scripts da raiz nem `db push`. O vínculo local é evidência de risco,
não autorização de acesso.

## Compatibilidade conhecida

| Área | Staging aprovado | Diferença/checagem obrigatória em produção |
| --- | --- | --- |
| Autorização financeira | owner/admin/reviewer/viewer, isolamento A/B, ETag, auditoria e `TESTE_` aprovados | `company_members` deve continuar ausente; policy ampla de `companies` deve existir exatamente uma vez |
| Profiles | `role` explícito `admin`/`user`, sem default e sem UPDATE amplo | confirmar apenas valores compatíveis e preservar os dois admins ativos; não há trigger de provisionamento |
| Acesso público | 13 tabelas sem ACL anon após migrations | produção recebeu hardening manual em dez tabelas; comparar ACLs e policies atuais, sem presumir a baseline de 20/10 |
| Defaults | defaults de `postgres` endurecidos; exceção `supabase_admin` monitorada | confirmar defaults atuais, ausência de owner `supabase_admin` em objetos da aplicação e que a exceção não se tornou global |
| Revisão financeira | quatro wrappers públicos preservados e schema privado fechado aos papéis de API | confirmar assinaturas, owners, hashes dos corpos e grants antes da aplicação |
| Extração n8n | `finance_claim_next_document` e `finance_complete_document` continuam exclusivas de `service_role` | confirmar ACLs atuais e credencial efetiva dos workflows 03/04 sem revelar o segredo |
| Dados | migrations não alteraram documentos, proprietários nem fatos no staging | confirmar as quatro divergências conhecidas e que continuam limitadas ao arquivo sintético; não corrigir dados no deploy |
| Histórico | staging controlado manualmente | `supabase_migrations.schema_migrations` não existia no inventário; não usar `db push` nem `migration repair` sem estratégia aprovada |

A baseline schema-only local é evidência estrutural histórica e confidencial,
mas não representa as alterações manuais posteriores nem é backup recuperável.
O preflight futuro está em
`scripts/supabase/07c13a-production-readonly-preflight.sql`. Ele não chama
funções da aplicação, não retorna valores financeiros ou dados pessoais e deve
ser executado/exportado somente após autorização específica.

## Impacto nas integrações

### Auth e profiles

- Os dois perfis administrativos existentes são preservados; a migration não
  muda linhas e falha se encontrar papéis/status incompatíveis.
- Novos usuários Auth não recebem profile automaticamente. O provisionamento
  servidor deve criar o profile com papel global explícito `admin` ou `user`.
- Papéis empresariais ficam em `companies.owner_id`/`company_members` e nunca
  são copiados para `profiles.role`.
- Login e sessão Supabase permanecem independentes da criação do profile, mas
  módulos que consultam profile podem negar acesso até o provisionamento.

### Astro

- Financeiro consulta `companies` no browser; após a migration 1, usuários só
  veem empresas próprias/vinculadas, enquanto admin global conserva a leitura
  administrativa de metadados sem ganhar poder de revisão financeira.
- A tela de revisão usa os mesmos quatro nomes e assinaturas de RPC. Campos de
  capacidade adicionados são compatíveis com o contrato atual.
- Documentos mantêm as policies gerais com `is_admin()`; isso preserva a
  administração legítima dos demais módulos e não concede decisão financeira.
- `Header.astro` e `notificacoes.astro` consultam `notifications` durante o
  build estático sem sessão. O hardening produz estado vazio/aviso, mas o build
  continua. A correção para carregar após autenticação é uma entrega separada:
  não bloqueia o hardening do banco, porém bloqueia considerar notificações
  autenticadas funcionalmente validadas em um release do frontend.

### n8n 03/04 e XLSX

- As sete migrations não alteram as duas RPCs públicas de extração nem seus
  grants exclusivos a `service_role`.
- O repositório não contém export sanitizado/configuração real dos workflows
  03/04. Antes do deploy é obrigatório confirmar papel efetivo, parâmetros,
  timeouts/retries e inexistência de chamadas diretas a `financial_private`.
- A aprovação destas migrations **não aprova a integração XLSX**. Persistem as
  incompatibilidades `financial-extraction.v1`, inferência de empresa por nome,
  `ON CONFLICT` que pode reabrir revisão, limite 8 MiB versus 25 MiB e destino
  das evidências. Os 612 fatos não são transações e nada deve ser ativado.

## Backup recuperável e ensaio de restauração

O backup deve ser feito imediatamente antes da janela, sem gravar conexão ou
senha no relatório. Usar uma variável de sessão protegida e diretório cifrado,
fora do Git, com acesso mínimo. Os comandos abaixo são um procedimento futuro,
não devem ser executados nesta etapa:

```powershell
supabase db dump --db-url $env:KAWANA_DB_URL -f roles.sql --role-only
supabase db dump --db-url $env:KAWANA_DB_URL -f schema.sql
supabase db dump --db-url $env:KAWANA_DB_URL -f data.sql --use-copy --data-only -x "storage.buckets_vectors" -x "storage.vector_indexes"
Get-FileHash -Algorithm SHA256 roles.sql,schema.sql,data.sql
```

Antes de aceitar o backup:

1. executar `--dry-run` e documentar os schemas excluídos pela versão da CLI;
2. confirmar que Auth e dados da aplicação estão no conjunto recuperável;
3. exportar separadamente customizações de `auth`/`storage`, se existirem;
4. copiar separadamente os objetos do Storage: o backup PostgreSQL contém
   metadados, não os arquivos armazenados;
5. registrar versão PostgreSQL/CLI, extensões, hashes, tamanho, horário, RPO e
   local cifrado; nunca versionar o conteúdo;
6. verificar backup diário/PITR e o ponto recuperável no Dashboard, sem tratá-lo
   como substituto do teste lógico.

O teste de recuperação ocorre em projeto Supabase isolado ou stack local de
versão compatível. Restaurar roles, schema e data com transação única e
`ON_ERROR_STOP=1`; habilitar extensões previamente; executar integridade por
contagens agregadas, FKs, RLS/policies/grants, login sintético e hashes de
funções. Nenhum dado restaurado pode ficar acessível fora da equipe autorizada.
O teste só aprova o backup se concluir do zero e produzir relatório sanitizado.

Recuperação por nível:

- falha antes do primeiro commit: nenhuma ação de dados; investigar e cancelar;
- falha de uma migration: ela própria reverte pela transação; não iniciar a
  seguinte;
- regressão de acesso após aplicação: preferir migration corretiva forward-only;
- corrupção/perda de dados: restauração integral do backup/PITR aprovado, com
  janela e indisponibilidade explícitas;
- não executar o rollback legado automaticamente: ele é parcial e pode
  reabrir ACLs/policies vulneráveis. `company_members`, vínculos e auditoria não
  possuem reversão integral por aquele script.

## Checklist operacional

### Antes da janela

- [ ] Autorizar e executar o preflight somente leitura no projeto ref correto.
- [ ] Confirmar zero resultados inesperados e comparar com baseline/CSVs.
- [ ] Confirmar que `company_members` e as quatro helpers empresariais ainda não existem.
- [ ] Confirmar os dois admins ativos e nenhum papel/status incompatível.
- [ ] Confirmar ACLs manuais atuais, RPCs de extração e exceção `supabase_admin`.
- [ ] Confirmar as quatro divergências como sintéticas, sem corrigi-las.
- [ ] Produzir backup lógico completo, backup de Storage e hashes.
- [ ] Restaurar o backup em ambiente isolado e aprovar o ensaio.
- [ ] Congelar release revisado: Git limpo, commit/tag, sete hashes idênticos.
- [ ] Revisar export sanitizado dos workflows 03/04 e planejar smoke test sem XLSX.
- [ ] Definir operador, revisor, janela, canal de incidente e condição de abortar.

### Aplicação futura

- [ ] Usar conexão explicitamente conferida para `xjxwyzyfnumfphubuize`; não usar vínculo/script da raiz.
- [ ] Registrar apenas metadados sanitizados, nunca URL, senha, JWT ou conteúdo financeiro.
- [ ] Executar uma migration por vez, na ordem 1–7, com `ON_ERROR_STOP=1`.
- [ ] Conferir o hash imediatamente antes de cada arquivo.
- [ ] Esperar `COMMIT` e executar o postflight correspondente antes da próxima.
- [ ] Interromper em qualquer erro, assinatura/owner/ACL diferente, lock anormal,
      alteração de contagens de documentos/fatos/proprietários ou indisponibilidade.

### Postflight

- [ ] Repetir inventário de RLS, policies, grants, defaults, owners e hashes.
- [ ] Confirmar `company_members`, capacidades e isolamento sem criar vínculo real.
- [ ] Confirmar os dois admins, login e leitura/edição permitida de profile.
- [ ] Confirmar anon bloqueado e helpers somente nos papéis previstos.
- [ ] Confirmar wrappers públicos funcionais e schema privado inacessível às roles de API.
- [ ] Confirmar RPCs de extração executáveis somente por `service_role`.
- [ ] Confirmar contagens e hashes de documentos/fatos/jobs/auditoria inalterados.
- [ ] Executar smoke tests Astro autenticados e workflow 03/04 sem processar XLSX.
- [ ] Monitorar Auth, PostgREST, n8n e erros 401/403/5xx pelo período acordado.

## Condições objetivas Go/No-Go

### Aprovado no staging

- sete hashes acima, 121/121 testes e três postflights;
- isolamento multiempresa, profiles, Auth, defaults, wrappers e extração;
- zero fixtures residuais e exceção `supabase_admin` sem mudança.

### Obrigatório para Go

- preflight remoto aprovado e revisado por duas pessoas;
- backup completo restaurado com sucesso;
- repositório limpo e release imutável com hashes idênticos;
- confirmação sanitizada dos workflows 03/04 e do uso exclusivo das RPCs públicas;
- janela, operador, recuperação e monitoramento aprovados;
- nenhuma divergência estrutural ou papel de profile incompatível.

### No-Go imediato

- project ref/conexão não conferido; uso de `db push`, `migration repair` ou script da raiz;
- hash diferente, migration editada ou histórico remoto ambíguo sem decisão formal;
- backup sem dados/Auth/Storage ou restauração não ensaiada;
- `company_members`/helpers já existentes, policy ampla ausente/duplicada, assinatura/owner/ACL divergente;
- admins existentes incompatíveis ou perda de acesso do workflow 03/04;
- qualquer SQL que tente corrigir vínculos, owners ou fatos durante a implantação.

### Ressalvas monitoradas e funcionalidades desativadas

- defaults gerenciados de `supabase_admin` devem ser reavaliados a cada mudança;
- notificações no build Astro requerem correção separada;
- UI de aprovação/rejeição continua desabilitada;
- integração worker XLSX/workflow 04, publicação financeira e migração dos 612
  fatos continuam fora do escopo e não prontas para ativação.

## Veredito

O conjunto local está **pronto para solicitar autorização de auditoria remota
somente leitura**, não para implantação. Produção permanece em **No-Go** até o
preflight real, o backup integral restaurado, o release Git imutável e a
verificação sanitizada dos workflows 03/04 serem aprovados.
