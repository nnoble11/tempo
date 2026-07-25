FROM node:22-bookworm-slim AS build

ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

WORKDIR /workspace
COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm exec tsc -b --pretty false

FROM node:22-bookworm-slim AS runtime

ENV NODE_ENV=production
ENV PNPM_HOME=/pnpm
ENV PATH=$PNPM_HOME:$PATH
ENV HOST=0.0.0.0
ENV PORT=3001

RUN corepack enable && corepack prepare pnpm@11.7.0 --activate

WORKDIR /workspace
COPY --from=build --chown=node:node /workspace /workspace
RUN chown node:node /workspace

USER node
EXPOSE 3001

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD ["node", "-e", "fetch(`http://127.0.0.1:${process.env.PORT ?? '3001'}/health`).then((response) => { if (!response.ok) process.exit(1); }).catch(() => process.exit(1));"]

# Run node directly: a pnpm wrapper triggers a corepack download and a pnpm
# deps check/install at boot, which OOMs a 512Mi instance. Dependencies are
# already baked into the image.
CMD ["node", "apps/api/dist/server.js"]
