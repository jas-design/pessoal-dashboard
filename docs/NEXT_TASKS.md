# Próximas tarefas recomendadas

Esta sequência prioriza evidência e segurança. Cada etapa deve atualizar
`docs/STATUS.md` com o que foi realmente verificado. Nenhuma etapa autoriza
deploy, alteração de banco ou ativação de workflow por si só.

Baseline local em 2026-11-21: check e build concluídos, 104 testes aprovados e
3 testes de integração real ignorados. Repetir essa baseline após alterações de
código.

## 1. Inventariar ambientes externos em modo somente leitura

- GitHub: confirmar branch padrão, commit remoto e proteções.
- Supabase: listar migrations aplicadas, RPCs, policies e grants sem alterá-los.
- n8n: comparar exports locais com workflows importados e manter tudo inativo.
- Hostinger: confirmar containers, rede, recursos e health checks.
- Microsoft: confirmar App Registration, permissões e saúde da autenticação sem
  copiar tokens.

**Saída esperada:** matriz ambiente x commit/versão/estado, sem credenciais.

## 2. Reconciliar contratos Supabase

- Resolver a divergência documental dos clientes Supabase.
- Comparar as migrations versionadas com o schema real.
- Confirmar disponibilidade e ACLs das RPCs financeiras.
- Manter produção em No-Go se backup, preflight ou autorização estiverem
  incompletos.

**Saída esperada:** plano forward-only revisado e gates objetivos de Go/No-Go.

## 3. Validar o pipeline financeiro em ambiente isolado

- Subir o worker privado com segredo de teste e sem porta pública.
- Executar os workflows locais inativos com fixture sintética.
- Confirmar idempotência, timeout, limite de arquivo, logs seguros e
  `publishable: false` antes da revisão.
- Validar persistência, revisão e publicação com dados sintéticos.

**Saída esperada:** evidência ponta a ponta local/staging, sem dados reais.

## 4. Preparar um piloto remoto controlado

- Confirmar backup recuperável e janela aprovada.
- Importar workflow mantendo `Inactive` e `Manual Trigger`.
- Selecionar credenciais existentes no cofre do n8n.
- Processar um único documento autorizado e verificar que a repetição não cria
  duplicidade.
- Fazer rollback ao primeiro desvio de identidade, autorização ou auditoria.

**Saída esperada:** piloto auditável com decisão explícita de continuar ou parar.

## 5. Consolidar OneDrive e observabilidade

- Implementar/confirmar health check real separado do estado registrado na
  tabela `integrations`.
- Confirmar sincronização idempotente, hierarquia por drive, delta/retry e
  atualização de `last_sync_at`.
- Exibir estados degradados sem revelar detalhes sensíveis.

**Saída esperada:** integração observável e estados externos confiáveis na UI.

## 6. Preparar o deploy do dashboard

- Confirmar a estratégia Astro atual e a necessidade de SSR/endpoints
  server-side para operações sensíveis.
- Configurar variáveis no provedor, executar build e validar autenticação/RLS.
- Fazer smoke tests de login, dashboard, documentos, financeiro, revisão,
  notificações e configurações.

**Saída esperada:** release candidata ligada a um commit e checklist de rollback.

## 7. Retomar funcionalidades posteriores

Somente após a base operacional estar confirmada:

1. Outlook e rascunhos com aprovação;
2. extração de PDF/DOCX;
3. comparação de documentos;
4. RAG com fontes e auditoria;
5. agente roteador com ferramentas allowlisted;
6. executor de aprovações para ações sensíveis.
