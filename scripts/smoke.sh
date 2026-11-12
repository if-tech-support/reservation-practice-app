#!/usr/bin/env bash
# デプロイ後の動作確認。ヘルスチェック → 登録 → 予約の作成 → 一覧 → 取り消し までを1回通す。
# 使い方: bash scripts/smoke.sh https://example.com
# 確認用のユーザーが毎回1人増える。本番で繰り返し流すものではない（検証環境とデプロイ直後の確認に使う）。
set -euo pipefail

BASE="${1:?使い方: bash scripts/smoke.sh <URL>}"
BASE="${BASE%/}"
JAR="$(mktemp)"
trap 'rm -f "$JAR"' EXIT
EMAIL="smoke-$(date +%s)-$RANDOM@example.com"

step() { printf '%s ... ' "$1"; }
ok() { echo "OK"; }
fail() { echo "NG"; echo "$1" >&2; exit 1; }

step "ヘルスチェック"
health="$(curl -fsS --max-time 15 "$BASE/api/health")" || fail "/api/health に届きません"
[[ "$health" == *'"status":"ok"'* ]] || fail "$health"
ok; echo "  $health"

step "登録"
out="$(curl -sS --max-time 30 -c "$JAR" -H 'content-type: application/json' -H "origin: $BASE" \
  -d "{\"email\":\"$EMAIL\",\"password\":\"smoke-password-123\",\"name\":\"smoke\"}" \
  "$BASE/api/auth/sign-up/email")"
[[ "$out" == *'"token"'* ]] || fail "$out"
ok

step "予約の作成"
out="$(curl -sS --max-time 15 -b "$JAR" -H 'content-type: application/json' \
  -d '{"title":"smoke","startsAt":"2030-01-01T10:00:00.000Z","partySize":2,"note":""}' \
  "$BASE/api/trpc/reservation.create")"
id="$(printf '%s' "$out" | sed -n 's/.*"id":"\([^"]*\)".*/\1/p')"
[[ -n "$id" ]] || fail "$out"
ok

step "一覧"
out="$(curl -sS --max-time 15 -b "$JAR" "$BASE/api/trpc/reservation.list")"
[[ "$out" == *"$id"* ]] || fail "$out"
ok

step "取り消し"
out="$(curl -sS --max-time 15 -b "$JAR" -H 'content-type: application/json' \
  -d "{\"id\":\"$id\"}" "$BASE/api/trpc/reservation.cancel")"
[[ "$out" == *'"result"'* ]] || fail "$out"
ok

step "ログインなしでは読めない"
code="$(curl -s -o /dev/null -w '%{http_code}' --max-time 15 "$BASE/api/trpc/reservation.list")"
[[ "$code" == "401" ]] || fail "401 のはずが $code"
ok

echo "すべて通りました: $BASE"
