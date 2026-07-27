# Contexto do projeto

## Visão do produto

O produto é um dashboard executivo privado, inicialmente para um único cliente. Ele funciona como uma central administrativa e uma “secretária de IA”.

O cliente poderá:

- consultar arquivos do OneDrive;
- visualizar arquivos privados enviados ao Supabase Storage;
- pesquisar documentos por linguagem natural;
- comparar contratos, planilhas e relatórios;
- detectar inconsistências;
- consultar e organizar e-mails;
- visualizar dados financeiros;
- receber alertas e relatórios;
- aprovar ações sugeridas pelos agentes;
- acompanhar logs e histórico.

## Escopo atual

Tudo ficará hospedado ou coordenado pela infraestrutura na Hostinger, exceto serviços cloud utilizados por API:

- dashboard Astro na Hostinger;
- n8n na Hostinger;
- Supabase Cloud;
- Microsoft 365 / Microsoft Graph;
- provedor de IA via API.

OpenClaw não é necessário nesta fase.

## Usuários

- Uso privado.
- Um cliente principal.
- Arquitetura deve permitir múltiplos usuários e níveis de acesso futuramente.
- Não é um SaaS público nesta fase.

## Estado conhecido do dashboard

O projeto já possui ou já trabalhou nas seguintes áreas:

- login com Supabase;
- proteção de páginas;
- dashboard;
- notificações;
- automações;
- logs;
- sistema;
- documentos;
- upload de arquivos privados;
- catálogo de documentos;
- gráficos e métricas;
- estrutura Astro + SCSS + TypeScript;
- integração futura com n8n.

Antes de editar, o Codex deve confirmar a estrutura real no repositório.

## Princípios do produto

1. Segurança antes de autonomia.
2. Aprovação humana para ações sensíveis.
3. Dados financeiros estruturados antes de análise por IA.
4. OneDrive como fonte original para documentos Microsoft.
5. Supabase como memória operacional, catálogo e auditoria.
6. n8n como orquestrador.
7. Astro como interface e camada server-side.
8. IA como interpretadora, classificadora e explicadora.
9. SQL/TypeScript como fonte de cálculos determinísticos.
10. Implementação incremental, sem overengineering.

## Fora de escopo por enquanto

- OpenClaw;
- aplicativo mobile;
- SaaS multiempresa completo;
- execução autônoma irrestrita;
- envio automático irrestrito de e-mails;
- exclusão automática de documentos;
- movimentação financeira;
- substituição de sistemas contábeis;
- acesso bancário direto sem projeto específico de segurança.
