ARG NODE_VERSION=24-bookworm-slim

FROM node:${NODE_VERSION} AS dependencies
WORKDIR /app

# Copy the workspace manifests first so dependency installation remains cached
# while application source files change.
COPY package.json package-lock.json ./
COPY apps/server/package.json apps/server/package.json
COPY apps/web/package.json apps/web/package.json
COPY packages/shared/package.json packages/shared/package.json
RUN npm ci

FROM dependencies AS source
COPY tsconfig.base.json ./
COPY apps ./apps
COPY packages ./packages

FROM source AS checks
RUN npm run typecheck

FROM source AS web-build
ARG VITE_SERVER_URL
ENV VITE_SERVER_URL=${VITE_SERVER_URL}
RUN npm run build --workspace @drawly/web

FROM node:${NODE_VERSION} AS app
ENV NODE_ENV=production \
    PORT=8888 \
    DRAWLY_DATA_DIR=/data \
    DRAWLY_WEB_DIR=/app/dist/web
WORKDIR /app

# The server currently runs TypeScript through tsx, so retain the workspace
# dependencies and sources alongside the compiled web application.
COPY --chown=node:node --from=web-build /app /app
RUN mkdir -p /data && chown node:node /data
USER node

VOLUME ["/data"]
EXPOSE 8888
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:8888/health').then(r=>{if(!r.ok)process.exit(1)}).catch(()=>process.exit(1))"

CMD ["npm", "run", "start", "--workspace", "@drawly/server"]
