-- $1 title, $2 description, $3 id, $4 whether to check the version, $5 expected version
WITH upd AS (
    UPDATE learning_cards
    SET title = $1, description = $2, version = version + 1, updated_at = now()
    WHERE id = $3 AND (NOT $4 OR version = $5)
    RETURNING version
)
SELECT (
    SELECT version
    FROM upd
) AS version, EXISTS (
    SELECT 1
    FROM learning_cards
    WHERE id = $3
) AS card_exists;
