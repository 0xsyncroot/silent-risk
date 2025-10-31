# 🔧 Silent Risk - Worker Service

**Python worker service for blockchain indexing, risk analysis, and passport generation**

The worker is the **core engine** that performs all heavy computation:
- On-chain data indexing via direct RPC
- Risk score calculation
- FHE encryption of scores
- Passport commitment generation
- Blockchain transaction submission

---

## 🎯 **Purpose**

Worker handles all compute-intensive and blockchain-related operations:

1. **Blockchain Indexing**: Fetch wallet data directly from Ethereum RPC
2. **Risk Analysis**: Calculate risk scores based on on-chain behavior
3. **FHE Encryption**: Encrypt scores for privacy (Zama fhEVM)
4. **Passport Generation**: Create commitments and submit to RiskScoreVault
5. **Result Caching**: Store results in Redis for backend retrieval

**Key Principle:** Worker never exposes user data - everything stays in memory or encrypted on-chain.

---

## 🏗️ **Architecture**

```
Kafka → Worker → Blockchain (RPC)
         ↓
    Risk Calculator
         ↓
    FHE Encryption
         ↓
  Passport Generation
         ↓
   RiskScoreVault (on-chain)
         ↓
    Redis Cache → Backend → Frontend
```

### **Worker Components**

1. **Kafka Consumer**: Receives analysis requests
2. **Blockchain Indexer**: Fetches on-chain data via RPC
3. **Risk Calculator**: Computes risk scores
4. **FHE Service**: Encrypts scores with Zama FHE
5. **Passport Service**: Generates commitments
6. **Blockchain Writer**: Submits to RiskScoreVault contract
7. **Cache Service**: Stores results in Redis

---

## 📦 **Project Structure**

```
worker/
├── app/
│   ├── blockchain/
│   │   ├── indexer.py          # On-chain data fetching (RPC)
│   │   ├── network_manager.py  # Multi-chain RPC management
│   │   └── constants.py        # ERC20/721 event signatures
│   │
│   ├── analysis/
│   │   └── risk_calculator.py  # Risk scoring algorithm
│   │
│   ├── services/
│   │   ├── fhe_service.py      # Zama FHE encryption
│   │   ├── passport_service.py # Passport commitment generation
│   │   ├── blockchain_writer.py # Smart contract interaction
│   │   ├── kafka_consumer.py   # Kafka message handling
│   │   ├── kafka_producer.py   # Result publishing
│   │   └── cache.py            # Redis caching
│   │
│   ├── handlers/
│   │   └── risk_analysis.py    # Main analysis handler
│   │
│   ├── config/
│   │   └── settings.py         # Environment configuration
│   │
│   ├── main.py                 # Worker entry point
│   └── __init__.py
│
├── requirements.txt            # Python dependencies
├── env.example                # Environment template
├── Makefile                   # Development commands
└── README.md                  # This file
```

---

## 🚀 **Quick Start**

### **1. Prerequisites**

```bash
- Python 3.12+
- Redis (via Docker Compose)
- Kafka (via Docker Compose)
- Ethereum RPC access (Infura/Alchemy)
- Deployed RiskScoreVault contract
- Worker wallet with ETH (for gas)
```

### **2. Setup Environment**

```bash
# Copy environment template
cp env.example .env

# Edit .env - IMPORTANT configurations:
```

**Critical Environment Variables:**

```bash
# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=silent-risk-workers
KAFKA_TOPIC_RISK_REQUESTS=risk-analysis-requests

# Redis
REDIS_URL=redis://localhost:6379/0
ANALYSIS_CACHE_TTL=1800

# Blockchain RPC (REQUIRED)
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ETH_CHAIN_ID=11155111

# Smart Contracts (REQUIRED after deployment)
VAULT_CONTRACT_ADDRESS=0x...  # Your deployed RiskScoreVault
WORKER_PRIVATE_KEY=0x...      # Worker wallet (authorized updater)

# Optional
ETHERSCAN_API_KEY=              # Rarely used, optional
WAIT_FOR_CONFIRMATION=true      # Wait for TX confirmation
```

### **3. Install Dependencies**

```bash
# Create virtual environment
make .venv

# Or manually:
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
```

### **4. Start Worker**

