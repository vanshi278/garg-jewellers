# Garg Jewellers storefront — production image (Next.js standalone).
FROM node:22-slim AS builder
WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci

COPY . .

# NEXT_PUBLIC_* values are inlined into the client bundle at build time, so the
# API base must be known here. Default points at the deployed backend; override
# with --build-arg (docker-compose passes localhost for local dev).
ARG NEXT_PUBLIC_API_BASE=https://garg-backend.onrender.com
ENV NEXT_PUBLIC_API_BASE=$NEXT_PUBLIC_API_BASE
RUN npm run build

# ---- Runtime ----
FROM node:22-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
# Bind to all interfaces so the host (Render) can reach the server; PORT is
# injected by the host and read by Next's standalone server.
ENV HOSTNAME=0.0.0.0

# Standalone output bundles only what's needed to run.
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/public ./public

EXPOSE 3000
CMD ["node", "server.js"]
