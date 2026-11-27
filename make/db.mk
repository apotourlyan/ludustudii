##@ Database
# Migrations and a psql session on the development database (DB_CONNECTION).

.PHONY: require-db migrate-create migrate-up migrate-down migrate-status

require-db:
	@[ -n "$(DB_CONNECTION)" ] || { echo "Error: DB_CONNECTION is not set"; exit 1; }

migrate-up migrate-down migrate-status psql: require-db

## migrate-create: Creates a new database migration file with the given NAME
## ---- Usage: make migrate-create NAME=migration_name
migrate-create:
	@if [ -z "$(NAME)" ]; then echo "Error: NAME is required (e.g., make migrate-create NAME=add_users)"; exit 1; fi
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) create $(NAME) sql

## migrate-up: Applies all pending database migrations
migrate-up:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" up
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## migrate-down: Rolls back the most recently applied database migration (down by one)
migrate-down:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" down
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## migrate-status: Shows the status of all database migrations
migrate-status:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" status

.PHONY: psql

## psql: Connects to the PostgreSQL database using DB_CONNECTION environment variable
psql:
	@echo "==> Connecting to PostgreSQL..."
	@psql "$(DB_CONNECTION)"
