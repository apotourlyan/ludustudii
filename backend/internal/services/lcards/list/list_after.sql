-- $1 cursor, $2 limit plus one
SELECT id, title, description, created_at, updated_at
FROM learning_cards
WHERE id < $1
ORDER BY id DESC
LIMIT $2;
