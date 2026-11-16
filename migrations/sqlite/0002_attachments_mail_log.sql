-- Cloudflare 構成だけの機能（添付ファイル・確認メールの送信記録）。PostgreSQL 側には作らない
CREATE TABLE attachment (
  id TEXT PRIMARY KEY NOT NULL,
  reservation_id TEXT NOT NULL REFERENCES reservation(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  r2_key TEXT NOT NULL UNIQUE,
  filename TEXT NOT NULL,
  content_type TEXT NOT NULL,
  size INTEGER NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX attachment_reservation_id_idx ON attachment(reservation_id);
CREATE INDEX attachment_user_id_idx ON attachment(user_id);
CREATE TABLE mail_log (
  id TEXT PRIMARY KEY NOT NULL,
  to_address TEXT NOT NULL,
  kind TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
CREATE INDEX mail_log_to_address_created_at_idx ON mail_log(to_address, created_at);
CREATE INDEX mail_log_created_at_idx ON mail_log(created_at);
