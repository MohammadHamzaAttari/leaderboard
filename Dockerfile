# ---------- Build Stage ----------
FROM node:18-alpine AS builder

WORKDIR /app

# Copy dependency files first (better caching)
COPY package.json package-lock.json ./

# Install deps (includes devDependencies needed for build)
RUN npm ci

# Copy rest of the source
COPY . .

# Build Next.js
RUN npm run build


# ---------- Runtime Stage ----------
FROM node:18-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only what is needed to run the app
COPY --from=builder /app/package.json ./
COPY --from=builder /app/package-lock.json ./
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/next.config.js ./next.config.js

EXPOSE 8501

# Uses: "start": "next start"
CMD ["npm", "start"]

