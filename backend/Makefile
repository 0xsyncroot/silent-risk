# ============================================
# Silent Risk Backend - Makefile
# ============================================

.PHONY: help setup dev clean test lint format

# Default Python version
PYTHON := python3.11
VENV := .venv
BIN := $(VENV)/bin

help: ## Show this help message
	@echo "Silent Risk Backend - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

setup: .venv ## Create virtual environment and install dependencies
	@echo "Setting up backend environment..."
	$(BIN)/pip install --upgrade pip
	$(BIN)/pip install -r requirements.txt
	@echo "✅ Setup complete"

.venv: ## Create virtual environment
	@echo "Creating virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "✅ Virtual environment created"

dev: ## Run backend in development mode
	@echo "Starting backend server..."
	$(BIN)/uvicorn app.main:app --reload --host 0.0.0.0 --port 8000

run: dev ## Alias for dev

clean: ## Clean up temporary files and caches
	@echo "Cleaning up..."
	rm -rf $(VENV)
	rm -rf __pycache__
	rm -rf .pytest_cache
	rm -rf .mypy_cache
	find . -type d -name __pycache__ -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	@echo "✅ Cleanup complete"

test: ## Run tests
	@echo "Running tests..."
	$(BIN)/pytest tests/ -v

lint: ## Run linter
	@echo "Running linter..."
	$(BIN)/flake8 app/ --max-line-length=120

format: ## Format code with black
	@echo "Formatting code..."
	$(BIN)/black app/

check: lint ## Run code quality checks
	@echo "Running type checker..."
	$(BIN)/mypy app/ --ignore-missing-imports
