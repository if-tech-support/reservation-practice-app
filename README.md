# 予約管理アプリ（練習用）

Code Lesson の「AWS実践コース」と「Cloudflare実践コース」で使う、練習用の小さな業務アプリです。
**アプリのコードは書き換えません。** このアプリを、2つの構成に載せて運用する練習をします。

| 構成 | 実行する場所 | データベース | 使うコース |
|---|---|---|---|
| Cloudflare 構成 | Cloudflare Workers | D1 | Cloudflare実践コース |
| AWS 構成 | ECS Fargate（Node.js のコンテナ） | RDS for PostgreSQL | AWS実践コース |

## できること

- メールアドレスとパスワードで登録・ログインする
- 自分の予約を登録・一覧・取り消しする
- 管理者（環境変数 `ADMIN_EMAIL` と同じメールアドレスの人）は、`/admin` で全員の予約を見る
- `/api/health` で、アプリとデータベースが動いているかを返す（デプロイ後の確認と、ロードバランサーのヘルスチェックに使う）

## 使っている技術

| 領域 | 技術 |
|---|---|
| 画面・サーバー | React 19、TanStack Start |
| API | tRPC、zod |
| データベース操作 | Drizzle ORM（D1 と PostgreSQL の両方） |
| 認証 | Better Auth |

開発言語はすべて TypeScript です。

## 2つの構成に載せる仕組み

インフラに依存する部分は、次の2つのファイルだけにまとめています。ビルドのときに、どちらか一方へ差し替わります。

| ファイル | 中身 |
|---|---|
| `src/server/platform.cloudflare.ts` | D1 への接続、Worker の環境変数 |
| `src/server/platform.node.ts` | PostgreSQL への接続、`process.env` の環境変数 |

テーブルの定義とマイグレーションは、データベースごとに持っています。

| | Cloudflare（D1） | AWS（PostgreSQL） |
|---|---|---|
| テーブルの定義 | `src/server/db/schema.sqlite.ts` | `src/server/db/schema.pg.ts` |
| マイグレーション | `migrations/sqlite/` | `migrations/pg/` |

## 必要なもの

- [Bun](https://bun.sh/) 1.4 以上
- Node.js 24 以上
- Docker（AWS 構成を手元で動かすときだけ）

## 手元で動かす：Cloudflare 構成

Worker と D1 を手元で再現して動かします。Cloudflare のアカウントは要りません。

```bash
bun install
cp .dev.vars.example .dev.vars
bun run db:migrate:local
bun run dev
```

ブラウザで http://localhost:5173 を開きます。

## 手元で動かす：AWS 構成

PostgreSQL を Docker で起動し、Node.js 向けにビルドしたサーバーを動かします。

```bash
bun install
docker compose up -d --wait db
cp .env.node.example .env.node
set -a; source .env.node; set +a
bun run db:migrate:pg
bun run build:node
bun run start:node
```

ブラウザで http://localhost:3000 を開きます。

手元の 5432 番ポートを別の PostgreSQL が使っているときは、`DB_PORT=55432 docker compose up -d --wait db` のように番号を変え、`.env.node` の `DATABASE_URL` も同じ番号にします。

### コンテナイメージで動かす

AWS へ載せるのと同じイメージを、手元で確かめられます。

```bash
docker build -t reservation-practice-app .
docker run --rm --network reservation-practice-app_default \
  -e DATABASE_URL=postgres://app:app@db:5432/app \
  reservation-practice-app node scripts/migrate-pg.mjs
docker run --rm -p 3000:3000 --network reservation-practice-app_default \
  -e DATABASE_URL=postgres://app:app@db:5432/app \
  -e BETTER_AUTH_URL=http://localhost:3000 \
  -e BETTER_AUTH_SECRET=local-only-secret-change-me-0123456789 \
  reservation-practice-app
```

## 環境変数

| 名前 | 中身 | Cloudflare | AWS |
|---|---|---|---|
| `APP_ENV` | 環境の名前（`local`・`staging`・`production` など） | `wrangler.jsonc` の `vars` | タスク定義 |
| `BETTER_AUTH_URL` | アプリを公開する URL | `wrangler.jsonc` の `vars` | タスク定義 |
| `BETTER_AUTH_SECRET` | ログイン状態の署名に使う秘密の値（32文字以上） | Secret | Secrets Manager |
| `ADMIN_EMAIL` | 管理者のメールアドレス | Secret | Secrets Manager |
| `DATABASE_URL` | PostgreSQL の接続先 | 使わない | Secrets Manager |
| `DATABASE_SSL` | RDS へつなぐときは `require` | 使わない | タスク定義 |

秘密の値は Git に入れません。`.dev.vars` と `.env.node` は `.gitignore` に入っています。

## デプロイ後の動作確認

ヘルスチェックから、登録・予約の作成・一覧・取り消しまでを1回通します。

```bash
bash scripts/smoke.sh https://（公開した URL）
```

確認用のユーザーが毎回1人増えるので、本番で繰り返し流さないでください。

## コマンド一覧

| コマンド | すること |
|---|---|
| `bun run dev` | Cloudflare 構成を手元で起動する |
| `bun run build` | Cloudflare Workers 向けにビルドする（`dist/`） |
| `bun run build:node` | Node.js 向けにビルドする（`.output/`） |
| `bun run start:node` | Node.js 向けにビルドしたサーバーを起動する |
| `bun run db:migrate:local` | 手元の D1 にマイグレーションを適用する |
| `bun run db:migrate:pg` | PostgreSQL にマイグレーションを適用する |
| `bun run typecheck` | 2つの構成の両方で型を検査する |
| `bun run smoke -- <URL>` | 動作確認を通す |

## コースで足していくもの

このリポジトリには、手元で動かすところまでが入っています。次のものは、コースの中で自分で足していきます。

- Cloudflare 構成: 検証・本番の Worker と D1（`wrangler.jsonc` の `env`）、GitHub Actions でのデプロイ、Access、WAF
- AWS 構成: Terraform（VPC・RDS・ECS Fargate・ALB・CloudFront・WAF）、GitHub Actions でのデプロイ、監視

## 注意

- 練習用のアプリです。そのまま本番のサービスには使わないでください
- Cloudflare の無料プランでは、パスワードの計算が CPU 時間の上限を超えることがあります。Cloudflare 構成へデプロイするときは、Workers の有料プランを使います
