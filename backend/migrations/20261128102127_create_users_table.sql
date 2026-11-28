-- +goose Up
-- Accounts (ADR 0046). The email is stored canonical (NFC, trimmed and
-- lowercased) by the application, so the unique constraint is exact.
CREATE TABLE users (
    id                UUID PRIMARY KEY DEFAULT uuidv7(),
    email             TEXT NOT NULL UNIQUE
                      CHECK (char_length(email) BETWEEN 3 AND 254 AND email ~ '^[^@]+@[^@]+$'),
    -- An argon2id PHC string; the longest kit/password accepts is 211
    -- characters, and the cap leaves room for its bounds to grow.
    password_hash     TEXT NOT NULL
                      CHECK (char_length(password_hash) <= 255 AND password_hash LIKE '$argon2id$%'),
    email_verified_at timestamptz,
    created_at        timestamptz NOT NULL,
    updated_at        timestamptz NOT NULL,
    CONSTRAINT users_timestamps_check CHECK (updated_at >= created_at)
);

-- +goose Down
DROP TABLE IF EXISTS users;
