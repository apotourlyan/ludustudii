-- $1 token_hash
DELETE FROM sessions
WHERE token_hash = $1;
