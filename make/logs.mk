##@ Logs
# Queries on the backend's JSON log, LOG_FILE (default: backend/tmp/app.log),
# which make dev appends to.

.PHONY: logs logs-errors logs-req logs-slow logs-stats

# Each target reads LOG_FILE line by line and skips lines that are not JSON
# (Air's own output) with 'fromjson?'.

## logs: Follows LOG_FILE and pretty-prints each JSON log record
logs:
	@tail -F $(LOG_FILE) | jq --unbuffered -R 'fromjson? | .'

## logs-errors: Prints ERROR and WARN records from LOG_FILE
logs-errors:
	@jq -cR 'fromjson? | select(.level == "ERROR" or .level == "WARN")' $(LOG_FILE)

## logs-req: Prints every record for the request with the given ID
## ---- Usage: make logs-req ID=<request id>
logs-req:
	@if [ -z "$(ID)" ]; then echo "Error: ID is required (e.g., make logs-req ID=abc123)"; exit 1; fi
	@jq -cR --arg id "$(ID)" 'fromjson? | select(.request_id == $$id)' $(LOG_FILE)

## logs-slow: Prints "request" records slower than MS milliseconds (default 200)
## ---- Usage: make logs-slow MS=500
logs-slow: MS ?= 200
logs-slow:
	@jq -cR --argjson ms "$(MS)" \
		'fromjson? | select(.msg == "request" and .latency > $$ms * 1000000)' $(LOG_FILE)

## logs-stats: Counts "request" records by status, method and route, most frequent first
logs-stats:
	@jq -nrR '[inputs | fromjson? | select(.msg == "request") | {status, method, route}] | group_by(.) | map({count: length} + .[0]) | sort_by(-.count) | .[] | "\(.count)\t\(.status)\t\(.method)\t\(.route)"' $(LOG_FILE)
