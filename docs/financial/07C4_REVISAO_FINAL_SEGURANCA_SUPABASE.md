# Etapa 07C.4 — revisão final de segurança do Supabase KAWANA

> Relatório histórico. Os blocos 07C5 resolveram parte das pendências; a
> conclusão atual está em `07C6_VALIDACAO_FINAL_RPCS_MIGRATIONS.md`.

## Evidência confirmada

Foram analisados localmente os blocos A, B, C, F, G e H mantidos em
`.local/supabase/07c/`. Nenhum SQL foi executado.

- Bloco F usa exatamente `d.company_id IS DISTINCT FROM f.company_id` e retorna
  quatro linhas divergentes. Owner de documento/linha, owner de empresa e owner
  de job não divergem.
- `financial_private` pertence a `postgres`; somente `authenticated` possui
  `USAGE` entre os papéis de cliente inventariados.
- `public.is_admin()` é `SECURITY DEFINER`, owner `postgres`, usa
  `search_path=public` e retorna verdadeiro somente para perfil admin ativo.
- `companies`, `documents` e `financial_transactions` possuem grants efetivos
  amplos. RLS continua sendo a barreira de linha.
- As policies de `documents` preservam acesso global de admins ativos para
  leitura, atualização e exclusão.
- `finance_claim_next_document` e `finance_complete_document` aparecem no
  inventário transversal, mas seus corpos e ACLs não estão nos CSVs recebidos.

## Diagnóstico das quatro divergências

A causa imediata está comprovada: em quatro linhas, `documents.company_id` e
`financial_extracted_rows.company_id` não são iguais sob semântica null-safe.
Isso inclui uma destas situações: empresa ausente no documento, empresa ausente
na linha ou dois UUIDs diferentes.

O inventário agregado não identifica qual situação ocorreu, quais documentos
estão envolvidos nem qual processo gravou o valor. Não é possível atribuir as
linhas ao arquivo `TESTE_FINANCEIRO_KAWANA_2026-10.csv` sem executar a consulta
somente leitura preparada em
`scripts/supabase/07c4-financial-company-divergences.sql`.

A RPC `finance_complete_document` é uma possível produtora porque o Bloco C
confirma referências a documentos, empresas e objetos financeiros, mas isso não
prova causalidade. Seu corpo e a configuração do workflow 04 são necessários.

## Achados de segurança

### Alto — associação empresarial divergente

Cenário: membros podem receber linhas ocultas ou escopo empresarial incorreto;
uma decisão poderia atingir empresa diferente da definida no documento.

Correção mínima já proposta: membros só enxergam linhas coerentes e decisão ou
classificação é bloqueada em divergência. O owner conserva leitura diagnóstica.
Nenhum dado é corrigido ou inferido automaticamente.

### Alto — acesso global a documentos financeiros por `is_admin()`

Cenário: as policies gerais de `documents` permitem que admin ativo acesse todo
documento, inclusive potencialmente financeiro. Remover esse caminho agora
quebraria administração legítima de documentos, OneDrive e outros módulos.

Correção mínima futura: definir um predicado comprovado que diferencie documento
financeiro e separar a autorização financeira da administração geral. Até lá,
as migrations 07C não alteram policies de `documents`. As RPCs de revisão não
usam `is_admin()` e, portanto, admin global sem vínculo não decide nem classifica.

### Médio — grants amplos mitigados por RLS

`anon` e `authenticated` possuem grants efetivos amplos em `companies`,
`documents` e `financial_transactions`. As policies atuais limitam linhas, mas
o modelo depende fortemente de RLS. A primeira migration agora remove de
`companies` os quatro privilégios inventariados desnecessários, sem afetar
`service_role`. Os outros objetos ficam fora de escopo até seus consumidores e
policies serem revisados.

### Médio — `is_admin()` com `search_path=public`

A função qualifica `public.profiles` e `auth.uid()`, mas uma função
`SECURITY DEFINER` com schema público no path merece hardening. O risco depende
de quem possui `CREATE` em `public`, informação ainda ausente. O Bloco 3 da nova
consulta coleta essa evidência. Nenhuma mudança foi feita na função para não
afetar módulos globais.

