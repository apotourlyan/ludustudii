##@ API
# The OpenAPI spec: the bundle the API reference serves and the client app's
# types are generated from.

SPEC_SRC := $(shell find backend/apispec -name '*.yml')

.PHONY: api-bundle

## api-bundle: Regenerates the bundled OpenAPI spec the API reference serves, if a spec file changed
api-bundle: $(SPEC_BUNDLE)

# bundlespec writes the file only once the spec bundles, so a failed run leaves
# it unchanged and .DELETE_ON_ERROR keeps it.
$(SPEC_BUNDLE): $(SPEC_SRC)
	cd $(BACKEND_DIR) && go generate ./internal/infra/apidocs
