# Atualização de diagnóstico 13C

Estado: migration já aplicada no Supabase em 23/11/2026. Não reaplicar.
Segundo o resultado do VS Code informado em 25/11/2026, o worker 13c-diag-v1
do commit a632938 está instalado e healthy. CSV sintético e invalid_xls passaram;
o caminho de erro n8n/RPC gravou content_limit. O piloto de sucesso completo
permanece pendente; os quatro workflows 13C estão pausados. Não redefine tentativas.

## Instalação controlada
1. Pausar apenas os workflows 13C de planilhas HmrM7ehsuuUW6ia8 e OCR
   HdQgpPc4fANBr4JR. Esperar as execuções em andamento terminarem.
   Preservar o PDF 13B e os fluxos financeiros.
2. Obter esta branch do GitHub ou extrair o pacote numa NOVA pasta da VPS:
   /opt/fabio-document-content/releases/13c-diag-v1
3. No terminal, nessa pasta, executar os comandos abaixo. O Compose deste pacote
   usa imagem separada 13c-diag-v1 e usuário 1000:1000, já verificado na instalação.

```bash
cd /opt/fabio-document-content/releases/13c-diag-v1/workers/document-content
export DOCUMENT_WORKER_SECRET_PATH="$(docker inspect fabio-document-content-document-content-worker-1 --format '{{range .Mounts}}{{if eq .Destination "/run/secrets/document_worker_auth"}}{{.Source}}{{end}}{{end}}')"
test -f "$DOCUMENT_WORKER_SECRET_PATH" || exit 1
docker compose -p fabio-document-content -f compose.yml config --quiet || exit 1
docker image inspect fabio-document-content-worker:13c-diag-v1 >/dev/null 2>&1 && { echo 'Tag ja existe: conferir antes de sobrescrever'; exit 1; }
docker compose -p fabio-document-content -f compose.yml build || exit 1
docker compose -p fabio-document-content -f compose.yml run --rm --no-deps --entrypoint python document-content-worker -c 'import os,pathlib; assert os.geteuid()!=0; assert len(pathlib.Path(os.environ["DOCUMENT_WORKER_SECRET_FILE"]).read_bytes().strip())>=24; print("SEGREDO: OK")' || exit 1
docker compose -p fabio-document-content -f compose.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 120 document-content-worker
```

Se o último comando falhar, manter os workflows pausados e restaurar a imagem
anterior usando o rollback abaixo. Não apagar a release nem a imagem antiga.

```bash
printf 'services:
  document-content-worker:
    image: fabio-document-content-worker:13c-v1
' > rollback.yml
docker compose -p fabio-document-content -f compose.yml -f rollback.yml up -d --no-deps --no-build --pull never --wait --wait-timeout 120 document-content-worker
```

4. Usar os rascunhos já importados: planilhas Wie4wmsHD2fqgLtV e OCR
   2iDjzmUpN0iJIQgg, mantendo apenas uma cópia agendada de cada fila. Selecionar a credencial existente KAWANA Worker Bearer.
   Não colar tokens nos nodes. Os arquivos são exportados inativos.
5. Conferir configurações após importação: não salvar execuções manuais, com erro
   ou com sucesso; timeout 5 minutos. Planilhas 1 minuto, OCR 5 minutos.
6. Antes de publicar, validar no ambiente n8n um erro sintético conhecido e um
   caso de sucesso; conferir o código salvo pela RPC. Testes locais não substituem
   esse piloto. Reativar só após confirmar saúde, roteamento e privacidade.

As falhas esgotadas não são reprocessadas por este pacote. Preparar amostra e
tratamento específico após obter diagnóstico; não zerar todas as tentativas.
Não aumenta limites nem implementa processamento em partes.


## GitHub Actions — implantação manual

Workflow: `.github/workflows/deploy-document-content.yml`.
Script remoto: `workers/document-content/deploy-vps.sh`.