```bash
# Ensure Kafka & Redis are running
cd ..
docker-compose up -d

# Start worker
cd worker
make dev

# Or manually:
source .venv/bin/activate
python -m app.main
```

### **5. Verify**

```bash
# Check logs for:
# ✓ Kafka consumer connected
# ✓ Redis cache connected
# ✓ Blockchain writer initialized
# ✓ Worker ready to process messages
```

---

## ⚙️ **How It Works**

### **Complete Analysis Flow**

```
1. Receive Kafka Message
   └─> {task_id, wallet_address, force_refresh}

2. Update Status (Redis)
   └─> "processing" (10% progress)

3. Fetch Blockchain Data (40% progress)
   ├─> eth_getTransactionCount (nonce)
   ├─> eth_getBalance (current balance)
   ├─> eth_getLogs (ERC20/721 transfers)
   ├─> Binary search for first transaction
   └─> eth_getBlock (contract interactions)

4. Calculate Risk Score (60% progress)
   ├─> Analyze transaction patterns
   ├─> Calculate metrics (age, activity, diversity)
   ├─> Compute weighted risk score (0-10000)
   └─> Determine risk band (LOW/MEDIUM/HIGH)

5. Generate Passport (80% progress)
   ├─> Encrypt score with FHE
   ├─> Generate commitment = hash(wallet, encrypted_score, secret)
   ├─> Submit to RiskScoreVault (on-chain transaction)
   ├─> Wait for confirmation
   └─> Cache passport data (Redis)

6. Publish Result (90% progress)
   └─> Kafka: risk-analysis-results

7. Complete (100%)
   └─> Status: "completed"
```

---

## 🔍 **Blockchain Indexer**

### **On-Chain Data Strategy**

Worker uses **direct RPC queries** instead of third-party APIs (Etherscan):

**Advantages:**
- ✅ No rate limits
- ✅ Better privacy (no API keys)
- ✅ Faster response
- ✅ More control

**RPC Methods Used:**

| Method | Purpose | Usage |
|--------|---------|-------|
| `eth_getTransactionCount` | Get total TX count | Wallet activity level |
| `eth_getBalance` | Get current ETH balance | Financial status |
| `eth_getLogs` | Get ERC20/721 events | Token interactions |
| `eth_getBlock` | Get block details | Contract interactions |
| Binary search | Find first transaction | Account age |

### **Example: Token Transfer Detection**

```python
# Fetch ERC20 Transfer events
filter_params = {
    "fromBlock": 1000000,
    "toBlock": 2000000,
    "topics": [
        "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef",  # Transfer event
        [f"0x000000000000000000000000{wallet_address[2:].lower()}", None],  # From
        [None, f"0x000000000000000000000000{wallet_address[2:].lower()}"]   # To
    ]
}
logs = await w3.eth.get_logs(filter_params)
```

---

## 📊 **Risk Calculation**

### **Risk Factors**

Worker calculates risk based on these factors:

1. **Account Age** (Weight: 20%)
   - Older accounts = Lower risk
   - < 30 days = High risk
   - > 180 days = Low risk

2. **Transaction Volume** (Weight: 25%)
   - More transactions = Lower risk
   - < 10 TX = High risk
   - > 100 TX = Low risk

3. **Balance Stability** (Weight: 15%)
   - Consistent balance = Lower risk
   - Empty wallet = High risk

4. **Protocol Diversity** (Weight: 20%)
   - More protocols = Lower risk
   - 0-1 protocols = High risk
   - 5+ protocols = Low risk

5. **Token Diversity** (Weight: 10%)
   - More tokens = Lower risk

6. **Failed Transactions** (Weight: 10%)
   - More failures = Higher risk

### **Risk Score Formula**

```python
risk_score = (
    account_age_risk * 0.20 +
    tx_volume_risk * 0.25 +
    balance_risk * 0.15 +
    protocol_diversity_risk * 0.20 +
    token_diversity_risk * 0.10 +
    failed_tx_risk * 0.10
) * 10000  # Scale to 0-10000
```

### **Risk Bands**

| Score | Band | Description |
|-------|------|-------------|
| 0-2499 | LOW | Trusted, established wallet |
| 2500-4999 | MEDIUM | Moderate activity, acceptable |
| 5000-7499 | HIGH | New or suspicious activity |
| 7500-10000 | CRITICAL | Very risky, avoid |

