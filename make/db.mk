##@ Database
# Migrations and a psql session on the development database (DB_CONNECTION).

.PHONY: require-db db-migration-new db-migrate-up db-migrate-down db-migrate-status

require-db:
	@[ -n "$(DB_CONNECTION)" ] || { echo "Error: DB_CONNECTION is not set"; exit 1; }

db-migrate-up db-migrate-down db-migrate-status db-shell: require-db

## db-migration-new: Creates a new database migration file with the given NAME
## ---- Usage: make db-migration-new NAME=migration_name
db-migration-new:
	@if [ -z "$(NAME)" ]; then echo "Error: NAME is required (e.g., make db-migration-new NAME=add_users)"; exit 1; fi
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) create $(NAME) sql

## db-migrate-up: Applies all pending database migrations
db-migrate-up:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" up
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## db-migrate-down: Rolls back the most recently applied database migration (down by one)
db-migrate-down:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" down
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" version

## db-migrate-status: Shows the status of all database migrations
db-migrate-status:
	@$(GO_TOOL) goose -dir $(MIGRATIONS_DIR) postgres "$(DB_CONNECTION)" status

.PHONY: db-shell

## db-shell: Connects to the PostgreSQL database using DB_CONNECTION environment variable
db-shell:
	@echo "==> Connecting to PostgreSQL..."
	@psql "$(DB_CONNECTION)"
