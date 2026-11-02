# Etapa 07C.13B.3 — verificação local e contenção da credencial Supabase

Data: 22/10/2026. Classificação: **BLOQUEADO — EXIGE VERIFICAÇÃO
ADMINISTRATIVA**.

> Atualização posterior: a Etapa 07C.13B.4 recebeu confirmação administrativa
> de que a senha de `cli_login_postgres` expirou em 22/10/2026 às 21:28:48 UTC,
> o papel mantém `rolcanlogin=true` e não havia conexões ativas. Esta
> confirmação contém a credencial para novas autenticações por senha, mas a
> revisão de acessos anteriores e o tratamento da evidência JSONL continuam
> pendentes. Consulte
> `docs/financial/07C13B4_ENCERRAMENTO_DOCUMENTAL_CREDENCIAL.md`.

## Escopo executado

Esta etapa utilizou exclusivamente evidências locais existentes. Foram lidos:

- `docs/financial/07C13B1_RECOLETA_SEGURA_AUDITORIA_REMOTA.md`;
- os relatórios e scripts sanitizados em
  `.local/supabase/staging/07c11/runs/`;
- `package.json` e o wrapper npm local da Supabase CLI;
- marcadores estáticos do binário Supabase CLI 2.115.0;
- metadados sanitizados da sessão Codex, traces da CLI, histórico PSReadLine,
  workspace, Git, `.env` e `supabase/.temp`;
- código e documentação local dos possíveis consumidores Astro, n8n e worker
  XLSX.

Não houve acesso a KAWANA `xjxwyzyfnumfphubuize`, execução da Supabase CLI,
teste de autenticação, uso da credencial, alteração de senha, role, migration
ou workflow.

## Comando que originou a exposição

O comando exato, recuperado do registro local sem reproduzir sua saída, foi:

```text
npm.cmd run supabase -- db dump --linked --project-ref xjxwyzyfnumfphubuize --dry-run
```

Ele não foi repetido nesta etapa.

Não existe script dedicado do projeto responsável por essa tentativa. A cadeia
local comprovada foi:

```text
npm.cmd
  -> package.json: "supabase": "supabase"
  -> node_modules/supabase/dist/supabase.js
  -> @supabase/cli-windows-x64/bin/supabase.exe 2.115.0
  -> inicialização do login PostgreSQL pela CLI
  -> saída herdada sem filtragem pelo wrapper npm
```

O wrapper JavaScript apenas resolve o binário, encaminha os argumentos e usa
`stdio: "inherit"`. O binário local contém os marcadores `Initialising login
role`, `cli_login_postgres` e `PGPASSWORD`.

## Classificação da credencial

**Conclusão: senha PostgreSQL pertencente ao papel de login gerenciado
`cli_login_postgres`. Confiança: alta.**

A saída original associou, no mesmo bloco de configuração PostgreSQL:

- usuário `cli_login_postgres`;
- variável `PGPASSWORD`;
- host, porta e banco que seriam usados pelo `pg_dump`.

Isso diferencia o valor de:

- senha principal do papel `postgres`;
- personal access token usado para autenticar a Supabase CLI;
- JWT anon ou `service_role`;
- token de acesso de usuário do Supabase Auth.

O PAT da CLI pode ter autorizado a solicitação à Management API, mas não foi o
valor impresso como `PGPASSWORD`. O nome do papel e a mensagem da CLI indicam
um login específico para operações da ferramenta. A evidência local não
comprova que o papel ou a senha sejam temporários, nem informa seu ciclo de
vida.

## Registros da credencial

### Exposição comprovada

