-- $1 id, $2 password_hash
UPDATE users
SET password_hash = $2, updated_at = now()
WHERE id = $1;
