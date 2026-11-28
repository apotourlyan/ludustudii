-- $1 id
SELECT id, email
FROM users
WHERE id = $1;
