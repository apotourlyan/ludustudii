-- $1 token_hash, $2 now
SELECT id, user_id, last_seen_at, expires_at, created_at
FROM sessions
WHERE token_hash = $1 AND expires_at > $2;
