-- +goose Up
-- Sessions (ADR 0047). token_hash is the SHA-256 of the token, which is never
-- stored. expires_at is the session's effective expiry, the earlier of its
-- idle and absolute limits, so lookups and cleanup filter on it alone. Both
-- tables belong to identity, so the foreign key may cascade (ADR 0001).
CREATE TABLE sessions (
    id           UUID PRIMARY KEY DEFAULT uuidv7(),
    user_id      UUID NOT NULL REFERENCES users (id) ON DELETE CASCADE,
    token_hash   BYTEA NOT NULL UNIQUE CHECK (octet_length(token_hash) = 32),
    last_seen_at timestamptz NOT NULL,
    expires_at   timestamptz NOT NULL,
    created_at   timestamptz NOT NULL,
    updated_at   timestamptz NOT NULL,
    CONSTRAINT sessions_expiry_check CHECK (expires_at > last_seen_at),
    CONSTRAINT sessions_timestamps_check CHECK (updated_at >= created_at)
);

-- The cleanup deletes by expires_at; deleting a user deletes its sessions by
-- user_id, which PostgreSQL doesn't index for a foreign key on its own.
CREATE INDEX sessions_expires_at_idx ON sessions (expires_at);
CREATE INDEX sessions_user_id_idx ON sessions (user_id);

-- +goose Down
DROP TABLE IF EXISTS sessions;
