-- $1 id
SELECT id, title, description, created_at, updated_at
FROM learning_cards
WHERE id = $1;
