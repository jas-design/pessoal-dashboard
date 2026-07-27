# Como usar o Codex neste projeto

## Primeiro uso

Na raiz do projeto:

```bash
codex
```

No Codex CLI, `/init` pode criar um `AGENTS.md`. Este kit já fornece um arquivo mais completo, portanto revise antes de substituir.

## Prompts recomendados

### Analisar o projeto

```text
Leia o AGENTS.md e os documentos indicados. Inspecione a estrutura real do projeto sem alterar arquivos. Depois produza um mapa do sistema, divergências entre código e documentação, riscos e a próxima tarefa recomendada.
```

### Implementar feature

```text
Use a skill project-feature. Implemente [feature]. Primeiro inspecione o código atual, proponha um plano curto e liste os arquivos afetados. Preserve os padrões e execute as verificações disponíveis.
```

### Corrigir bug

```text
Use a skill bug-investigation. Investigue o erro [erro]. Não aplique mudanças aleatórias. Identifique causa raiz, reproduza quando possível e faça a menor correção segura.
```

### Alterar Supabase

```text
Use a skill supabase-migration. Precisamos [mudança]. Inspecione migrations, referências e RLS antes de gerar uma nova migration.
```

### Criar workflow

```text
Use a skill n8n-workflow. Desenhe o workflow [nome], contrato de entrada/saída, autenticação, idempotência, erros e tabelas envolvidas.
```

## Feedback persistente

Quando o Codex cometer um erro recorrente:

```text
Atualize o AGENTS.md com uma regra curta para evitar que esse erro se repita.
```

Não transforme o `AGENTS.md` em documentação extensa. Detalhes devem ficar em `docs/`.
