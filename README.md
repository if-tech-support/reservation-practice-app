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

## Cloudflare 構成だけの機能

次の3つは Cloudflare 構成（D1）だけで使える。AWS 構成（`DEPLOY_TARGET=node`）では無効で、画面にも出ない。それぞれ、バインディング（と変数）が Worker にあるときだけ有効になる。無いとき（手元・設定前の検証環境）は、今までどおり動く。

| 機能 | 必要なもの | 上限 | 無効のときの動き |
| --- | --- | --- | --- |
| 予約への添付ファイル | 非公開の R2 バケットを `FILES` に結びつける | PDF・PNG・JPEG だけ、1件5MBまで（超えたら 413、種類が違えば 415）。1予約に3件、1人30件まで | 添付の画面と API は出ない（API は 404） |
| 登録時の確認メール | `send_email` のバインディング `EMAIL` と、変数 `MAIL_FROM`（送信元） | 同じ宛先へは60秒に1通・1日5通まで。同じ IP からは1日20通まで。アプリ全体で1日200通まで | 確認なしで登録・ログインできる |
| メンテナンス表示 | KV を `CONFIG` に結びつける | KV の読み取りは1リクエスト1回 | 何もしない |

### 添付ファイル

- 予約の持ち主が、予約一覧の「添付」から1ファイルずつ足せる。取り出しは Worker 経由だけ（`/api/attachments/<id>`）。持ち主か管理者（`ADMIN_EMAIL`）以外は 404
- R2 のキーは `attachments/<予約ID>/<ランダムなID>`。元のファイル名はデータベースだけに持つ
- 予約を取り消すと、添付も消える。管理画面（`/admin`）にも添付のリンクが出る
- 件数の上限（1予約3件・1人30件）は、R2 に書く前に条件付きの INSERT で枠を取って守る（同時アップロードでも超えない）。行が入らなければ 409、R2 への書き込みに失敗したら行を消す
- テーブルは `migrations/sqlite/0002_attachments_mail_log.sql` と `0003_mail_log_ip_hash.sql`（D1 のみ。PostgreSQL には無い）

### 確認メール

- 登録すると確認のメールを送る。リンクの有効期限は1時間。確認が済むまでログインできない
- 上限の確認と記録は1つの SQL で行うので、同時に何件頼まれても上限を超えない。接続元の IP（`CF-Connecting-IP`）は SHA-256 の先頭16文字だけを `mail_log` に残し、生の IP は保存もログ出力もしない
- 送信に失敗しても記録は消さない（失敗する宛先へ繰り返し頼めてしまうのを防ぐため）
- アプリ全体の1日200通は、他人に使い切られうる（誰でも登録画面から送信を頼めるため）。本番では Turnstile や Rate Limiting を足す
- メール確認が有効なときは、確認済み（`emailVerified`）の人だけを管理者とみなす。メール確認が無効（`EMAIL` / `MAIL_FROM` が無い）だと、`ADMIN_EMAIL` のメールアドレスで先に登録した人が管理者になるので注意する
- メール確認をあとから有効にすると、すでに登録していた未確認のユーザーは、ログイン画面から確認メールの再送が要る
- 上限を超えると送らずにエラー（「しばらくしてからもう一度お試しください」）を返す。送信の記録は D1 の `mail_log`
- 送信に失敗したときは、エラーコードだけをログに出し、利用者には一般的なメッセージを返す。宛先はログに出さない
- `MAIL_FROM` が空、または `EMAIL` が無ければ無効。手元の `wrangler.jsonc` には `send_email` を足していない

### メンテナンス表示

KV のキー `maintenance` を `on` にすると、画面は「ただいまメンテナンス中です」のページ、API は 503 になる。`/api/health` は 200 のままで、JSON に `"maintenance": true` が足される。管理者でログイン済みの人は通る（ログイン画面は常に開ける）。反映は KV の仕様で最大60秒ほど遅れる。

```bash
# 手元で切り替える
bunx wrangler kv key put --binding CONFIG maintenance on --local
bunx wrangler kv key delete --binding CONFIG maintenance --local
```

## コースで足していくもの

このリポジトリには、手元で動かすところまでが入っています。次のものは、コースの中で自分で足していきます。

- Cloudflare 構成: 検証・本番の Worker と D1（`wrangler.jsonc` の `env`）、GitHub Actions でのデプロイ、Access、WAF
- AWS 構成: Terraform（VPC・RDS・ECS Fargate・ALB・CloudFront・WAF）、GitHub Actions でのデプロイ、監視

## 注意

- 練習用のアプリです。そのまま本番のサービスには使わないでください
- Cloudflare の無料プランでは、パスワードの計算が CPU 時間の上限を超えることがあります。Cloudflare 構成へデプロイするときは、Workers の有料プランを使います
