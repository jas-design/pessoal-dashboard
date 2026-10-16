---
version: alpha
name: "FABIO Dashboard"
description: "Dashboard executivo privado de alta densidade, com superfícies sóbrias e acentos funcionais."
colors:
  background: "#fcf8ff"
  surface: "#ffffff"
  surface-muted: "#f5f2fe"
  text: "#1b1b23"
  text-secondary: "#464554"
  primary: "#4648d4"
  success: "#2ca01c"
  danger: "#ba1a1a"
typography:
  sans:
    fontFamily: "var(--font-family-base)"
rounded:
  control: "10px"
  card: "14px"
  pill: "999px"
spacing:
  compact: "8px"
  default: "16px"
  section: "24px"
components:
  button: {}
  card: {}
  dialog: {}
  table: {}
  input: {}
---

# FABIO Dashboard Design System

## Overview

### Creative North Star

Uma mesa executiva organizada: dados densos, superfícies discretas e sinais de
estado claros, sem decoração que concorra com documentos e números.

### Product context and register

- **Audience and primary job:** cliente privado consultando documentos, operações e dados financeiros.
- **Target market(s) and evidence:** contexto brasileiro e interface existente em português.
- **Locale(s) and language policy:** português do Brasil; datas e números seguem `pt-BR`.
- **Usage scene:** uso recorrente em desktop, com suporte responsivo para consultas móveis.
- **Register:** produto administrativo autenticado.
- **Memorable signature:** acentos verdes e violetas orientam origem, estado e ação sobre superfícies contidas.
- **Restraint:** tabelas, filtros e navegação priorizam legibilidade e previsibilidade.
- **Anti-references:** landing pages promocionais, glassmorphism intenso e componentes ornamentais.
- **Token ownership/runtime mapping:** este arquivo documenta os tokens canônicos existentes em `src/styles/base/_tokens.scss`; não gera CSS.

## Colors

As superfícies usam `background`, `surface` e `surface-muted`. Texto usa
`text` e `text-secondary`. `primary` identifica ação e foco; `success` e
`danger` mantêm significado semântico. Novas telas devem reutilizar os tokens
SCSS existentes em vez de duplicar valores.

## Typography

A família canônica é `var(--font-family-base)`, definida pela camada de
tipografia existente. Pesos altos são reservados a títulos, rótulos e dados que
precisam de leitura rápida; texto auxiliar permanece compacto e legível.

## Layout

O shell mantém sidebar, header e conteúdo fluido. Cards usam intervalos de 16 a
24 pixels e grids que colapsam para uma coluna nos breakpoints já existentes.
Tabelas mantêm HTML semântico e rolagem horizontal no próprio painel em telas
estreitas.

## Elevation & Depth

Hierarquia é criada por contraste tonal, bordas sutis e `--shadow-card`.
Diálogos usam `--shadow-elevated`; elementos internos não criam novas camadas
sem necessidade funcional.

## Shapes

Controles usam raio de 10 pixels, cards 14 pixels e tabs/badges usam formato
pill. Ícones e indicadores seguem a mesma família de raios.

## Components

### Foundational visual states

Controles interativos expõem hover, foco visível, ativo, desabilitado e ocupado.
Carregamento, vazio e erro preservam o espaço e explicam a recuperação possível.

### Buttons and actions

`button-primary`, `button-secondary` e `button-small` formam a hierarquia
existente. Ações destrutivas usam intenção de perigo e ficam separadas das ações
seguras.

### Navigation and data display

Tabs usam seleção textual e cromática. Breadcrumbs refletem hierarquia real.
Tabelas paginam conjuntos extensos e preservam ações, estados e leitura em telas
estreitas.

### Forms and overlays

Campos usam os tokens de input existentes. Erros ficam próximos ao contexto que
falhou. Diálogos usam elementos nativos com título e fechamento identificável.

### Iconography

O projeto usa símbolos simples e texto; ações ambíguas mantêm rótulos visíveis e
controles apenas com ícone recebem nome acessível.

### Motion

Transições curtas comunicam hover, foco e expansão. Movimento decorativo não faz
parte do produto e preferências de redução de movimento devem ser respeitadas.

### Content and data visualization

O texto é direto e operacional. Datas usam `pt-BR`; estados nunca dependem
somente de cor e gráficos preservam rótulos ou alternativas textuais.

## Do's and Don'ts

- **Do:** reutilizar tokens, componentes e vocabulário existentes.
- **Do:** manter loading, vazio, erro e recuperação em fluxos assíncronos.
- **Don't:** introduzir nova paleta ou tipografia em uma feature isolada.
- **Don't:** esconder ações ou valores importantes apenas em hover.
