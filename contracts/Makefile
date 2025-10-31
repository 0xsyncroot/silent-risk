# Silent Risk - Contracts Makefile
# 
# Compilation, testing, and deployment automation

# Load environment variables from .env file if it exists
ifneq (,$(wildcard .env))
    include .env
    export
endif

.PHONY: help install clean compile test deploy-vault deploy-passport link-passport deploy-all verify setup-circom compile-circuit check-env

# Default target
help:
	@echo "Silent Risk - Smart Contracts"
	@echo ""
	@echo "Available commands:"
	@echo "  make install          - Install dependencies"
	@echo "  make compile          - Compile contracts"
	@echo "  make test             - Run unit tests"
	@echo "  make test-coverage    - Run tests with coverage"
	@echo "  make clean            - Clean artifacts"
	@echo ""
	@echo "Deployment commands (requires .env file):"
	@echo "  make check-env        - Check environment variables"
	@echo "  make deploy-vault     - Deploy RiskScoreVault"
	@echo "  make deploy-passport  - Deploy PassportNFT (requires VAULT_CONTRACT_ADDRESS)"
	@echo "  make link-passport    - Link PassportNFT to RiskScoreVault"
	@echo "  make deploy-all       - Deploy and link all contracts"
	@echo "  make verify           - Verify contracts on Etherscan"
	@echo ""
	@echo "ZK Circuit commands:"
	@echo "  make setup-circom     - Install circom compiler"
	@echo "  make compile-circuit  - Compile ZK circuits"
	@echo ""
	@echo "💡 Tip: Create .env file with DEPLOYER_PRIVATE_KEY for deployment"
	@echo ""

# Install dependencies
install:
	@echo "📦 Installing dependencies..."
	npm install
	@echo "✅ Dependencies installed"

# Clean build artifacts
clean:
	@echo "🧹 Cleaning artifacts..."
	rm -rf artifacts cache typechain-types
	@echo "✅ Cleaned"

# Compile contracts
compile:
	@echo "🔨 Compiling contracts..."
	npx hardhat compile
	@echo "✅ Compilation complete"

# Run tests
test:
	@echo "🧪 Running tests..."
	npx hardhat test
	@echo "✅ Tests complete"

# Run tests with coverage
test-coverage:
	@echo "📊 Running tests with coverage..."
	npx hardhat coverage
	@echo "✅ Coverage complete"

# Run specific test file
test-vault:
	@echo "🧪 Testing RiskScoreVault..."
	npx hardhat test test/RiskScoreVault.test.ts
	@echo "✅ Vault tests complete"

test-passport:
	@echo "🧪 Testing PassportNFT..."
	npx hardhat test test/PassportNFT.test.ts
	@echo "✅ Passport tests complete"

# Check environment variables
check-env:
	@echo "🔍 Checking environment setup..."
	@if [ ! -f .env ]; then \
		echo "❌ .env file not found"; \
		echo ""; \
		echo "Create .env file with:"; \
		echo "  DEPLOYER_PRIVATE_KEY=your_private_key_here"; \
		echo "  ETHERSCAN_API_KEY=your_etherscan_api_key"; \
		echo "  VAULT_CONTRACT_ADDRESS=0x... (after deploying vault)"; \
		echo "  PASSPORT_CONTRACT_ADDRESS=0x... (after deploying passport)"; \
		echo ""; \
		exit 1; \
	fi
	@if [ -z "$$DEPLOYER_PRIVATE_KEY" ]; then \
		echo "❌ DEPLOYER_PRIVATE_KEY not set in .env"; \
		exit 1; \
	fi
	@echo "✅ Environment configured"
	@echo "  DEPLOYER_PRIVATE_KEY: ****${DEPLOYER_PRIVATE_KEY: -4}"
	@if [ -n "$$VAULT_CONTRACT_ADDRESS" ]; then \
		echo "  VAULT_CONTRACT_ADDRESS: $$VAULT_CONTRACT_ADDRESS"; \
	fi
	@if [ -n "$$PASSPORT_CONTRACT_ADDRESS" ]; then \
		echo "  PASSPORT_CONTRACT_ADDRESS: $$PASSPORT_CONTRACT_ADDRESS"; \
	fi

# Deploy RiskScoreVault
deploy-vault:
	@echo "🚀 Deploying RiskScoreVault..."
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		echo ""; \
		echo "Create .env file with:"; \
		echo "  DEPLOYER_PRIVATE_KEY=your_private_key_here"; \
		echo ""; \
		echo "Or run: make check-env"; \
		exit 1; \
	fi
	@if [ -z "$$DEPLOYER_PRIVATE_KEY" ]; then \
		echo "❌ Error: DEPLOYER_PRIVATE_KEY not set in .env"; \
		echo ""; \
		echo "Add to .env file:"; \
		echo "  DEPLOYER_PRIVATE_KEY=your_private_key_here"; \
		exit 1; \
	fi
	npx hardhat run scripts/deploy-vault.ts --network sepolia
	@echo "✅ Vault deployed"
	@echo ""
	@echo "💡 Next steps:"
	@echo "  1. Copy the deployed contract address"
	@echo "  2. Add to .env: VAULT_CONTRACT_ADDRESS=0x..."
	@echo "  3. Run: make deploy-passport"

