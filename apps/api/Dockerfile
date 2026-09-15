# ── VPC Music API — Self-contained build ──────────
# Build context: apps/api/  (no monorepo root needed)
# The vendored shared/ directory is a copy of the workspace
# shared package.  Run `scripts/sync-shared.ps1` after
# changing root shared/ files.
# ---------------------------------------------------

FROM node:22-alpine
WORKDIR /app

# ── Install dependencies ──────────────────────────
# 1. Copy package.json & vendored shared package
COPY package.json ./
COPY shared/ ./shared/

# 2. Rewrite the workspace reference to a local file path
#    so npm can resolve it without a pnpm workspace
RUN sed -i 's/"workspace:\*"/"file:.\/shared"/g' package.json

# 3. Install production deps (shared resolves via file: link)
RUN npm install --omit=dev

# ── Copy application code ─────────────────────────
COPY src/ ./src/
COPY drizzle/ ./drizzle/
COPY drizzle.config.js ./

# ── Runtime ───────────────────────────────────────
ENV NODE_ENV=production
EXPOSE 3001
HEALTHCHECK --interval=15s --timeout=3s CMD wget -qO- http://localhost:3001/health || exit 1
CMD ["node", "src/index.js"]
