-- $1 title, $2 description, $3 id
UPDATE learning_cards
SET title = $1, description = $2, updated_at = now()
WHERE id = $3;
