.PHONY: help venv install dev test clean

# Python
PYTHON := python3
VENV := .venv
BIN := $(VENV)/bin
PYTHON_VENV := $(BIN)/python
PIP := $(BIN)/pip

help:
	@echo "Silent Risk WebSocket Service - Makefile Commands"
	@echo ""
	@echo "Setup:"
	@echo "  make venv       - Create virtual environment"
	@echo "  make install    - Install dependencies"
	@echo ""
	@echo "Development:"
	@echo "  make dev        - Run service in development mode"
	@echo "  make test       - Run tests"
	@echo ""
	@echo "Cleanup:"
	@echo "  make clean      - Remove virtual environment and cache"

venv:
	@echo "Creating virtual environment..."
	$(PYTHON) -m venv $(VENV)
	@echo "Virtual environment created at $(VENV)"

install: venv
	@echo "Installing dependencies..."
	$(PIP) install --upgrade pip
	$(PIP) install -r requirements.txt
	@echo "Dependencies installed"

dev:
	@echo "Starting WebSocket service in development mode..."
	$(PYTHON_VENV) -m app.main

test:
	@echo "Running tests..."
	$(BIN)/pytest tests/ -v

clean:
	@echo "Cleaning up..."
	rm -rf $(VENV)
	find . -type d -name "__pycache__" -exec rm -rf {} +
	find . -type f -name "*.pyc" -delete
	@echo "Cleanup complete"

