# Node.js（PostgreSQL）版のコンテナイメージ。AWS の ECS Fargate で動かす。
# 1段目でビルドし、2段目には実行に要るものだけを入れる。

FROM oven/bun:1.4 AS build
WORKDIR /app
COPY package.json bun.lock ./
RUN bun install --frozen-lockfile
COPY . .
RUN DEPLOY_TARGET=node bun run build

FROM node:24-slim AS runtime
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
# サーバー本体（依存はビルド時にまとめてある）
COPY --from=build /app/.output ./.output
# マイグレーション（デプロイのとき、同じイメージから node scripts/migrate-pg.mjs を実行する）
COPY --from=build /app/migrations/pg ./migrations/pg
COPY --from=build /app/scripts/migrate-pg.mjs ./scripts/migrate-pg.mjs
COPY --from=build /app/node_modules/postgres ./node_modules/postgres
# root で動かさない
USER node
EXPOSE 3000
CMD ["node", ".output/server/index.mjs"]
