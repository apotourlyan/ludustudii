-- $1 user_id, $2 token_hash, $3 last_seen_at, $4 expires_at
INSERT INTO sessions (user_id, token_hash, last_seen_at, expires_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, now(), now())
RETURNING id, created_at;
