-- $1 limit plus one
SELECT id, title, description
FROM learning_cards
ORDER BY id DESC
LIMIT $1;
