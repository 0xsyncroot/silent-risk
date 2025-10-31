# ============================================
# Silent Risk Worker - Makefile
# ============================================

.PHONY: help .venv install setup dev clean test lint format

# Default Python version
PYTHON := python3
VENV := .venv
BIN := $(VENV)/bin

help: ## Show this help message
	@echo "Silent Risk Worker - Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  \033[36m%-15s\033[0m %s\n", $$1, $$2}'

.venv: ## Create virtual environment
	@echo "📦 Creating virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "✅ Virtual environment created"

install: .venv ## Install dependencies
	@echo "📦 Installing dependencies..."
	$(BIN)/pip install --upgrade pip setuptools wheel
	$(BIN)/pip install -r requirements.txt
	@echo "✅ Dependencies installed"

setup: install ## Alias for install (create venv + install deps)

venv: .venv ## Alias for .venv

dev: ## Run worker in development mode
	@echo "Starting worker..."
	$(BIN)/python -m app.main

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
