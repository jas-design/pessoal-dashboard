# Etapa 07B — auditoria de segurança e contratos SQL da revisão financeira

## Escopo

Esta etapa compara o frontend e as migrations locais, propõe o contrato de autorização e prepara um inventário somente leitura. Nenhum SQL de alteração foi executado, nenhuma migration foi criada/aplicada e a interface permanece sem chamadas de decisão.

Script preparado: `scripts/supabase/07b-financial-review-inventory.sql`.

## Estado do inventário remoto

Em 17/10/2026, a execução somente leitura pelo vínculo local foi tentada com:

```text
npm run supabase -- db query --linked --file scripts/supabase/07b-financial-review-inventory.sql
```

A CLI falhou antes de executar o arquivo, ao tentar criar a função temporária de
login, com falha de autenticação para `supabase_admin`. Nenhuma consulta do
inventário chegou ao banco e nenhum estado remoto foi alterado.

Assim, não estão confirmados no ambiente real: objetos existentes, colunas,
constraints, owners, RLS, policies, grants, overloads, corpos das funções,
`search_path`, triggers, vínculos de usuários e histórico de migrations. O
vínculo local deve ser regularizado pelo responsável, sem compartilhar senha,
token ou arquivo `.env`; depois, este mesmo script pode ser executado no projeto
correto pelo SQL Editor ou pela CLI autenticada.

### Comparação local x real

| Item | Definição local versionada | Ambiente real |
| --- | --- | --- |
| `company_members` | criação, RLS, policies e grants presentes | não confirmado |
| `companies` | policy de leitura adicionada; criação/RLS ausentes | não confirmado |
| tabelas financeiras | policies/grants parciais; criação/RLS ausentes | não confirmado |
| quatro RPCs públicas | assinaturas referenciadas, corpos ausentes | não confirmado |
| implementações privadas | corpos e grants presentes | não confirmado |
| `is_admin` | consulta somente o próprio perfil, com `search_path` fixo | corpo, owner, grants e usos não confirmados |
| histórico de migrations | três arquivos locais | versões aplicadas não confirmadas |

Não há evidência suficiente para afirmar convergência ou divergência do banco
real. A comparação deve ser concluída com a saída do inventário, nunca por
inferência a partir do dropdown da interface ou do sucesso de uma RPC.

## Diagnóstico local

### Histórico não reproduzível

O repositório contém somente três migrations. Não há criação versionada para:

- `public.companies`;
- `public.documents`;
- `public.financial_extracted_rows`;
- `public.financial_extraction_jobs`;
- `public.financial_review_audit`;
- `public.financial_review_document_policy`;
- `public.financial_transactions`;
- wrappers públicos `finance_review_list`, `finance_review_history`, `finance_review_decide` e `finance_review_set_document_role`;
- schema `financial_private` e seus grants de `USAGE`.

As migrations de 16/10/2026 pressupõem que esses objetos e policies anteriores já existam. Uma instalação limpa pode falhar antes de chegar ao estado esperado. O código/migration disponível é a fonte operacional local, mas não prova o estado de produção.

### Riscos por prioridade

#### P0 — confirmar antes de qualquer migration

1. `companies` e `financial_transactions` recebem `SELECT` para `authenticated`. Isso só é seguro se RLS estiver habilitada e todas as policies forem restritivas. As migrations locais não executam `ENABLE ROW LEVEL SECURITY` nesses objetos.
2. As quatro funções `financial_private.*_impl` recebem `EXECUTE` para `authenticated`. Se o schema privado também conceder `USAGE`, clientes podem chamar implementações internas diretamente. Mesmo com validações atuais, isso duplica a superfície pública e dificulta evolução segura.
3. Os wrappers públicos não estão versionados. Não é possível confirmar se são `SECURITY INVOKER`/`DEFINER`, se fixam `search_path`, se apenas delegam às implementações ou se possuem overloads/grants adicionais.
4. O estado remoto das tabelas, funções, owners, grants, policies e assinaturas ainda precisa ser inventariado. Não se deve criar objetos “faltantes” apenas porque não aparecem no Git.

#### P1 — contrato de autorização

