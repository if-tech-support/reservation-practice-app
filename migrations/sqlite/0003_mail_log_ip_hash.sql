-- 送信を頼んだ接続元 IP のハッシュ（生の IP は持たない）。IP ごとの上限を数えるために使う
ALTER TABLE mail_log ADD COLUMN ip_hash TEXT;
CREATE INDEX mail_log_ip_hash_created_at_idx ON mail_log(ip_hash, created_at);
