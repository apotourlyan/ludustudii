-- $1 id
SELECT id, title, description
FROM learning_cards
WHERE id = $1;
