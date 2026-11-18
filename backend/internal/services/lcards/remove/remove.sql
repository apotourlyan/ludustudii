-- $1 id, $2 whether to check the version, $3 expected version
WITH del AS (
    DELETE FROM learning_cards
    WHERE id = $1 AND (NOT $2 OR version = $3)
    RETURNING id
)
SELECT EXISTS (
    SELECT 1
    FROM del
) AS deleted, EXISTS (
    SELECT 1
    FROM learning_cards
    WHERE id = $1
) AS card_exists;