## Revisão das migrations

1. `20261016120000_create_company_members.sql`: preserva owner em
   `companies.owner_id`, mantém papéis delegados e agora conserva visibilidade
   administrativa de empresas por `is_admin()` sem conceder capacidades
   financeiras. Revoga somente os quatro grants de `companies` comprovados como
   desnecessários para `anon`/`authenticated`.
2. `20261016121000_secure_financial_review_access.sql`: mantém assinaturas e
   JSON, ETag, revisão otimista, `TESTE_`, auditoria e bloqueio de divergência.
   Não concede bypass a admin global.
3. `20261017120000_protect_financial_private.sql`: os guards agora coincidem com
   owner e `search_path` reais. Os wrappers viram `SECURITY DEFINER` antes da
   retirada do acesso privado. Nenhum papel de API recebe acesso privado direto;
   chamadas sem `auth.uid()` continuam rejeitadas.

## Baseline e rollback

A baseline versionada restaura exatamente os oito corpos de revisão, owners e
ACLs comprovados. Não inclui tabelas, dados ou ACLs cuja origem do grant não foi
inventariada.

O rollback continua parcial:

- restaura o estado invoker e acesso privado de `authenticated`;
- restaura a policy ampla original de `companies` e os quatro privilégios
  efetivos confirmados no Bloco A;
- não remove `company_members` ou funções `company_*`;
- não desfaz vínculos criados depois da aplicação;
- não restaura as RPCs antigas sem executar separadamente a baseline;
- restaura um legado menos seguro, inclusive acesso `anon` aos wrappers se a
  baseline funcional for usada integralmente.

Não existe rollback integral comprovado para toda a camada 07C.

## Matriz de staging

1. Owner A: visualiza/decide/classifica A; não acessa B.
2. Admin empresarial A: visualiza/decide/classifica A; não acessa B.
3. Reviewer A: visualiza/decide A; não classifica nem acessa B.
4. Viewer A: somente visualiza A.
5. Usuário sem vínculo: não acessa A/B por RPC ou UUID conhecido.
6. Admin global sem vínculo: administra metadados gerais permitidos, mas não
   recebe linhas, histórico, decisão ou classificação financeira de A/B.
7. `anon`: não executa wrappers financeiros; grants de tabela não atravessam
   RLS.
8. `service_role`: não usa `financial_private` diretamente; validar chamadas do
   workflow 04 e o comportamento sem `auth.uid()`.
9. Quatro cenários de coerência: ambos nulos, ambos iguais, documento nulo/linha
   preenchida e UUIDs diferentes.
10. ETag antiga, revisão antiga, documento excluído, `TESTE_` e fonte não
    primária permanecem bloqueados.
11. Retry não duplica decisão nem auditoria.
12. Workflow 04: claim, conclusão, retry e falha devem manter document/row
    company coerentes e não alterar contratos públicos.
13. Rollback parcial e baseline funcional devem ser ensaiados separadamente.

## Evidências ainda necessárias

1. Resultado dos blocos 1 e 2 da consulta 07C.4 para identificar as quatro
   linhas e confirmar ou negar o arquivo fictício.
2. Resultado do Bloco 3: owner e `CREATE` no schema `public`.
3. Resultado do Bloco 4: corpos e ACLs de `finance_claim_next_document` e
   `finance_complete_document`.
4. Configuração não secreta do workflow 04: RPCs chamadas, papel JWT efetivo e
   mapeamento de `document_id`/`company_id`. Não fornecer tokens ou credenciais.
5. Critério real que identifica documentos financeiros dentro de `documents`,
   antes de propor policy específica sem quebrar outros módulos.

## Veredito

**Não pronto para iniciar aplicação das migrations em staging.** O SQL de
revisão e o isolamento do schema privado estão compatíveis com o inventário,
mas a origem das quatro divergências e o contrato das duas RPCs do workflow 04
ainda não foram comprovados. Assim que os quatro blocos da consulta 07C.4 e a
configuração não secreta do workflow forem revisados, o conjunto poderá seguir
para um ensaio controlado com dados sintéticos.
