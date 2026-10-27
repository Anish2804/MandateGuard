.PHONY: help install-contracts test-contracts test-backend test-e2e test-all dev-anvil dev-backend dev-frontend

help:
	@echo "MandateGuard Make Targets:"
	@echo "  make install-contracts : Install Foundry dependencies"
	@echo "  make test-contracts    : Run forge smart contract tests"
	@echo "  make test-backend      : Run pytest backend test suite"
	@echo "  make test-e2e          : Run end-to-end integration test against local chain"
	@echo "  make test-all          : Run all automated tests"
	@echo "  make dev-anvil         : Start local Anvil node"
	@echo "  make dev-backend       : Start FastAPI backend server"
	@echo "  make dev-frontend      : Start Next.js frontend dev server"

install-contracts:
	cd contracts && forge install

test-contracts:
	cd contracts && forge test -vvv

test-backend:
	cd backend && .venv/bin/pytest -v || .venv/Scripts/pytest -v

test-e2e:
	python scripts/test_e2e.py || python3 scripts/test_e2e.py

test-all: test-contracts test-backend test-e2e

dev-anvil:
	anvil --chain-id 31337 --port 8545

dev-backend:
	cd backend && uvicorn app.main:app --reload --port 8000

dev-frontend:
	cd frontend && npm run dev
