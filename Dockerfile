# Builder stage
FROM node:25-alpine AS builder

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY prisma ./prisma/

# Install dependencies
RUN npm ci

# Copy source
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build
RUN npm run build

# Production dependencies stage
FROM builder AS production-deps

RUN npm prune --omit=dev && npm cache clean --force

# Runtime stage
FROM node:25-alpine AS runtime

WORKDIR /app

ENV NODE_ENV=production

COPY --chown=node:node package*.json ./
COPY --chown=node:node prisma ./prisma/
COPY --chown=node:node --from=builder /app/dist ./dist
COPY --chown=node:node --from=production-deps /app/node_modules ./node_modules

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD wget -qO- "http://127.0.0.1:${PORT:-3000}/health/live" || exit 1

USER node

CMD ["node", "--require", "./dist/instrumentation.js", "dist/main.js"]
