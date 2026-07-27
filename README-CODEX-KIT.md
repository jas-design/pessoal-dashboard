# Kit Codex — instalação

## Onde colocar

Copie o conteúdo deste kit para a raiz do projeto Astro.

Estrutura:

```text
projeto/
  AGENTS.md
  PROMPTS.md
  .env.example
  docs/
  .agents/
    skills/
```

Não substitua seu `.env`. Use apenas `.env.example` como referência.

## Primeiro passo recomendado

Abra o projeto no VS Code e peça:

```text
Leia o AGENTS.md e execute o prompt “Auditoria inicial” de PROMPTS.md. Não altere arquivos.
```

Depois atualize os documentos com os nomes reais das tabelas, páginas e workflows.

## Skills

As skills possuem `SKILL.md` com frontmatter YAML.

Elas são específicas do projeto e devem permanecer versionadas no repositório.

## Manutenção

- regras curtas e obrigatórias: `AGENTS.md`;
- explicações e arquitetura: `docs/`;
- processos repetíveis: `.agents/skills/`;
- prompts de início: `PROMPTS.md`;
- secrets reais: `.env`, nunca versionado.
