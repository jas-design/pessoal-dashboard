FROM node:22-bookworm-slim

ENV NODE_ENV=production
WORKDIR /app

COPY workers/financial-xlsx/package.json workers/financial-xlsx/package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY src/services/financial/kawana-xlsx-parser.ts ./src/services/financial/kawana-xlsx-parser.ts
COPY src/services/financial/financial-xlsx-adapter.ts ./src/services/financial/financial-xlsx-adapter.ts
COPY src/services/financial/financial-xlsx-mappings.ts ./src/services/financial/financial-xlsx-mappings.ts
COPY src/services/financial/worker ./src/services/financial/worker
COPY scripts/financial/worker ./scripts/financial/worker

USER node
EXPOSE 8787

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8787/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["node", "--import", "tsx", "scripts/financial/worker/start.ts"]
