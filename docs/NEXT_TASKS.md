# Próximas tarefas recomendadas

Prioridade atual: apresentar dados financeiros reais de janeiro a setembro de
2026 sem reprocessar documentos já extraídos.

Baseline remota de 2026-11-25: 5.230 documentos, 40 fatos extraídos, 36 fatos
em revisão, janeiro-agosto pendentes e setembro publicado. Nenhuma etapa abaixo
autoriza aprovação ou publicação sem validação documental e autorização
específica.

## 1. Validar setembro no produto

- Abrir Dashboard e Financeiro sob sessão autenticada.
- Selecionar empresa Kawana e setembro de 2026.
- Conferir cards, gráficos, estado de publicação, filtros, console e consultas.
- Registrar valores somente em evidência restrita; documentação compartilhada
  deve usar resultado sanitizado.

**Gate:** setembro deve ser lido de `financial_monthly_metrics_published` sem
erro de RLS ou fallback indevido para métricas legadas.

## 2. Preparar revisão de janeiro

- Usar a matriz já preparada em
  `docs/financial/FINANCIAL_DELIVERY_REVIEW_2026.md`; não repetir a extração.
- Abrir o documento canônico v2 de janeiro e conferir visualmente `B23`, `B8`,
  `B6` e `B10` nas abas registradas.
- Isolar qualquer fato legado v1, documento secundário, versão antiga, ETag
  divergente ou competência ambígua.
- Produzir a matriz de revisão e solicitar autorização específica.

**Gate:** exatamente um documento primário atual, quatro métricas canônicas e
nenhuma divergência aberta.

## 3. Aprovar e publicar janeiro somente após autorização

- Aprovar fatos individualmente por `finance_review_decide`, com justificativa
  e revisão esperada.
- Confirmar que aprovação não atualizou o Dashboard automaticamente.
- Executar server-side `finance_publish_monthly_metrics` com empresa,
  competência, IDs aprovados e ator autorizado.
- Reconsultar status, linha publicada e Dashboard; repetir a consulta para
  confirmar idempotência antes de avançar para fevereiro.

**Rollback lógico:** não alterar fatos extraídos; interromper ao primeiro erro
de identidade, RLS, ETag, digest, competência ou cálculo.

## 4. Expandir fevereiro-agosto

- Repetir o gate de janeiro mês a mês.
- Antes de junho-agosto, resolver documentalmente a divergência entre receita
  em `B24` no banco e `B23` no parser/workflow versionados.
- Manter os quatro fatos legados v1 de agosto/setembro separados dos canônicos
  v2; não usá-los para completar meses sem rastreabilidade equivalente.
- Ao final, validar a série janeiro-setembro no Dashboard e Financeiro.

## 5. Corrigir segurança do n8n em janela própria

- Confirmar que o domínio público funciona exclusivamente pelo Traefik antes de
  remover o bind direto `32768`.
- Associar firewall Hostinger com SSH restrito e HTTP/HTTPS públicos, validando
  IPv4 e IPv6 e preservando a rede Docker interna.
- Configurar a variável de proxy confiável compatível com a versão do n8n e a
  quantidade real de proxies; validar rate limiting após a mudança.
- Adicionar healthcheck Docker ao n8n usando endpoint local estável e sem
  credenciais.
- Fazer backup do compose e preparar rollback antes de qualquer aplicação.

## 6. Corrigir workflows de conteúdo sem duplicatas

- Inspecionar 13B e relacionar os warnings PDF ao node responsável.
- Comparar as quatro cópias 13C e escolher um par canônico antes do piloto.
- Atualizar nomes somente depois da validação; não reimportar duplicatas.
- Manter 13C inativo até piloto explícito de planilha e OCR.

## 7. Renovar a baseline local

- Executar `npm run check` e `npm run build`.
- Executar `npm run test:financial-parser` e suites complementares relevantes.
- Contabilizar testes aprovados, falhos e ignorados separadamente.
- Atualizar `docs/STATUS.md` com resultados e bloqueios observados.
