# whazzon — what's on, in a place.
#
# The three stages never call into each other; they hand over through committed
# files. These targets follow the same grain: each one does a single stage's
# work and stops.

LOCATION ?= bristol-uk
TODAY := $(shell date +%F)

.DEFAULT_GOAL := help
.PHONY: help install check test typecheck format format-check validate check-urls stale \
        mock remock compile sync dev build build-pages preflight preview clean distclean refresh \
        refresh-all refresh-bristol refresh-cork ci

## ---------------------------------------------------------------- meta

help: ## Show this help
	@echo "whazzon — make targets (LOCATION=$(LOCATION))"
	@echo
	@grep -E '^[a-zA-Z_%-]+:.*?## .*$$' $(MAKEFILE_LIST) \
		| sort \
		| awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-18s\033[0m %s\n", $$1, $$2}'
	@echo
	@echo "Override the location with: make <target> LOCATION=<id>"

install: ## Install all dependencies (root + web workspace)
	npm install

## ---------------------------------------------------------------- quality

check: validate typecheck format-check test ## Everything CI would run

ci: check ## Alias for check

test: ## Run the test suite
	npm run test

typecheck: ## Typecheck the pipeline and the web app
	npm run typecheck

format: ## Format everything with prettier
	npm run format

format-check: ## Fail if anything is unformatted
	npm run format:check

## ---------------------------------------------------------------- stage 1

validate: ## Schema and cross-file checks over every location's data
	npm run validate -- --all

check-urls: ## Are the catalogued URLs still real? (network)
	npm run check-urls -- $(LOCATION)

## ---------------------------------------------------------------- stage 2

stale: ## What is due a harvest, given each source's cadence
	npm run stale -- $(LOCATION)

stale-ids: ## Bare source ids that are due, for scripting
	@npm run --silent stale -- $(LOCATION) --ids

mock: ## Regenerate mock harvest data (scaffolding — not a real harvest)
	npm run mock -- $(LOCATION) --date $(TODAY)

## ---------------------------------------------------------------- stage 3

compile: ## Fold the harvest log into data/<location>/snapshot.json
	npm run compile -- $(LOCATION)

sync: ## Copy compiled snapshots into the web app
	npm run sync-web -- --all

dev: ## Run the web app against the current snapshots
	npm run dev

build: ## Build the static site into web/dist
	npm run build:web

preview: build ## Serve the built site locally
	npm run preview -w @whazzon/web

# GitHub Pages serves a project site from /<repo>/, so assets need that prefix.
# Omit BASE (or set BASE=/) for a root-domain deploy or a user/org site.
BASE ?= /whazzon/
build-pages: ## Build for GitHub Pages (BASE=/whazzon/ by default)
	VITE_BASE=$(BASE) npm run build:web
	@echo "built for base $(BASE) — web/dist is ready to publish"

# Everything the deploy workflow does, in the same order, before pushing. The
# only things it cannot rehearse are the Pages actions themselves; it does check
# the two failure modes that have actually bitten — an asset base that does not
# match the published prefix, and data that no longer validates.
preflight: check build-pages ## Rehearse the deploy locally before pushing
	@echo
	@hidden=$$(find web/dist -name ".*" ! -name "." | wc -l | tr -d ' '); \
		echo "hidden files in web/dist: $$hidden  (upload-pages-artifact v4+ silently drops them)"
	@echo "local refs in index.html:"
	@grep -oE '(src|href)="[^"]+"' web/dist/index.html | grep -v 'https\?:' || true
	@echo
	@echo "preflight ok — base $(BASE), $$(du -sh web/dist | cut -f1) to publish"

## ---------------------------------------------------------------- pipelines

refresh: validate compile sync ## Validate, recompile and sync one location
	@echo "refreshed $(LOCATION)"

# `refresh` deliberately does not regenerate mock data — it recompiles whatever
# is in the harvest log, which is what it will do once harvests are real. This
# is the shortcut for while the log is still scaffolding.
remock: mock refresh ## Regenerate mock data, then recompile and sync

refresh-bristol: ## Refresh Bristol specifically
	@$(MAKE) refresh LOCATION=bristol-uk

refresh-cork: ## Refresh Cork specifically
	@$(MAKE) refresh LOCATION=cork-ie

refresh-all: ## Recompile and sync every configured location
	npm run validate -- --all
	@for id in $$(ls configs/*.yaml | xargs -n1 basename | sed 's/\.yaml//'); do \
		npm run --silent compile -- $$id; \
	done
	npm run sync-web -- --all

refresh-%: ## Refresh any location by id, e.g. make refresh-bristol-uk
	@$(MAKE) refresh LOCATION=$*

## ---------------------------------------------------------------- housekeeping

clean: ## Remove build output and synced snapshots
	rm -rf web/dist web/public/snapshots

distclean: clean ## Also remove installed dependencies
	rm -rf node_modules web/node_modules
