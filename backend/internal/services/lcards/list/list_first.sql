-- $1 limit plus one
SELECT id, title, description, created_at, updated_at
FROM learning_cards
ORDER BY id DESC
LIMIT $1;