---

## 🔐 **FHE & Passport Generation**

### **FHE Service**

Encrypts risk scores using Zama Fully Homomorphic Encryption:

```python
# Encrypt score
encrypted_score = await fhe_service.encrypt_risk_score(2500)

# Generate commitment
commitment = await fhe_service.generate_commitment(
    wallet_address="0x123...",
    encrypted_score=encrypted_score
)

# commitment = Poseidon(wallet_address, encrypted_score, secret)
```

**Privacy Properties:**
- Score encrypted with FHE
- DAO can query thresholds without decryption
- Commitment hides wallet and score
- Secret enables ZK proof generation

### **Passport Service**

Creates passport commitments and submits to blockchain:

```python
# Generate passport
passport_data = await passport_service.create_passport(
    wallet_address="0x123...",
    risk_score=2500
)

# Returns:
# {
#   "commitment": "0xabcd...",     # Public (on-chain)
#   "secret": "0xef01...",         # Private (for user)
#   "nullifier": "0x1234...",      # Public (prevents double-mint)
#   "encrypted_score": "0x5678...", # Public (on-chain, encrypted)
#   "tx_hash": "0x9abc..."         # Transaction hash
# }
```

### **Blockchain Writer**

Submits commitments to RiskScoreVault:

```python
# Submit to contract
tx_hash = await blockchain_writer.submit_risk_commitment(
    commitment=commitment_bytes,
    plaintext_score=2500,  # Encrypted on-chain by contract
    block_height=current_block,
    nullifier_hash=nullifier_bytes,
    address_proof=b''  # Optional ZK proof
)

# Contract function called:
# RiskScoreVault.setRiskScoreFromPlaintext(
#     bytes32 commitment,
#     uint32 plaintextScore,
#     uint256 blockHeight,
#     bytes32 nullifierHash,
#     bytes addressProof
# )
```

**Transaction Details:**
- Gas estimation with 20% buffer
- Retry logic (3 attempts with exponential backoff)
- ABI encoding with `eth_abi` library
- Waits for confirmation (configurable)

---

## 🔧 **Configuration**

### **Full Environment Variables**

```bash
# ============ SERVICE ============
APP_NAME=Silent Risk Worker
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=true
LOG_LEVEL=INFO

# ============ KAFKA ============
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_CONSUMER_GROUP=silent-risk-workers
KAFKA_TOPIC_RISK_REQUESTS=risk-analysis-requests
KAFKA_TOPIC_RISK_RESULTS=risk-analysis-results

# ============ REDIS ============
REDIS_URL=redis://localhost:6379/0
ANALYSIS_CACHE_TTL=1800

# ============ BLOCKCHAIN ============
ETH_RPC_URL=https://sepolia.infura.io/v3/YOUR_PROJECT_ID
ETH_CHAIN_ID=11155111
ETHERSCAN_API_KEY=  # Optional

# ============ SMART CONTRACTS ============
VAULT_CONTRACT_ADDRESS=0x...
WORKER_PRIVATE_KEY=0x...
WAIT_FOR_CONFIRMATION=true

# ============ ANALYSIS ============
FEATURE_WINDOW_DAYS=90
MIN_TRANSACTIONS_REQUIRED=5
VOLATILITY_WINDOW=30
```

### **Important Notes**

1. **WORKER_PRIVATE_KEY**: Must be authorized in RiskScoreVault
   ```solidity
   // Owner must call:
   vault.setAuthorizedUpdater(WORKER_ADDRESS, true);
   ```

2. **ETH_RPC_URL**: Use dedicated RPC for production (not public endpoints)

3. **WAIT_FOR_CONFIRMATION**: Set `true` for mainnet, `false` for faster dev

---

## 🧪 **Testing**

### **Manual Test Flow**

```bash
# 1. Submit analysis via backend API
curl -X POST http://localhost:8000/api/v1/risk/analyze \
  -H "Content-Type: application/json" \
  -d '{"wallet_address": "0x1234567890123456789012345678901234567890"}'

# 2. Watch worker logs
tail -f worker.log

# 3. Check Redis for result
redis-cli GET "task:result:{task_id}"

# 4. Verify on-chain commitment
# Check RiskScoreVault contract on Etherscan
```

