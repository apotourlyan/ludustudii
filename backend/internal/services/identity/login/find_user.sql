-- $1 email
SELECT id, email, password_hash
FROM users
WHERE email = $1;
