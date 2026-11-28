-- $1 id, $2 last_seen_at, $3 expires_at
UPDATE sessions
SET last_seen_at = $2, expires_at = $3, updated_at = now()
WHERE id = $1;