### **Unit Tests**

```bash
# Run tests
make test

# Or manually:
source .venv/bin/activate
pytest tests/ -v
```

---

## 🐛 **Troubleshooting**

### **Kafka Consumer Not Receiving Messages**

```bash
# Check Kafka is running
docker-compose ps kafka

# Check topics exist
docker exec -it kafka kafka-topics --bootstrap-server localhost:9092 --list

# Check consumer group
docker exec -it kafka kafka-consumer-groups --bootstrap-server localhost:9092 --describe --group silent-risk-workers
```

### **RPC Errors**

```bash
# Test RPC connection
curl -X POST https://sepolia.infura.io/v3/YOUR_PROJECT_ID \
  -H "Content-Type: application/json" \
  -d '{"jsonrpc":"2.0","method":"eth_blockNumber","params":[],"id":1}'

# Check rate limits
# Solution: Use dedicated RPC or upgrade plan
```

### **Transaction Fails**

```bash
# Check worker has ETH
# Check worker is authorized in vault
# Check gas price is sufficient
# Check contract address is correct
```

### **Passport Generation Fails**

```bash
# Check VAULT_CONTRACT_ADDRESS is set
# Check WORKER_PRIVATE_KEY is set and authorized
# Check worker has ETH for gas
# Check RPC connection is stable
```

---

## 📝 **Development**

### **Makefile Commands**

```bash
make .venv      # Create virtual environment
make dev        # Start worker
make test       # Run tests
make format     # Format with black
make lint       # Lint with flake8
make clean      # Clean cache
```

### **Adding New Analysis Metrics**

1. Update `WalletMetrics` in `blockchain/indexer.py`
2. Modify `BlockchainIndexer.get_wallet_activity_summary()`
3. Update risk calculation in `analysis/risk_calculator.py`
4. Add new factor weights

### **Adding New Chain Support**

1. Add RPC URL to settings
2. Update `network_manager.py` with chain config
3. Add chain-specific constants if needed
4. Test indexer with new chain

---

## 🔒 **Security**

### **Private Key Management**

⚠️ **NEVER commit private keys!**

```bash
# Production: Use secret manager
WORKER_PRIVATE_KEY=$(aws secretsmanager get-secret-value --secret-id worker-key)

# Development: Use .env (gitignored)
WORKER_PRIVATE_KEY=0x...
```

### **Worker Permissions**

Worker only needs:
- ✅ READ blockchain data (public RPC)
- ✅ WRITE to RiskScoreVault (authorized updater)
- ❌ NO access to user wallets
- ❌ NO access to user private keys

### **Data Privacy**

- User wallet address only in memory during analysis
- No personal data stored
- Results cached encrypted in Redis
- Blockchain data is public (no privacy concerns)

---

## 🚀 **Deployment**

### **Docker**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

CMD ["python", "-m", "app.main"]
```

### **Systemd Service**

```ini
[Unit]
Description=Silent Risk Worker
After=network.target kafka.service redis.service

[Service]
Type=simple
User=silentrisk
WorkingDirectory=/opt/silent-risk/worker
Environment="PATH=/opt/silent-risk/worker/.venv/bin"
ExecStart=/opt/silent-risk/worker/.venv/bin/python -m app.main
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
```

### **Scaling**

Multiple workers can run in parallel:
- Kafka consumer group ensures message distribution
- Each worker processes different tasks
- No coordination needed between workers

```bash
# Start multiple workers
python -m app.main &  # Worker 1
python -m app.main &  # Worker 2
python -m app.main &  # Worker 3
```

---

## 📚 **Related Documentation**

- **Main README:** [../README.md](../README.md)
- **Backend:** [../backend/README.md](../backend/README.md)
- **Frontend:** [../ui/README.md](../ui/README.md)
- **Smart Contracts:** [../contracts/README.md](../contracts/README.md)

---

## 🤝 **Contributing**

1. Follow Python style guide (PEP 8)
2. Add type hints
3. Write docstrings (Google style)
4. Add tests for new features
5. Update README if changing architecture

---

**Worker - The Brain of Silent Risk** 🧠
