# Silent Risk - Confidential AI DApp Makefile
# Author: Silent Risk Team
# Description: Build automation for the entire project

.PHONY: help install clean dev test build deploy docker lint format

# Default target
help: ## Show this help message
	@echo "Silent Risk - Confidential AI DApp"
	@echo "=================================="
	@echo "Available commands:"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Installation and Setup
install: ## Install all dependencies and setup virtual environments
	@echo "🚀 Setting up Silent Risk project..."
	@$(MAKE) install-node
	@$(MAKE) install-python
	@echo "✅ Installation complete!"

install-node: ## Install Node.js dependencies
	@echo "📦 Installing Node.js dependencies..."
	npm install
	cd ui && npm install
	cd contracts && npm install

install-python: ## Setup Python virtual environments and install dependencies
	@echo "🐍 Setting up Python environments..."
	@$(MAKE) setup-backend-env
	@$(MAKE) setup-worker-env

setup-backend-env: ## Setup backend Python virtual environment
	@echo "📡 Setting up backend environment..."
	cd backend && python -m venv .venv
	cd backend && .venv/bin/pip install --upgrade pip setuptools wheel
	cd backend && .venv/bin/pip install -r requirements.txt

setup-worker-env: ## Setup worker Python virtual environment
	@echo "⚙️ Setting up worker environment..."
	cd worker && python -m venv .venv
	cd worker && .venv/bin/pip install --upgrade pip setuptools wheel
	cd worker && .venv/bin/pip install -r requirements.txt

# Development
dev: ## Start all development servers
	@echo "🔥 Starting development environment..."
	@$(MAKE) docker-up
	@sleep 5
	concurrently \
		"$(MAKE) dev-ui" \
		"$(MAKE) dev-backend" \
		"$(MAKE) dev-worker"

dev-ui: ## Start UI development server
	@echo "🎨 Starting UI development server..."
	cd ui && npm run dev

dev-backend: ## Start backend development server
	@echo "📡 Starting backend development server..."
	cd backend && .venv/bin/python -m uvicorn main:app --reload --host 0.0.0.0 --port 8000

dev-worker: ## Start worker development server
	@echo "⚙️ Starting worker development server..."
	cd worker && .venv/bin/python -m celery worker -A tasks.celery --loglevel=info

# Testing
test: ## Run all tests
	@echo "🧪 Running all tests..."
	@$(MAKE) test-contracts
	@$(MAKE) test-backend
	@$(MAKE) test-worker
	@$(MAKE) test-ui

test-contracts: ## Run smart contract tests
	@echo "📜 Testing smart contracts..."
	cd contracts && npx hardhat test

test-backend: ## Run backend tests
	@echo "📡 Testing backend..."
	cd backend && .venv/bin/python -m pytest tests/ -v --cov=app --cov-report=html

test-worker: ## Run worker tests
	@echo "⚙️ Testing worker..."
	cd worker && .venv/bin/python -m pytest tests/ -v --cov=app --cov-report=html

test-ui: ## Run UI tests
	@echo "🎨 Testing UI..."
	cd ui && npm run test

# Building
build: ## Build all components
	@echo "🏗️ Building all components..."
	@$(MAKE) build-ui
	@$(MAKE) build-contracts

build-ui: ## Build UI for production
	@echo "🎨 Building UI..."
	cd ui && npm run build

build-contracts: ## Compile smart contracts
	@echo "📜 Compiling smart contracts..."
	cd contracts && npx hardhat compile

# Deployment
deploy-contracts: ## Deploy smart contracts to testnet
	@echo "🚀 Deploying contracts to testnet..."
	cd contracts && npx hardhat deploy --network sepolia

deploy-contracts-local: ## Deploy smart contracts to local network
	@echo "🏠 Deploying contracts to local network..."
	cd contracts && npx hardhat deploy --network localhost

# Docker Management
docker-up: ## Start infrastructure services (Redis, MongoDB, Kafka)
	@echo "🐳 Starting infrastructure services..."
	docker-compose up -d

docker-down: ## Stop infrastructure services
	@echo "🛑 Stopping infrastructure services..."
	docker-compose down

docker-logs: ## Show infrastructure logs
	@echo "📋 Showing infrastructure logs..."
	docker-compose logs -f

docker-clean: ## Clean Docker containers and volumes
	@echo "🧹 Cleaning Docker resources..."
	docker-compose down -v --remove-orphans
	docker system prune -f

# Code Quality
lint: ## Run linting on all code
	@echo "🔍 Linting all code..."
	@$(MAKE) lint-ui
	@$(MAKE) lint-contracts
	@$(MAKE) lint-backend
	@$(MAKE) lint-worker

lint-ui: ## Lint UI code
	@echo "🎨 Linting UI..."
	cd ui && npm run lint

lint-contracts: ## Lint smart contracts
	@echo "📜 Linting contracts..."
	cd contracts && npx hardhat check

lint-backend: ## Lint backend code
	@echo "📡 Linting backend..."
	cd backend && .venv/bin/flake8 app/ --max-line-length=88 --extend-ignore=E203,W503
	cd backend && .venv/bin/mypy app/ --ignore-missing-imports

