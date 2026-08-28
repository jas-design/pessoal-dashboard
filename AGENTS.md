# AGENTS.md - Dashboard Executivo com IA

## Objetivo do Projeto

Construir um dashboard privado para um único cliente, hospedado na Hostinger,
que centralize documentos, e-mails, dados financeiros, análises e agentes de IA.

Stack principal:

- Astro + TypeScript + SCSS no frontend e backend web.
- Supabase para autenticação, PostgreSQL, RLS, Storage, Realtime e auditoria.
- n8n self-hosted na Hostinger para integrações, automações e agentes.
- Microsoft Graph para OneDrive e Outlook.
- API de IA para classificação, extração, RAG, explicação e geração.
- OpenClaw não faz parte do MVP atual.

Leia primeiro:

1. `docs/PROJECT_CONTEXT.md`
2. `docs/ARCHITECTURE.md`
3. `docs/SECURITY.md`
4. O documento específico da tarefa.

## Princípio Central

O código deve ser simples o suficiente para um desenvolvedor abrir um arquivo e
entender rapidamente o que ele faz.

Prefira código explícito e legível a abstrações genéricas ou engenhosas.

Não crie arquivos, helpers, managers, repositories, factories, classes,
wrappers ou utilitários genéricos sem necessidade real.

Antes de criar algo novo, pergunte:

```text
Isso torna o projeto mais fácil para um humano entender e editar?
```

Se não tornar, não crie.

## Regras Obrigatórias

- Não exponha chaves, secrets, service role, tokens ou credenciais no frontend.
- Variáveis Astro com prefixo `PUBLIC_` são públicas. Nunca use esse prefixo para secrets.
- O navegador não chama webhooks privados do n8n diretamente.
- Chamadas sensíveis seguem: frontend -> endpoint server-side Astro -> n8n/Supabase.
- Use Supabase Auth e RLS. Não contorne RLS no navegador.
- `SUPABASE_SERVICE_ROLE_KEY` somente no servidor e apenas quando necessária.
- A IA não realiza cálculos financeiros críticos sozinha. Use SQL ou TypeScript para cálculos e IA para explicação.
- A IA não envia e-mails, exclui/move arquivos ou altera registros financeiros sem aprovação explícita.
- Toda análise deve registrar usuário, origem, documentos, status, resultado e timestamps.
- Preserve a arquitetura e os padrões existentes antes de criar novas abstrações.
- Prefira soluções simples, modulares e fáceis de manter.
- Não introduza OpenClaw, LangChain, CrewAI ou outro framework sem justificativa técnica aprovada.
- Não modifique migrations ou contratos de API silenciosamente.
- Nunca invente nomes de tabelas, colunas ou endpoints. Inspecione o código e as migrations.
- Ao encontrar divergência entre documentação e código, trate o código/migration atual como fonte operacional e informe a divergência.

## Organização Global de Código

Estas regras valem para toda feature, refactor e bug fix.

### Astro e HTML

- Arquivos `.astro` devem conter principalmente HTML semântico, estrutura de página, composição de componentes, renderização simples e passagem de dados.
- Prefira `header`, `main`, `section`, `nav`, `aside`, `article`, `table`, `form` e `button` quando fizer sentido.
- Evite wrappers `div` sem motivo real de layout.
- Evite markup profundamente aninhado sem necessidade.
- Não coloque grandes blocos de JavaScript ou SCSS dentro de `.astro`.
- Comportamento inline pequeno é aceitável apenas quando for realmente trivial.

### SCSS

- Estilos específicos de página ou feature devem ficar em `src/styles/pages/`.
- Use um arquivo SCSS legível por página/feature, como `src/styles/pages/_dashboard.scss` ou `src/styles/pages/_documents.scss`.
- Não crie muitos arquivos SCSS pequenos apenas por organização.
- Crie SCSS compartilhado somente quando o estilo for reutilizado em múltiplas páginas.
- Mantenha seletores rasos, nomes de classe claros e nesting moderado.
- Evite mixins, loops e abstrações complexas sem benefício real.

### TypeScript e JavaScript

- Scripts de interação de página/feature devem ficar em `src/scripts/<feature>/`.
- Para nova lógica de aplicação, prefira TypeScript simples em vez de JavaScript.
- TypeScript deve continuar parecido com JavaScript comum: legível, explícito e fácil de editar.
- Evite recursos avançados do sistema de tipos salvo benefício prático claro.
- Não migre JavaScript existente e funcional apenas por consistência.
- Use scripts para tabs, filtros, busca, dialogs, estado local simples, eventos DOM e interações de navegador.
- Prefira um script de feature legível a muitos arquivos pequenos.
- Prefira funções simples, objetos simples, estado explícito, DOM nativo e `addEventListener`.
- Evite classes, event buses, state management, dependency injection, generics complexos e design patterns elaborados salvo necessidade real.

Exemplo de estado local preferido:

```ts
const state = {
  source: "all",
  search: "",
  company: "",
  department: "",
  year: "",
  month: "",
  type: "",
  status: "",
};
```

### Services

- Supabase, APIs externas e persistência devem ficar em `src/services/<feature>/`.
- Services devem conter queries Supabase, chamadas de API, persistência e normalização ligada a fontes externas.
- Não coloque queries Supabase dentro de componentes Astro de apresentação.
- Não coloque código de banco em SCSS ou scripts de interação visual.
- Componentes visuais devem focar em renderização.

