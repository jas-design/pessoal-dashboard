# Estado verificado do projeto

Última revisão documental: 2026-11-21. Este arquivo descreve evidências locais;
não representa uma verificação ao vivo de GitHub, Supabase Cloud, n8n,
Hostinger ou Microsoft 365.

## Legenda

- **Verificado no repositório**: existe código, migration, teste ou artefato
  versionado correspondente.
- **Documentado**: há decisão ou procedimento escrito, sem comprovação remota
  nesta revisão.
- **Não confirmado externamente**: exige consulta autorizada ao serviço real.

## Verificado no repositório

- Estrutura Astro com rotas para login, dashboard, documentos, upload,
  financeiro, revisão financeira, bancos/contas, relatórios, notificações e
  configurações.
- Cliente browser Supabase único e services para autenticação, catálogo de
  documentos, upload privado, notificações, integrações e preferências.
- Catálogo de documentos com filtros, paginação, árvore de pastas OneDrive e
  geração de URL temporária de download para Storage.
- Dashboard e páginas financeiras com seleção de empresa/período, métricas,
  gráficos, receber, pagar, movimentações, contas e relatórios.
- Services para métricas legadas e para métricas publicadas por empresa.
- Fila de revisão financeira baseada em RPCs, com decisão, histórico e papel do
  documento.
- Parser XLSX Kawana, worker HTTP privado, adaptação do contrato, persistência v2
  e validações determinísticas.
- Onze migrations versionadas para métricas, empresas, hardening, persistência,
  publicação e claim determinístico.
- Quatro exports de workflow n8n; todos estão marcados `active: false` no JSON.
- Compose local e exemplo de instalação Hostinger para o worker, sem publicar a
  porta do serviço e com segredo fora do arquivo versionado.
- Testes versionados para notificações, build estático, indicadores de runtime,
  parser/worker financeiro, migrations, publicação, autorização e workflows
  n8n.

## Validações locais executadas

Em 2026-11-21:

- `npm run check`: concluído com 0 erros e 5 hints já existentes.
- `npm run build`: concluído; 11 rotas estáticas geradas. O bundler alertou
  sobre chunks maiores que 500 kB.
- Suites disponíveis: 104 testes aprovados e 3 ignorados, sem falhas.
- Os 3 testes ignorados dependem de artefato XLSX real/integração local e não
  constituem validação de produção.

## Documentado, mas não comprovado nesta revisão

- OneDrive como fonte original e Supabase como catálogo operacional.
- Supabase Cloud como banco, autenticação e Storage do ambiente externo.
- n8n e dashboard hospedados ou coordenados pela infraestrutura Hostinger.
- Fluxos Microsoft Graph/OneDrive e lote financeiro Kawana preparados para
  importação e execução controlada.
- Procedimentos de staging, backup, preflight, postflight e rollback descritos
  em `docs/financial/`.

Documentos históricos registram momentos de `NO-GO`, gates de backup e ações
posteriores. Eles não provam o estado atual dos serviços externos e devem ser
reconfirmados antes de qualquer operação.

## Pendências de confirmação externa

- Qual commit está efetivamente implantado no dashboard da Hostinger.
- Estado de build, variáveis e domínio do dashboard em produção.
- Quais migrations estão aplicadas em cada projeto Supabase e se as policies,
  grants e RPCs correspondem ao código atual.
- Estado real dos workflows n8n, IDs, versões importadas, credenciais
  selecionadas, execuções e retenção de dados.
- Existência, saúde, rede, limites e versão do worker XLSX na Hostinger.
- App Registration Microsoft, permissões concedidas, renovação de tokens e
  saúde da sincronização OneDrive/Outlook.
- Proteções de branch, Actions, secrets e estado do repositório remoto GitHub.
- Se os registros da tabela `integrations` refletem saúde real; a UI atual os
  apresenta como estado registrado, não como health check direto.

## Pontos técnicos ainda não confirmados

- Aplicação externa das migrations de persistência/publicação financeira v2.
- Disponibilidade real das RPCs consumidas por `review.ts` e pelos workflows.
- Execução idempotente ponta a ponta de um arquivo real: OneDrive -> n8n ->
  worker -> Supabase -> revisão -> publicação -> dashboard.
- Sincronização OneDrive contínua e tratamento de delta, retries e expiração de
  token.
- Endpoints Astro server-side/SSR para substituir qualquer operação sensível
  que ainda dependa do browser; a arquitetura atual documenta essa evolução.
- Implementação de Outlook, RAG, agentes e aprovação de ações sensíveis além dos
  contratos e planos existentes.

## Limitações do mapa Graphify

O snapshot analisado tinha 1.387 nós e 2.514 relações. O diagnóstico registrou
relações externas/pendentes e relações colapsadas no grafo não direcionado;
portanto, o mapa serve para navegação e memória, enquanto código, migrations e
verificação autorizada dos serviços permanecem como fontes finais.

## Entrega 13C — 23/11/2026

Fontes de planilhas/OCR, workflows inativos, testes e migrations adicionados ao
Git. Consulte `docs/financial/13C_DOCUMENT_CONTENT.md` para evidências e limites.
A migration de diagnóstico foi aplicada; os novos workflows são rascunhos inativos.
A VPS continua na imagem 13c-v1 segundo a verificação MCP fornecida pelo usuário;
a imagem 13c-diag-v1 e seu piloto ainda não foram implantados.