O workflow deve estar na branch padrão `main` para aparecer em Run workflow.
O PR #2 deve ser revisado e integrado antes da primeira execução. Só aceita
execução da main e implanta exatamente o SHA daquela execução, sem ref arbitrária.
Não dispara em push/PR e não instala migrations nem publica workflows n8n.

### Configuração única pelo Codex com acesso SSH existente

1. Criar uma chave Ed25519 dedicada exclusivamente ao GitHub Actions, sem
   passphrase para execução não interativa. Não reutilizar nem sobrescrever a
   chave local do operador. Não imprimir a chave privada.
2. Registrar a chave pública em root na VPS 2004641, preservando as demais.
   Usar a opção `restrict` no authorized_keys para bloquear forwarding e PTY.
   Esta chave ainda permite comandos remotos como root; limitar o acesso aos
   secrets ao ambiente de produção e às revisões aprovadas.
3. Pelo canal SSH já autenticado, obter a chave pública de host Ed25519 da VPS
   (`/etc/ssh/ssh_host_ed25519_key.pub`). Formar a linha known_hosts com o IP
   `187.127.38.70` seguido do tipo e da chave. Não confiar apenas em ssh-keyscan
   feito pelo runner. O workflow exige StrictHostKeyChecking=yes.
4. Criar o environment `fabio-vps` no GitHub, permitir somente a branch main e
   configurar revisão de implantação. Armazenar nesse environment:
   - `FABIO_VPS_SSH_KEY`: chave privada dedicada, enviada por stdin/arquivo via
     `gh secret set --env fabio-vps --repo jas-design/pessoal-dashboard`;
   - `FABIO_VPS_KNOWN_HOSTS`: linha de host previamente verificada.
   Não colocar valores no chat, em argumentos de shell, no Git ou em logs.
5. Confirmar que ambos os secrets existem sem consultar seus valores. A conexão
   Hostinger/SSH do VS Code não é compartilhada automaticamente com o Actions.

### Executar

1. Pausar as quatro cópias 13C e esperar execuções em andamento terminarem.
   Isso é uma precondição manual: o workflow não consulta nem modifica o n8n.
2. GitHub → Actions → Deploy document content worker → Run workflow → main.
   Marcar a confirmação de filas pausadas somente após essa conferência.
3. Aprovar o environment, se configurado, e acompanhar a execução. O workflow
   transmite somente os fontes do worker e verifica SHA-256 do pacote.
4. Conferir o SHA, a release e o backup informados. A release usa uma imagem nova;
   a imagem e configuração anteriores ficam preservadas. O script verifica UID,
   ausência de porta pública, segredo read-only, health, CSV e erro invalid_xls.
5. Manter as filas pausadas até concluir os pilotos de sucesso planilha/OCR no
   n8n. Só então ativar os rascunhos existentes e manter os anteriores inativos.

Falha antes da troca mantém o serviço atual. Falha durante a troca ou smoke test
aciona rollback da configuração anterior com a imagem identificada pelo ID local,
sem pull/build. Build e logs ficam somente no backup protegido da VPS. Lock na VPS
e concurrency no Actions evitam duas implantações simultâneas.

Não cancelar a execução durante a troca. Sinais normais acionam rollback, mas
queda da VPS, SIGKILL ou perda abrupta da sessão não garantem recuperação automática.
Nesses casos, verificar saúde por SSH e usar o compose.json preservado no backup
(com DOCUMENT_WORKER_SECRET_PATH configurado, se necessário). Não apagar releases
ou imagens antigas até concluir a validação.

Validação local: sintaxe Bash/YAML e seis cenários com Docker simulado (sucesso,
falha de build, preflight, subida, smoke test e rollback). Isso não comprova uma
execução real pelo Actions. Graphify indisponível nesta sessão; grafo não atualizado.

Referências: https://docs.github.com/en/actions/how-tos/manage-workflow-runs/manually-run-a-workflow
 e https://docs.github.com/en/actions/how-tos/write-workflows/choose-what-workflows-do/use-secrets
