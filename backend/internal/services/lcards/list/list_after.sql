-- $1 cursor, $2 limit plus one
SELECT id, title, description
FROM learning_cards
WHERE id < $1
ORDER BY id DESC
LIMIT $2;