# Deploy PassportNFT
deploy-passport:
	@echo "🚀 Deploying PassportNFT..."
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		exit 1; \
	fi
	@if [ -z "$$DEPLOYER_PRIVATE_KEY" ]; then \
		echo "❌ Error: DEPLOYER_PRIVATE_KEY not set in .env"; \
		exit 1; \
	fi
	@if [ -z "$$VAULT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: VAULT_CONTRACT_ADDRESS not set in .env"; \
		echo ""; \
		echo "Steps:"; \
		echo "  1. Deploy RiskScoreVault first: make deploy-vault"; \
		echo "  2. Add to .env: VAULT_CONTRACT_ADDRESS=0x..."; \
		echo "  3. Then run: make deploy-passport"; \
		exit 1; \
	fi
	npx hardhat run scripts/deploy-passport.ts --network sepolia
	@echo "✅ Passport deployed"
	@echo ""
	@echo "💡 Next steps:"
	@echo "  1. Copy the deployed contract address"
	@echo "  2. Add to .env: PASSPORT_CONTRACT_ADDRESS=0x..."
	@echo "  3. Run: make link-passport"

# Link PassportNFT to RiskScoreVault
link-passport:
	@echo "🔗 Linking PassportNFT to RiskScoreVault..."
	@if [ ! -f .env ]; then \
		echo "❌ Error: .env file not found"; \
		exit 1; \
	fi
	@if [ -z "$$VAULT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: VAULT_CONTRACT_ADDRESS not set in .env"; \
		exit 1; \
	fi
	@if [ -z "$$PASSPORT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: PASSPORT_CONTRACT_ADDRESS not set in .env"; \
		echo ""; \
		echo "Deploy PassportNFT first: make deploy-passport"; \
		exit 1; \
	fi
	npx hardhat run scripts/link-passport.ts --network sepolia
	@echo "✅ PassportNFT linked to RiskScoreVault"
	@echo ""
	@echo "🎉 Deployment complete! System is ready to use."

# Deploy all contracts (full flow)
deploy-all:
	@echo "🚀 Starting full deployment flow..."
	@echo ""
	@echo "Step 1: Deploying RiskScoreVault..."
	@$(MAKE) deploy-vault
	@echo ""
	@echo "⏳ Waiting 10 seconds for vault deployment to settle..."
	@sleep 10
	@echo ""
	@echo "Step 2: Deploying PassportNFT..."
	@if [ -z "$$VAULT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: Please set VAULT_CONTRACT_ADDRESS in .env before continuing"; \
		echo "   Add the vault address from Step 1 to your .env file"; \
		exit 1; \
	fi
	@$(MAKE) deploy-passport
	@echo ""
	@echo "⏳ Waiting 5 seconds before linking..."
	@sleep 5
	@echo ""
	@echo "Step 3: Linking PassportNFT to RiskScoreVault..."
	@if [ -z "$$PASSPORT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: Please set PASSPORT_CONTRACT_ADDRESS in .env before continuing"; \
		echo "   Add the passport address from Step 2 to your .env file"; \
		exit 1; \
	fi
	@$(MAKE) link-passport
	@echo ""
	@echo "🎉 Full deployment complete!"

# Verify contracts on Etherscan
verify:
	@echo "🔍 Verifying contracts..."
	@if [ -z "$$VAULT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: VAULT_CONTRACT_ADDRESS not set"; \
		exit 1; \
	fi
	@if [ -z "$$PASSPORT_CONTRACT_ADDRESS" ]; then \
		echo "❌ Error: PASSPORT_CONTRACT_ADDRESS not set"; \
		exit 1; \
	fi
	@echo "Verifying RiskScoreVault..."
	npx hardhat verify --network sepolia $$VAULT_CONTRACT_ADDRESS $$DEPLOYER_ADDRESS
	@echo "Verifying PassportNFT..."
	npx hardhat verify --network sepolia $$PASSPORT_CONTRACT_ADDRESS $$VAULT_CONTRACT_ADDRESS $$VERIFIER_ADDRESS
	@echo "✅ Verification complete"

# Run local node
node:
	@echo "🌐 Starting local Hardhat node..."
	npx hardhat node

# Format code
format:
	@echo "✨ Formatting code..."
	npm run format || echo "⚠️  No format script configured"
	@echo "✅ Formatting complete"

# Lint code
lint:
	@echo "🔍 Linting code..."
	npm run lint || echo "⚠️  No lint script configured"
	@echo "✅ Linting complete"

# Quick test (compile + test)
quick-test: compile test
	@echo "✅ Quick test complete"

# Full check (clean, compile, test, coverage)
full-check: clean compile test test-coverage
	@echo "✅ Full check complete"

# ============================================================================
# ZK CIRCUIT COMPILATION
# ============================================================================

# Setup circom compiler
setup-circom:
	@echo "📦 Setting up circom compiler..."
	@chmod +x scripts/setup-circom.sh
	@./scripts/setup-circom.sh

# Compile ZK circuits
compile-circuit:
	@echo "🔧 Compiling ZK circuits..."
	@which circom > /dev/null || (echo "❌ circom not found. Run: make setup-circom" && exit 1)
	@cd circuits && circom passport_proof.circom --r1cs --wasm --sym -l ../../node_modules
	@echo "✅ Circuit compiled successfully"
	@echo ""
	@echo "Output files:"
	@echo "  ✓ circuits/passport_proof.r1cs  - Constraint system"
	@echo "  ✓ circuits/passport_proof.wasm  - WebAssembly"
	@echo "  ✓ circuits/passport_proof.sym   - Symbol mapping"
	@echo ""
	@echo "Next: Run trusted setup ceremony"
	@echo "  cd circuits && ./setup-ceremony.sh"