### Supabase

- Reuse sempre o cliente existente `src/lib/supabase/browser.ts` para acesso browser-side permitido por sessão autenticada e RLS.
- Não crie outros browser clients como `client.ts`, `supabaseClient.ts` ou `createSupabase.ts` sem mudança arquitetural explícita.
- Nunca exponha service role, secrets ou credenciais privadas em código enviado ao navegador.
- Browser-side access deve depender de sessão autenticada, RLS e credenciais anon/publishable.
- Mantenha queries explícitas e fáceis de ler.
- Prefira `supabase.from("documents").select(...).eq(...)` a wrappers desnecessários.
- Não crie camadas repository em volta do Supabase sem complexidade real que justifique.

### Fluxo de Dados

Padrões preferidos:

```text
Page -> Service -> Supabase/API
Page -> Component
Rendered page -> Feature script -> Browser interaction
```

Não misture essas responsabilidades sem necessidade.

### Componentes

- Crie componentes quando eles tornam a página mais fácil de entender ou são genuinamente reutilizáveis.
- Não crie componente para cada pequeno elemento.
- Prefira componentes de bloco, como `DocumentsTable.astro`, `DocumentsFilters.astro` e `DocumentsFolderTree.astro`.
- Evite componentes minúsculos para ícones, textos, células ou botões, salvo quando ficarem complexos ou reutilizáveis.

### Estrutura de Features

Ao criar uma feature, prefira estes diretórios quando forem necessários:

```text
src/pages/<feature>/
src/components/<feature>/
src/services/<feature>/
src/scripts/<feature>/
src/styles/pages/_<feature>.scss
```

Nem toda feature precisa de todos esses arquivos. Crie somente arquivos que
realmente ajudem a entender e manter a feature.

### Dependências

- Não adicione dependências sem necessidade clara.
- Antes de instalar algo, inspecione `package.json`.
- Veja se uma dependência existente já resolve o problema.
- Prefira recursos nativos do browser, Astro, TypeScript e SCSS.
- Não introduza frameworks de UI ou bibliotecas de estado.

### Refactoring

- Não refatore código não relacionado durante uma feature ou correção.
- Não reescreva arquitetura existente sem pedido explícito.
- Prefira mudanças incrementais, pequenas e fáceis de revisar.

### Legibilidade Humana

Este projeto é mantido para edição manual.

Priorize:

1. legibilidade;
2. simplicidade;
3. estrutura previsível;
4. comportamento explícito;
5. pouca abstração;
6. poucas dependências.

Prefira uma pequena duplicação clara a uma abstração complexa sem valor real.

Use nomes descritivos e evite abreviações crípticas.

### Comentários

Use comentários somente quando eles explicam por que algo existe.

Bom:

```ts
// Temporary local folder tree until Microsoft Graph synchronization is implemented.
```

Evite:

```ts
// Loop through documents
documents.forEach(...);
```

## Processo de Trabalho

Antes de editar:

1. Inspecione os arquivos relacionados.
2. Explique resumidamente o impacto.
3. Liste os arquivos que pretende alterar.
4. Preserve compatibilidade com o código atual.

Depois de editar:

1. Rode verificações disponíveis.
2. Informe o que mudou.
3. Informe testes executados e limitações.
4. Atualize documentação quando alterar arquitetura, schema, segurança ou contrato de integração.

Antes de finalizar qualquer tarefa, verifique:

- o código segue este `AGENTS.md`;
- locais de arquivos são previsíveis;
- arquivos Astro não estão sobrecarregados com JS ou SCSS;
- SCSS específico de página está no arquivo correto;
- interação significativa de browser está em script de feature;
- acesso Supabase está em services;
- `src/lib/supabase/browser.ts` foi reutilizado quando aplicável;
- nenhuma abstração ou dependência desnecessária foi introduzida;
- código não relacionado não foi refatorado;
- build, type checks ou testes relevantes passam quando disponíveis.

## Comandos Esperados

Confirme os scripts em `package.json` antes de executar.

Comandos comuns:

```bash
npm install
npm run dev
npm run build
npm run check
npm run lint
```

Não assuma que todos existem.

## Definição de Concluído

Uma tarefa só está concluída quando:

- compila;
- não expõe secrets;
- valida entrada;
- trata erro;
- respeita autenticação e autorização;
- possui estado de loading/erro quando houver UI;
- mantém logs/auditoria quando necessário;
- documentação relevante foi atualizada;
- alterações foram resumidas claramente.

## Roteamento por Área

- Astro e UI: `docs/CODING_STANDARDS.md`
- Supabase: `docs/DATABASE.md`
- n8n e agentes: `docs/N8N_AND_AGENTS.md`
- Segurança: `docs/SECURITY.md`
- Microsoft: `docs/MICROSOFT_INTEGRATION.md`
- Roadmap: `docs/ROADMAP.md`
- Decisões: `docs/DECISIONS.md`

## Skills Disponíveis

Use as skills quando a tarefa corresponder:

- `project-feature`: implementar feature ponta a ponta.
- `supabase-migration`: alterar banco, migration ou RLS.
- `n8n-workflow`: projetar ou integrar workflow n8n.
- `security-review`: revisar segurança e exposição de dados.
- `bug-investigation`: investigar bug sem mudanças aleatórias.
- `document-ingestion`: implementar ingestão de PDF, DOCX ou XLSX.