lint-worker: ## Lint worker code
	@echo "⚙️ Linting worker..."
	cd worker && .venv/bin/flake8 app/ --max-line-length=88 --extend-ignore=E203,W503
	cd worker && .venv/bin/mypy app/ --ignore-missing-imports

format: ## Format all code
	@echo "✨ Formatting all code..."
	@$(MAKE) format-ui
	@$(MAKE) format-backend
	@$(MAKE) format-worker

format-ui: ## Format UI code
	@echo "🎨 Formatting UI..."
	cd ui && npm run format

format-backend: ## Format backend code
	@echo "📡 Formatting backend..."
	cd backend && .venv/bin/black app/ tests/
	cd backend && .venv/bin/isort app/ tests/

format-worker: ## Format worker code
	@echo "⚙️ Formatting worker..."
	cd worker && .venv/bin/black app/ tests/
	cd worker && .venv/bin/isort app/ tests/

# Cleanup
clean: ## Clean all build artifacts and dependencies
	@echo "🧹 Cleaning project..."
	@$(MAKE) clean-node
	@$(MAKE) clean-python
	@$(MAKE) docker-clean

clean-node: ## Clean Node.js artifacts
	@echo "📦 Cleaning Node.js artifacts..."
	rm -rf node_modules ui/node_modules contracts/node_modules
	rm -rf ui/.next ui/out
	rm -rf contracts/artifacts contracts/cache contracts/typechain-types

clean-python: ## Clean Python artifacts
	@echo "🐍 Cleaning Python artifacts..."
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete
	find . -type f -name "*.pyo" -delete
	find . -type f -name "*.pyd" -delete
	find . -type d -name "*.egg-info" -exec rm -rf {} + 2>/dev/null || true
	rm -rf backend/.venv worker/.venv
	rm -rf backend/htmlcov worker/htmlcov
	rm -rf backend/.coverage worker/.coverage
	rm -rf backend/.pytest_cache worker/.pytest_cache

# Environment Management
env-backend: ## Activate backend virtual environment (use: source backend/.venv/bin/activate)
	@echo "📡 Backend environment: source backend/.venv/bin/activate"

env-worker: ## Activate worker virtual environment (use: source worker/.venv/bin/activate)
	@echo "⚙️ Worker environment: source worker/.venv/bin/activate"

# Monitoring
monitor: ## Start monitoring services (Kafka UI, Redis Commander, Mongo Express)
	@echo "📊 Starting monitoring services..."
	docker-compose --profile monitoring up -d

monitor-down: ## Stop monitoring services
	@echo "📊 Stopping monitoring services..."
	docker-compose --profile monitoring down

# Health Checks
health: ## Check health of all services
	@echo "🏥 Checking service health..."
	@echo "Redis:" && docker-compose exec redis redis-cli ping || echo "❌ Redis not running"
	@echo "MongoDB:" && docker-compose exec mongodb mongosh --eval "db.adminCommand('ping')" --quiet || echo "❌ MongoDB not running"
	@echo "Kafka:" && docker-compose exec kafka kafka-broker-api-versions --bootstrap-server localhost:9092 > /dev/null 2>&1 && echo "✅ Kafka running" || echo "❌ Kafka not running"

# Development Utilities
shell-backend: ## Open shell in backend environment
	cd backend && .venv/bin/python

shell-worker: ## Open shell in worker environment
	cd worker && .venv/bin/python

logs-backend: ## Show backend logs (if running in background)
	tail -f backend/logs/app.log 2>/dev/null || echo "No backend logs found"

logs-worker: ## Show worker logs (if running in background)
	tail -f worker/logs/worker.log 2>/dev/null || echo "No worker logs found"

# Security
security-check: ## Run security checks on Python dependencies
	@echo "🔒 Running security checks..."
	cd backend && .venv/bin/pip-audit
	cd worker && .venv/bin/pip-audit

# Database Management
db-migrate: ## Run database migrations (if applicable)
	@echo "🗄️ Running database migrations..."
	cd backend && .venv/bin/python -m alembic upgrade head

db-reset: ## Reset database (WARNING: This will delete all data)
	@echo "⚠️ Resetting database..."
	@read -p "Are you sure you want to reset the database? [y/N] " confirm && [ "$$confirm" = "y" ]
	docker-compose exec mongodb mongosh --eval "db.dropDatabase()"

# Quick Commands
quick-start: install docker-up ## Quick project setup and start
	@echo "🚀 Quick start complete! Run 'make dev' to start development servers."

status: ## Show project status
	@echo "📊 Silent Risk Project Status"
	@echo "============================"
	@echo "Node.js version: $$(node --version 2>/dev/null || echo 'Not installed')"
	@echo "Python version: $$(python --version 2>/dev/null || echo 'Not installed')"
	@echo "Docker version: $$(docker --version 2>/dev/null || echo 'Not installed')"
	@echo ""
	@echo "Virtual Environments:"
	@echo "Backend: $$([ -d backend/.venv ] && echo '✅ Created' || echo '❌ Not created')"
	@echo "Worker: $$([ -d worker/.venv ] && echo '✅ Created' || echo '❌ Not created')"
	@echo ""
	@echo "Infrastructure Services:"
	@$(MAKE) health

