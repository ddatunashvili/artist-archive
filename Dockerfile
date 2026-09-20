# Artist Archive - local container image (Node 24).
# The app also runs without Docker; see README.md.

FROM node:24-alpine AS deps
# Prisma needs OpenSSL on Alpine.
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY package.json package-lock.json ./
# Dev dependencies stay in the image: the container runs the Prisma CLI and
# the TypeScript seed script at startup.
RUN npm ci --ignore-scripts && npm rebuild prisma @prisma/client esbuild

FROM node:24-alpine AS build
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# A placeholder URL: Prisma only needs the shape of it to generate a client.
ENV DATABASE_URL="file:/app/data/dev.db"
RUN npm run build

FROM node:24-alpine AS runtime
RUN apk add --no-cache openssl libc6-compat
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV DATABASE_PROVIDER=sqlite
ENV DATABASE_URL="file:/app/data/dev.db"

COPY --from=deps /app/node_modules ./node_modules
COPY --from=build /app/.next ./.next
COPY package.json package-lock.json next.config.ts tsconfig.json ./
COPY public ./public
COPY prisma ./prisma
COPY scripts ./scripts
COPY src ./src
COPY docker-entrypoint.sh ./docker-entrypoint.sh
RUN chmod +x ./docker-entrypoint.sh && mkdir -p /app/data && chown -R node:node /app/data

USER node
EXPOSE 3000
ENTRYPOINT ["./docker-entrypoint.sh"]
CMD ["npm", "run", "start"]
