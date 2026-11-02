# Etapa 07C.13B.2 — diagnóstico seguro de credencial exposta pela Supabase CLI

Data: 22/10/2026. Resultado: **credencial classificada; contenção administrativa
pendente e bloqueio remoto mantido**.

## Escopo

Esta etapa analisou somente código, configuração e registros locais. Não houve
conexão com KAWANA `xjxwyzyfnumfphubuize`, tentativa de autenticação, geração,
revogação ou rotação de credencial. O preflight remoto não foi retomado.

O valor exposto não foi pesquisado, copiado, reproduzido ou usado. As buscas
locais utilizaram apenas nomes de variáveis, nome do papel, assinatura do
comando e contagens de marcadores.

## Origem e mecanismo

O comando responsável foi o `supabase db dump` da CLI 2.115.0 com projeto
vinculado, project ref explícito e opção `--dry-run`. Ele não deve ser repetido
para descobrir credenciais.

A saída observada na etapa anterior continha:

- a mensagem de inicialização de um papel de login;
- o papel PostgreSQL `cli_login_postgres`;
- variáveis de conexão PostgreSQL, incluindo `PGPASSWORD`;
- um script de `pg_dump` que usaria essa variável.

O binário local da CLI contém a mesma mensagem, o nome do papel e o marcador
`PGPASSWORD`. O wrapper npm apenas localiza o binário Windows e encaminha os
argumentos e a saída sem filtragem. Portanto, o segredo foi materializado pelo
binário da Supabase CLI e propagado diretamente ao log do processo.

## Classificação

**Tipo provável: senha PostgreSQL de um papel de login inicializado pela
Supabase CLI. Confiança: alta.**

Ela não tem formato nem contexto de token pessoal Supabase, JWT/service-role
ou access token. O PAT previamente usado pela CLI pode ter autorizado a
chamada à Management API, mas não foi o valor exibido como `PGPASSWORD`.

O nome `cli_login_postgres` sugere um papel gerenciado para operações da CLI,
separado do usuário principal `postgres`. Isso não comprova duração curta,
expiração automática nem equivalência com a senha principal do banco.

## Validade, expiração e revogação

Não foi encontrada evidência local de:

- timestamp de expiração;
- TTL;
- revogação;
- invalidação posterior;
- tentativa de login bem-sucedida ou recusada com a credencial.

Os arquivos `supabase/.temp`, traces e telemetria local da CLI não registram o
papel, o valor ou um campo explícito de expiração associado a esta execução.
Não foi realizado teste de validade. Para fins de contenção, a credencial deve
ser tratada como **potencialmente válida**.

## Exposição comprovada e possível

### Comprovada