1. `finance_review_list_impl` e `history_impl` autorizam leitura para `owner`, `admin`, `reviewer` e `viewer`; usuários autenticados sem vínculo recebem lista vazia, não um estado explícito de acesso.
2. `finance_review_decide_impl` permite decisão a `owner`, `admin` e `reviewer`. `viewer` é somente leitura. Registros sem empresa podem ser rejeitados pelo proprietário da linha, mas não aprovados.
3. `finance_review_set_document_role_impl` permite classificação ao proprietário do documento sem exigir explicitamente uma única empresa vinculada. Para não proprietários, exige uma empresa e papel `owner`/`admin`. Documentos multiempresa ou sem linha financeira precisam de regra explícita.
4. `public.is_admin()` verifica um papel global em `profiles`, mas não participa das regras das RPCs. É necessário decidir se administrador global é apenas operacional ou se pode atravessar empresas. O padrão recomendado é não conceder acesso financeiro global implicitamente.
5. As RPCs usam a relação `companies.owner_id = financial_extracted_rows.owner_id`. É preciso confirmar se jobs criados por membros armazenam o proprietário da empresa ou o usuário executor; uma divergência pode ocultar linhas legítimas ou quebrar isolamento.
6. `company_access_role()` é `SECURITY DEFINER` e deve permanecer com `search_path` fixo, owner confiável e retorno mínimo. Seus grants e usos por outras policies precisam ser inventariados.

#### P2 — dados e paginação

1. A listagem aceita somente status, limite e offset; os demais filtros da 07A atuam sobre 20 itens já carregados.
2. Offset com ordenação por `created_at, id` é estável para uma consulta, mas inserções concorrentes podem deslocar páginas. Cursor é preferível quando o volume crescer.
3. A resposta não possui provider/origem externa, warnings, célula, fórmula, versão do mapeamento, parser/schema ou chave idempotente.
4. Não é possível presumir que esses campos estejam persistidos. Primeiro o inventário deve confirmar colunas JSON/relacionais e suas constraints.

## Matriz de acesso esperada

| Ator | Ver empresa/linhas | Histórico | Aprovar/rejeitar | Classificar fonte |
| --- | --- | --- | --- | --- |
| `anon` | negar | negar | negar | negar |
| autenticado sem vínculo | negar sem revelar existência | negar | negar | negar |
| proprietário da empresa | permitir no próprio escopo | permitir | permitir | permitir |
| membro `admin` | permitir no escopo vinculado | permitir | permitir | permitir |
| membro `reviewer` | permitir no escopo vinculado | permitir | permitir | negar |
| membro `viewer` | permitir no escopo vinculado | permitir | negar | negar |
| administrador global | negar por padrão; acesso financeiro exige vínculo explícito | igual | igual | igual |
| membro de empresa A consultando B | negar sem revelar existência | negar | negar | negar |
| `service_role` | somente processos server-side aprovados e auditados | conforme caso | não usar pela UI | não usar pela UI |

Para linhas ainda sem `company_id`, somente o proprietário atual pode visualizar e rejeitar; aprovação e publicação permanecem bloqueadas até vínculo explícito e auditado. Não atribuir empresa automaticamente pelo nome extraído.

## Modelo proposto de autorização

Manter `companies.owner_id` como proprietário legado e `company_members(company_id, user_id, role)` como vínculo explícito. Uma única função server-side deve calcular o papel efetivo:

```text
owner da empresa -> owner
membro ativo -> admin | reviewer | viewer
demais usuários -> sem acesso
```

Regras recomendadas:

- `can_view`: papel efetivo em `owner`, `admin`, `reviewer`, `viewer` e coerência entre empresa, documento, linha e owner legado;
- `can_decide`: `can_view`, papel em `owner`, `admin`, `reviewer`, status pendente, revisão atual, documento disponível, ETag atual e demais validações da ação;
- `can_classify`: `can_view`, papel em `owner`, `admin`, documento não excluído, escopo empresarial único e ausência de linhas aprovadas incompatíveis;
- administrador global não ignora vínculo por padrão;
- browser nunca fornece `user_id` nem autoridade; todas as capacidades derivam de `auth.uid()` no banco;
- funções públicas expõem somente wrappers revisados; implementações privadas não concedem execução direta a `anon` ou `authenticated`.

`can_decide` pode ser `false` para uma linha já aprovada/rejeitada. `can_classify` deve ser calculado por documento e repetido na linha somente para simplificar o contrato de leitura.

## Contrato futuro da listagem

Proposta compatível por evolução versionada da RPC ou nova RPC `v2`:

```text
entrada:
  p_status
  p_company_id opcional
  p_document_id opcional
  p_period_month opcional (AAAA-MM)
  p_origin opcional (provider/source ou aba, definidos separadamente)
  p_limit (1..100)
  p_cursor_created_at opcional
  p_cursor_id opcional

saída:
  total ou has_more
  next_cursor
  items[]
    campos atuais
    capabilities: { can_view, can_decide, can_classify }
    capability_reasons[] com códigos seguros
```

