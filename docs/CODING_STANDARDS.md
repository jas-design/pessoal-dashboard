# Padrões de Código

Este documento detalha como aplicar as regras globais do `AGENTS.md`.

O objetivo é manter o projeto fácil de ler, fácil de editar manualmente e
seguro para produção.

## Princípio

Prefira sempre a solução mais simples que seja segura, clara e completa.

Código bom neste projeto é código que outro desenvolvedor consegue abrir,
entender e alterar sem precisar reconstruir uma arquitetura mental complexa.

## Estrutura de Arquivos

Use locais previsíveis:

```text
src/pages/<feature>/
src/components/<feature>/
src/services/<feature>/
src/scripts/<feature>/
src/styles/pages/_<feature>.scss
```

Nem toda feature precisa de todos esses diretórios.

Crie arquivos somente quando eles deixam a feature mais fácil de entender.

## Astro

Arquivos `.astro` devem ser principalmente estrutura e composição.

Bom:

```astro
---
import DocumentsFilters from "../../components/documents/DocumentsFilters.astro";
import DocumentsTable from "../../components/documents/DocumentsTable.astro";
---

<section class="documents-manager">
  <DocumentsFilters />
  <DocumentsTable />
</section>
```

Evite colocar no `.astro`:

- centenas de linhas de DOM scripting;
- queries Supabase;
- grandes blocos de SCSS;
- regras complexas de negócio;
- markup gerado por JavaScript quando o HTML pode ser escrito diretamente.

Pequeno script inline é aceitável quando a lógica é trivial. Se a interação
crescer, mova para `src/scripts/<feature>/`.

## HTML

Prefira tags semânticas:

- `header`
- `main`
- `section`
- `nav`
- `aside`
- `article`
- `table`
- `form`
- `button`

Use `div` quando ela realmente ajuda no layout, não como reflexo automático.

Evite aninhamento profundo sem motivo. Se a estrutura parece difícil de ler,
provavelmente precisa ser simplificada.

## Componentes

Crie componentes para blocos compreensíveis da interface.

Bom:

```text
DocumentsFilters.astro
DocumentsFolderTree.astro
DocumentsTable.astro
```

Evite, salvo necessidade real:

```text
DocumentIcon.astro
DocumentName.astro
DocumentStatusText.astro
DocumentActionButton.astro
```

Um componente deve reduzir a carga mental, não espalhar uma tela simples em
arquivos demais.

## SCSS

Estilos específicos de página devem ficar em `src/styles/pages/`.

Exemplos:

```text
src/styles/pages/_dashboard.scss
src/styles/pages/_documents.scss
src/styles/pages/_documents-upload.scss
src/styles/pages/_notifications.scss
src/styles/pages/_settings.scss
```

Prefira um arquivo SCSS legível por página ou feature.

Evite:

- muitos partials pequenos;
- seletores profundamente aninhados;
- `!important`;
- mixins e loops sem benefício claro;
- reescrever tokens globais sem necessidade.

Bom:

```scss
.documents-manager {
  display: grid;
  grid-template-columns: 260px minmax(0, 1fr);
  gap: 24px;
}
```

Evite:

```scss
.page {
  .wrapper {
    .content {
      .table {
        .row {
          .cell {
            color: red;
          }
        }
      }
    }
  }
}
```

## Scripts de Browser

Interações de página devem ficar em:

```text
src/scripts/<feature>/
```

Exemplo:

```text
src/scripts/documents/file-manager.ts
```

Use scripts para:

- tabs;
- filtros;
- busca;
- dialogs;
- breadcrumb visual;
- seleção local;
- eventos DOM;
- comportamento de browser.

Para novos scripts de browser, services e lógica de aplicação, prefira
TypeScript simples. Não migre JavaScript existente apenas por consistência se
ele já funciona e continua fácil de entender.

TypeScript neste projeto deve parecer próximo de JavaScript comum, com tipos
explícitos apenas onde eles ajudam leitura, manutenção ou segurança.

Bom:

```ts
type DocumentFilter = {
  search: string;
  status: string;
};

function filterDocuments(documents: DocumentItem[], filters: DocumentFilter) {
  return documents.filter((document) => document.status === filters.status);
}
```

Evite sem necessidade real:

- generics complexos;
- conditional types;
- mapped types;
- decorators;
- programação no sistema de tipos;
- cadeias longas de utility types;
- abstrações genéricas que escondem a lógica simples.

Tipos devem ajudar humanos. Prefira tipos de domínio perto da feature que usa
esses dados e evite criar pastas globais de `types`, `models` ou `schemas`
antes de existir uma necessidade clara.

Prefira funções pequenas e explícitas:

```ts
function applySearch() {}
function applyFilters() {}
function selectSource() {}
function clearFilters() {}
function selectFolder() {}
```

Estado local simples é suficiente:

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

Para DOM, use tipos simples e diretos:

```ts
const searchInput = document.querySelector<HTMLInputElement>("#document-search");
const filterButtons = document.querySelectorAll<HTMLButtonElement>("[data-filter]");
```