- tool output exibido na conversa da Etapa 07C.13B.1;
- arquivo JSONL da sessão local do Codex sob
  `C:\Users\rebra\.codex\sessions\2026\10\22\`.

O evento original contém os marcadores `PGPASSWORD` e
`cli_login_postgres`, mas nenhum campo explícito de expiração. O arquivo foi
preservado como evidência e não deve ser compartilhado, anexado a tickets ou
versionado.

### Ausência de registro encontrada

Não foram encontrados marcadores equivalentes em:

- relatórios e scripts de `.local/supabase/staging/07c11/runs/`;
- código e configuração do projeto, exceto referências sanitizadas dos
  relatórios do incidente;
- arquivos rastreados pelo Git;
- histórico PSReadLine;
- traces e telemetria local da Supabase CLI;
- variáveis atuais de credencial PostgreSQL no processo inspecionado;
- `.env`, `.env.example`, `supabase/.temp/pooler-url` ou
  `supabase/.temp/linked-project.json`;
- configurações locais de CI/CD;
- exports n8n ou arquivos de credencial versionados.

O arquivo `pooler-url` contém metadados de Session pooler na porta 5432 e não
contém senha. Ele não é evidência de persistência nem autorização de uso.

### Destinos possíveis não verificáveis localmente

- retenção do transcript/tool output pelo serviço da sessão Codex;
- backups ou sincronização do perfil local do usuário;
- proteção de endpoint ou captura externa do console;
- logs da Management API e logs PostgreSQL mantidos pela Supabase.

## Expiração e revogação

Não existe evidência local confiável de:

- `VALID UNTIL`, TTL ou timestamp de expiração;
- revogação ou rotação posterior;
- remoção do papel;
- bloqueio de login;
- encerramento de sessões existentes;
- tentativa de autenticação bem-sucedida ou rejeitada após a exposição.

A credencial deve continuar classificada como **potencialmente válida**. O
incidente não pode ser encerrado com base apenas no nome do papel ou na
expectativa de que a CLI use credenciais curtas.

## Verificações administrativas pendentes

Um administrador autorizado precisa realizar no Dashboard Supabase, sem
copiar ou testar a senha:

1. revisar Database/roles e confirmar se `cli_login_postgres` existe, aceita
   login e possui prazo de validade visível;
2. revisar Logs Explorer/Postgres no intervalo da exposição e no período
   posterior, procurando autenticações do papel, endereços de origem e
   atividade inesperada;
3. confirmar se existem sessões ativas ou recentes desse papel;
4. confirmar com a Supabase se a credencial é independente da senha principal
   `postgres` e qual mecanismo efetivamente a invalida;
5. revogar/inutilizar especificamente a credencial ou o login gerenciado, por
   controle suportado do Dashboard;
6. se o Dashboard não expuser validade ou revogação, abrir chamado restrito ao
   suporte Supabase com project ref, data, horário, versão 2.115.0, comando e
   nome do papel — nunca com a senha;
7. obter confirmação documental de expiração ou revogação e de encerramento de
   sessões antes de encerrar o incidente;
8. definir retenção da evidência e, somente após contenção confirmada, autorizar
   a remoção segura das cópias locais sensíveis e revisar backups.

Uma futura verificação SQL de `rolcanlogin` e `rolvaliduntil` seria somente
leitura, mas ainda constitui acesso à produção e exige autorização separada.
Ela não foi executada nesta etapa.

## Procedimento de contenção preparado

### Se for confirmada a senha de `cli_login_postgres`

1. preservar os metadados do incidente sem preservar cópias adicionais do
   valor;
2. revisar logs e sessões antes da revogação;
3. usar o controle suportado pela Supabase para revogar ou rotacionar o login
   específico;
4. encerrar sessões do papel quando o mecanismo suportado assim exigir;
5. confirmar que a credencial anterior está inválida sem testá-la a partir
   deste ambiente;
6. revisar logs novamente e registrar apenas o resultado sanitizado.

Não alterar manualmente um papel gerenciado sem orientação da Supabase.

### Se a Supabase confirmar equivalência com a senha principal

1. inventariar todos os consumidores de conexão direta e pooler;
2. programar janela e rollback;
3. redefinir a senha em Database settings;
4. atualizar os secret managers/credenciais protegidas dos consumidores;
5. reiniciar conexões persistentes quando necessário;
6. executar smoke tests seguros e revisar falhas de autenticação.

Rotacionar a senha principal sem confirmar essa equivalência pode não revogar
`cli_login_postgres` e pode causar indisponibilidade desnecessária.

## Impacto potencial da rotação

### Consumidores provavelmente não afetados

- Astro usa `supabase-js`, URL pública e anon key; não há driver `pg` nem
  conexão PostgreSQL direta no código atual;
- Supabase Auth, PostgREST e Storage usados pelo browser não dependem da senha
  PostgreSQL principal do cliente;
- o worker XLSX não possui acesso Supabase nem credencial PostgreSQL.

### Consumidores potencialmente afetados

- Supabase CLI, `psql`, `pg_dump`, backups e ferramentas administrativas;
- pgAdmin, ETL/BI, jobs Hostinger ou scripts externos não versionados;
- conexões diretas e Session pooler que usem a senha rotacionada;
- workflows n8n 03/04 caso utilizem node PostgreSQL ou connection string.

Os exports/configurações reais dos workflows n8n 03/04 não existem no
repositório. A documentação indica uso esperado das RPCs
`finance_claim_next_document` e `finance_complete_document` por
`service_role`, mas não comprova a credencial efetiva da instância:

- REST/RPC com `service_role`: rotação da senha PostgreSQL não deveria afetar;
- node PostgreSQL/direto/pooler: rotação interromperia o fluxo até atualização
  coordenada da credencial.

Antes de qualquer rotação ampla, o administrador deve inspecionar apenas o
tipo da credencial n8n, host/porta e consumidores vinculados, sem exportar o
segredo. Workflows não devem ser modificados nesta etapa.

## Método seguro para a próxima auditoria

O transporte validado no staging permanece aprovado:

```text
psql -X -v ON_ERROR_STOP=1 --csv -f /audit/preflight.sql
```

A futura execução remota deve cumprir simultaneamente:

- cliente PostgreSQL 17 em container descartável;
- SQL montado como arquivo somente leitura;
- endpoint direto ou Session pooler, nunca Transaction pooler;
- project ref, host e papel confirmados antes da conexão;
- `PGSSLMODE=verify-full` e CA confiável montada somente leitura;
- `statement_timeout`, `lock_timeout` e
  `idle_in_transaction_session_timeout` em `PGOPTIONS`;
- senha digitada interativamente por administrador fora da sessão Codex, sem
  eco, ou arquivo `PGPASSFILE` protegido, criado fora do repositório e montado
  somente leitura;
- agente sem acesso ao conteúdo da senha ou do passfile;
- nenhum segredo em argumentos, variáveis impressas, comandos, relatórios ou
  logs;
- captura integral de stdout e stderr separados;
- validação de código de saída, `BEGIN`, 17 seções e `ROLLBACK`;
- proibição de usar `supabase db dump --dry-run` para obter credenciais.

O preflight permanece uma transação `READ ONLY` e não deve ser executado até
nova autorização explícita, após encerramento deste incidente.

## Evidências suficientes e pendências

As evidências locais são suficientes para identificar o comando, a cadeia de
execução, o tipo da credencial e os locais locais de exposição. Não são
suficientes para comprovar validade atual, expiração, revogação, sessões ou
eventual uso indevido.

Falta precisamente:

1. estado administrativo de `cli_login_postgres`;
2. prazo de validade real, se existir;
3. revisão dos logs de autenticação e sessões;
4. confirmação do mecanismo de revogação pela Supabase;
5. confirmação de que a credencial anterior foi invalidada;
6. inventário do tipo de credencial usado pelos workflows n8n 03/04 antes de
   qualquer rotação da senha principal;
7. decisão de retenção e descarte seguro da sessão local que contém o valor.

## Veredito

**BLOQUEADO — EXIGE VERIFICAÇÃO ADMINISTRATIVA.**

O incidente não está encerrado porque não existe prova de expiração ou
revogação. Não iniciar auditoria remota, migrations, backup, implantação,
rotação ou alteração de workflows automaticamente.