Todos os filtros devem ser aplicados depois da autorização no mesmo SQL usado para contagem/paginação. `company_id` solicitado não concede acesso; apenas restringe o conjunto já autorizado. Documento, empresa e linha devem ser relacionados no banco, não por metadado do frontend.

Para compatibilidade, manter a RPC atual durante a transição ou adicionar parâmetros com defaults somente se a assinatura exposta pelo PostgREST for validada. A 07A continuará ignorando capacidades até aprovação específica para reabilitar ações.

## Evidências do `financial-extraction.v1`

Expor somente quando o inventário confirmar persistência real:

| Campo de revisão | Origem preferida | Regra |
| --- | --- | --- |
| warnings | job/extração versionada ou tabela filha | array validado, sem instruções executáveis |
| célula | evidência da linha | aba + endereço; manter `source_row` por compatibilidade |
| fórmula | evidência da linha | texto informativo, nunca executar no browser/banco |
| mapping | job/extração | ID, versão e parser version imutáveis para a revisão |
| logical key | linha extraída | `UNIQUE` no escopo correto para idempotência |
| schema version | job/extração | aceitar somente versões suportadas |

Se hoje existirem apenas JSONs, primeiro documentar schema, limites de tamanho e índices necessários. Não duplicar em colunas até confirmar consultas e compatibilidade com o workflow.

## Plano de migrations, ainda não executado

1. Executar e salvar de forma restrita o inventário 07B; comparar com Git sem publicar dados.
2. Criar uma baseline corretiva apenas para objetos realmente existentes, usando definições obtidas do catálogo e histórico remoto. Não editar migrations já aplicadas.
3. Criar migration de hardening separada: RLS/grants, revogação de execução interna, owners/search paths e políticas por empresa.
4. Criar migration de contrato: RPC de listagem versionada, capacidades e filtros server-side. Manter wrappers antigos durante a compatibilidade.
5. Criar migration de evidências somente se o inventário confirmar o armazenamento e a fonte de verdade.
6. Atualizar frontend/workflow em etapa posterior, testar e somente então retirar assinaturas antigas.

Rollback:

- cada migration deve ser transacional;
- antes do hardening, registrar grants, policies e definições atuais para restauração controlada;
- não apagar `company_members`, owners, auditoria, decisões ou evidências;
- rollback de contrato restaura wrappers anteriores e mantém a nova função inativa;
- alterações de coluna devem ser aditivas; remoção somente após janela de compatibilidade;
- se o hardening revelar dependência legítima, restaurar o grant mínimo do wrapper, nunca acesso amplo às tabelas.

## Matriz de testes planejada

Executar com usuários sintéticos e transação revertida, sem dados financeiros reais:

1. `anon` não executa as quatro RPCs nem lê tabelas financeiras.
2. autenticado sem vínculo não descobre empresa, documento, linha ou histórico.
3. owner da empresa A não acessa empresa B.
4. `admin` da empresa A vê/decide/classifica somente A.
5. `reviewer` de A vê e decide A, mas não classifica e não acessa B.
6. `viewer` de A apenas vê A e histórico permitido.
7. global admin sem vínculo segue negado, salvo decisão explícita diferente.
8. linha sem empresa: apenas owner vê/rejeita; ninguém aprova.
9. documento excluído, ETag divergente, revisão desatualizada ou fonte não primária bloqueiam aprovação.
10. documento sintético `TESTE_` não vira fonte primária nem é aprovado.
11. documento multiempresa não é classificado até regra explícita.
12. filtros não atravessam empresa e contagem/paginação correspondem exatamente ao conjunto autorizado.
13. chamada direta a `financial_private.*` por `anon`/`authenticated` é negada.
14. repetição da mesma chave idempotente não cria segunda linha.
15. histórico registra ator, motivo, valor anterior/novo e ETag sem expor outro tenant.

## Aprovações necessárias

1. Confirmar a matriz de papéis, especialmente o comportamento de administrador global e linhas sem empresa.
2. Autorizar a execução do inventário no projeto correto e o armazenamento restrito do resultado.
3. Validar se owner legado é sempre o owner da empresa nos jobs/documentos atuais.
4. Escolher RPC atual com evolução compatível ou nova RPC versionada.
5. Aprovar o modelo de paginação: offset inicial ou cursor desde a primeira correção.
6. Definir a fonte de verdade para warnings/evidências e sua retenção.
7. Aprovar uma futura baseline corretiva e, separadamente, o hardening; nenhuma delas foi criada nesta etapa.