Use `id` para elementos únicos, `data-*` para comportamento e classes para
estilo. Evite depender de seletores CSS profundos dentro do JavaScript.

Evite:

- classes sem necessidade;
- event buses;
- bibliotecas de estado;
- dependency injection;
- generics complexos;
- muitas camadas para operações simples.

Antes de criar um helper, utility, manager, repository, adapter, wrapper ou
abstração genérica, pergunte se isso deixa a leitura mais clara. Muitas vezes
cinco funções simples em um arquivo são melhores do que cinco arquivos
abstratos.

## Services

Supabase, APIs externas e persistência devem ficar em:

```text
src/services/<feature>/
```

Services podem conter:

- queries Supabase;
- chamadas de API;
- upload/download;
- criação de signed URLs;
- normalização de dados vindos do banco ou APIs;
- validação simples de entrada da operação.

Novos services devem preferir `.ts` e manter os tipos próximos da consulta ou
da feature.

Não coloque Supabase em componentes Astro de apresentação.

Bom:

```ts
export async function getDocuments() {
  const { data, error } = await supabase
    .from("documents")
    .select("*")
    .order("created_at", { ascending: false });

  if (error) {
    throw new Error(`Erro ao buscar documentos: ${error.message}`);
  }

  return data ?? [];
}
```

Evite criar repository/factory/wrapper genérico em volta do Supabase quando uma
query explícita é mais fácil de ler.

## Supabase

Use o cliente existente:

```text
src/lib/supabase/browser.ts
```

Não crie outro browser client, como:

```text
client.ts
supabaseClient.ts
createSupabase.ts
```

Essa regra só muda se a arquitetura do projeto mudar explicitamente.

Nunca coloque no browser:

- service role key;
- secrets;
- refresh tokens;
- credenciais privadas;
- chaves de APIs backend-only.

O acesso browser-side deve depender de:

- sessão autenticada;
- RLS;
- anon/publishable key.

Em services Supabase, prefira consultas explícitas, tipos de domínio simples e
conversão clara dos dados retornados.

Bom:

```ts
import supabase from "../../lib/supabase/browser";

export interface MonthlyFinancialMetrics {
  id: string;
  year: number;
  month: number;
  revenue: number;
}

export async function getMonthlyFinancialMetrics(year: number, month: number) {
  const { data, error } = await supabase
    .from("financial_monthly_metrics")
    .select("id, year, month, revenue")
    .eq("year", year)
    .eq("month", month)
    .maybeSingle();

  if (error) {
    throw new Error(`Erro ao buscar métricas financeiras: ${error.message}`);
  }

  return data
    ? {
        id: data.id,
        year: Number(data.year),
        month: Number(data.month),
        revenue: Number(data.revenue),
      }
    : null;
}
```

Evite criar repositories ou abstrações ORM-style quando uma query Supabase
direta mostra melhor o que está acontecendo.

## Fluxo de Dados

Use separação simples:

```text
Page -> Service -> Supabase/API
Page -> Component
Rendered page -> Feature script -> Browser interaction
```

Exemplo prático:

```text
src/pages/documentos/index.astro
src/components/documents/DocumentsTable.astro
src/scripts/documents/file-manager.ts
src/services/documents/catalog.ts
src/lib/supabase/browser.ts
```

## Dependências

Antes de adicionar qualquer dependência:

1. leia `package.json`;
2. verifique se o projeto já possui algo que resolve;
3. prefira browser nativo, Astro, TypeScript e SCSS;
4. justifique claramente a dependência.

Não adicione frameworks de UI ou bibliotecas de estado sem aprovação técnica.

## Refactoring

Mantenha refactors pequenos e relacionados à tarefa.

Não aproveite uma feature para reorganizar código não relacionado.

Prefira mudanças incrementais que possam ser revisadas com facilidade.

## Comentários

Comente o motivo, não o óbvio.

Bom:

```ts
// Temporary local folder tree until Microsoft Graph synchronization is implemented.
```

Evite:

```ts
// Loop through documents
documents.forEach((document) => {});
```

## Segurança

As regras de segurança sempre vencem conveniência.

- Respeite Supabase RLS.
- Não desative RLS para facilitar desenvolvimento.
- Não use service role no browser.
- Preserve Storage privado para arquivos sensíveis.
- Use signed URLs curtas quando necessário.
- Não registre secrets ou documentos inteiros em logs.
- Não implemente ações destrutivas sem aprovação explícita.

## Checklist Antes de Finalizar

- O código segue `AGENTS.md`.
- Os arquivos estão em locais previsíveis.
- `.astro` não está sobrecarregado com JS ou SCSS.
- SCSS de página está em `src/styles/pages/`.
- Interação significativa está em `src/scripts/<feature>/`.
- Supabase está em `src/services/<feature>/`.
- O cliente `src/lib/supabase/browser.ts` foi reutilizado.
- Nenhuma dependência desnecessária foi adicionada.
- Nenhuma abstração desnecessária foi criada.
- Código não relacionado não foi refatorado.
- Build, type check ou testes relevantes passam quando disponíveis.