- saída da ferramenta apresentada na conversa da Etapa 07C.13B.1;
- arquivo local de sessão do Codex que persiste o tool output sob
  `C:\Users\rebra\.codex\sessions\2026\10\22\`.

O arquivo de sessão contém marcadores de `PGPASSWORD` e
`cli_login_postgres`. Ele foi preservado como evidência e não deve ser enviado,
commitado ou anexado a tickets.

### Não encontrada

- nenhum marcador correspondente no workspace fora de dependências;
- nenhum marcador em arquivos rastreados pelo Git;
- nenhum comando correspondente no histórico PSReadLine;
- nenhuma variável atual `PGPASSWORD`, `PGPASSFILE`, `DATABASE_URL`,
  `SUPABASE_DB_PASSWORD` ou `KAWANA_DB_URL` no processo inspecionado;
- nenhum valor embutido em `.env`, `.env.example`, `pooler-url` ou
  `linked-project.json`;
- nenhuma configuração local de CI/CD;
- nenhum export n8n ou arquivo de credencial de banco versionado.

O `pooler-url` local contém somente metadados de um Session pooler na porta
5432, sem senha embutida. Ele não é evidência de persistência do segredo.

### Possível, não verificável localmente

- retenção do transcript/tool output pelo serviço que hospeda a sessão Codex;
- backups, sincronização ou proteção de endpoint do perfil do usuário;
- logs administrativos da Management API/Supabase;
- captura de console por ferramentas externas ao workspace.

## Contenção administrativa recomendada

Um administrador autorizado deve realizar as verificações pelo Dashboard
Supabase sem copiar o segredo para chat, ticket ou comando:

1. registrar project ref, data, horário da sessão, CLI 2.115.0, comando e papel
   `cli_login_postgres`, sem registrar a senha;
2. consultar os logs PostgreSQL/Logs Explorer no intervalo da execução e após
   ela, procurando autenticações do papel e origens inesperadas;
3. verificar na área de Database/roles se o papel ou credencial gerenciada está
   ativo e se o Dashboard informa expiração ou revogação;
4. se o Dashboard não expuser esse ciclo de vida, abrir chamado restrito ao
   suporte Supabase pedindo confirmação de TTL, estado atual e revogação
   específica da credencial/papel;
5. confirmar a revogação ou expiração antes de encerrar o incidente;
6. após contenção confirmada e prazo de retenção aprovado, remover de forma
   controlada a cópia sensível da sessão local e revisar backups/sincronizações.

Não apagar a sessão antes de registrar metadados suficientes para investigação
e antes de decisão administrativa sobre retenção de evidências.

### Ação conforme o tipo confirmado

| Tipo confirmado pelo administrador | Contenção apropriada |
| --- | --- |
| senha do papel `cli_login_postgres` | revogar ou rotacionar especificamente o login gerenciado; confirmar encerramento das sessões; solicitar suporte se o Dashboard não oferecer controle |
| senha principal do banco | redefinir a senha em Database settings, encerrar sessões quando aplicável e atualizar coordenadamente todos os consumidores diretos/pooler |
| personal access token da conta | revogar o PAT nas configurações da conta, revisar atividade e refazer login da CLI; esta hipótese não corresponde à evidência atual |
| access token temporário | invalidar a sessão/token no controle que o emitiu ou solicitar revogação ao suporte; confirmar o TTL real, sem inferi-lo pelo nome |

Redefinir apenas a senha principal do banco não deve ser tratado como prova de
revogação de um papel separado `cli_login_postgres`. A relação entre ambos
precisa ser confirmada pela Supabase.

## Impacto operacional de eventual rotação

O repositório não contém conexão PostgreSQL direta do Astro nem dependência
`pg`. O frontend usa URL pública e anon key via `supabase-js`; por isso uma
rotação de senha PostgreSQL não deveria afetar login, Auth ou chamadas
PostgREST do dashboard. O worker XLSX não acessa Supabase e também não deveria
ser afetado.

Os workflows reais n8n 03/04 não estão exportados no repositório. Há dois
cenários:

- se usam Supabase REST/RPC com `service_role`, a senha PostgreSQL não é a
  credencial usada e sua rotação não deveria interrompê-los;
- se usam node PostgreSQL, connection string direta ou pooler, a rotação pode
  interromper claim/complete, ingestão e retries até a credencial protegida ser
  atualizada e testada.

Também podem ser afetados: Supabase CLI, `psql`, `pg_dump`, rotinas de backup,
pgAdmin, ETL/BI, jobs Hostinger e qualquer consumidor direto ou Session pooler.
Uma rotação ampla exige inventário prévio, janela coordenada, atualização em
secret managers e smoke tests sem processamento financeiro. Nenhuma rotação
deve ser executada nesta etapa.

## Método seguro para futura auditoria

O método aprovado no staging continua sendo um cliente PostgreSQL 17 isolado,
com o preflight montado como arquivo somente leitura e executado diretamente:

```text
psql -X -v ON_ERROR_STOP=1 --csv -f /audit/preflight.sql
```

Requisitos adicionais para a futura conexão remota:

- endpoint direto ou Session pooler; nunca Transaction pooler;
- `PGSSLMODE=verify-full` e CA confiável montada como arquivo somente leitura;
- timeouts em `PGOPTIONS`;
- senha digitada interativamente por um administrador fora da sessão Codex,
  sem eco, ou fornecida por `PGPASSFILE` protegido e montado somente leitura;
- arquivo de senha criado e administrado fora do repositório, nunca lido pelo
  agente e nunca passado como valor de argumento ou variável em comando
  registrado;
- SQL montado somente leitura em container descartável;
- stdout capturado integralmente e sanitizado; stderr separado;
- confirmação de `BEGIN`, 17 seções e `ROLLBACK`, além do código de saída;
- nenhuma chamada a `supabase db dump --dry-run` para obter conexão.

O operador deve validar antecipadamente o hostname do certificado, o project
ref e o papel autorizado. O agente pode executar o arquivo somente depois que
o segredo já estiver disponível ao `psql` por canal que o agente não consiga
ler ou imprimir.

## Veredito

**Bloqueio mantido.** A origem e o tipo foram identificados com alta confiança,
mas não existe prova local de expiração ou revogação. O incidente só pode ser
encerrado após confirmação administrativa de invalidação da credencial e
revisão dos logs de autenticação. A auditoria remota, migrations, backup e
implantação permanecem proibidos até nova autorização.
