-- +goose Up
-- The last write wins (ADR 0039), so cards no longer carry a version.
ALTER TABLE learning_cards DROP COLUMN version;

-- +goose Down
ALTER TABLE learning_cards ADD COLUMN version bigint NOT NULL DEFAULT 1 CHECK (version >= 1);
