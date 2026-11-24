# Atualização de diagnóstico 13C

Estado: migration já aplicada no Supabase em 23/11/2026. Não reaplicar.
Worker de diagnóstico ainda não implantado. Workflows de diagnóstico importados
como rascunhos inativos; implantação e piloto pendentes. Não redefine tentativas.

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
