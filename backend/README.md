# 🌐 Silent Risk - Backend API

**FastAPI backend service for Silent Risk dApp**

RESTful API gateway that handles user requests, publishes tasks to Kafka, and manages result caching.

---

## 🎯 **Purpose**

Backend API serves as the **gateway** between frontend and worker:
- Accepts risk analysis requests from users
- Publishes messages to Kafka for async processing
- Caches results in Redis for fast retrieval
- Provides passport claim data endpoints

**Note:** Backend does NOT perform heavy computation - that's handled by the Worker.

---

## 🏗️ **Architecture**

```
Frontend → Backend API → Kafka → Worker
              ↓
           Redis Cache
              ↓
Frontend ← Backend API
```

### **Responsibilities**
1. ✅ API request validation (Pydantic)
2. ✅ Kafka message publishing
3. ✅ Redis caching for results
4. ✅ Task status tracking
5. ✅ Passport data retrieval

### **NOT Responsible For**
- ❌ Blockchain indexing (Worker's job)
- ❌ Risk calculation (Worker's job)
- ❌ FHE encryption (Worker's job)
- ❌ Passport generation (Worker's job)

---

## 📦 **Project Structure**

```
backend/
├── app/
│   ├── api/
│   │   ├── __init__.py
│   │   ├── models.py           # Pydantic request/response models
│   │   ├── risk.py             # Risk analysis endpoints
│   │   └── passport.py         # Passport data endpoints
│   │
│   ├── services/
│   │   ├── kafka_producer.py   # Kafka message publishing
│   │   └── cache.py            # Redis caching
│   │
│   ├── config/
│   │   └── settings.py         # Environment configuration
│   │
│   ├── main.py                 # FastAPI application
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
```

### **2. Setup Environment**

```bash
# Copy environment template
cp env.example .env

# Edit .env (minimal config needed):
# - KAFKA_BOOTSTRAP_SERVERS=localhost:9092
# - REDIS_URL=redis://localhost:6379/0
# - CORS_ORIGINS=["http://localhost:3000"]
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

### **4. Start Services**

```bash
# Start Kafka & Redis first (from project root)
cd ..
docker-compose up -d

# Start backend
cd backend
make dev

# Or manually:
source .venv/bin/activate
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
```

### **5. Verify**

```bash
# Check health
curl http://localhost:8000/health

# API documentation
open http://localhost:8000/docs
```

---

## 🔌 **API Endpoints**

### **Root**

```http
GET /
```
Returns API info and status.

---

### **Health Check**

```http
GET /health
```

**Response:**
```json
{
  "status": "healthy",
  "service": "backend"
}
```

---

### **Risk Analysis**

#### **Submit Analysis Request**

```http
POST /api/v1/risk/analyze
Content-Type: application/json

{
  "wallet_address": "0x1234567890123456789012345678901234567890",
  "force_refresh": false
}
```

**Response (202 Accepted):**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "pending",
  "message": "Analysis request submitted successfully",
  "progress": null,
  "result": null,
  "error": null
}
```

**Validation:**
- `wallet_address`: Must be valid Ethereum address (0x + 40 hex chars)
- Automatically lowercased

---

#### **Get Task Status**

```http
GET /api/v1/risk/status/{task_id}
```

**Response (Processing):**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "processing",
  "message": null,
  "progress": 60,
  "result": null,
  "error": null
}
```

**Response (Completed):**
```json
{
  "task_id": "550e8400-e29b-41d4-a716-446655440000",
  "status": "completed",
  "message": null,
  "progress": 100,
  "result": {
    "wallet_address": "0x1234...",
    "risk_score": 2500,
    "risk_band": "low",
    "passport": {
      "status": "ready_to_claim",
      "commitment": "0xabcd...",
      "vault_address": "0x5678...",
      "block_height": 12345,
      "tx_hash": "0xef01..."
    }
  },
  "error": null
}
```

**Status Values:**
- `pending`: Task queued
- `processing`: Worker is processing
- `completed`: Analysis done
- `failed`: Error occurred

---

#### **Get Cached Analysis**

```http
GET /api/v1/risk/wallet/{wallet_address}
```

Returns cached analysis or 404 if not found.

---

### **Passport Endpoints**

#### **Get Passport Claim Data**

```http
GET /api/v1/passport/claim-data/{wallet_address}
```

**Response (200 OK):**
```json
{
  "commitment": "0xabcd1234...",
  "secret": "0xef567890...",
  "nullifier": "0x1234abcd...",
  "wallet_address": "0x1234567890123456789012345678901234567890",
  "encrypted_score": "0x9876...",
  "vault_address": "0x5678...",
  "block_height": 12345,
  "tx_hash": "0xef01...",
  "instructions": {
    "step_1": "Keep 'secret' and 'wallet_address' PRIVATE - never share!",
    "step_2": "Use frontend to generate ZK proof with this data",
    "step_3": "Mint passport from a fresh anonymous wallet (Wallet B)",
    "step_4": "Use passport with DAOs - they verify risk without knowing your wallet",
    "privacy": "Your original wallet will NEVER be revealed on-chain",
    "security": "Store 'secret' securely - you'll need it for the ZK proof"
  }
}
```

**Error (404):**
```json
{
  "error": "passport_not_found",
  "message": "No passport data found for this wallet. Please complete risk analysis first.",
  "wallet": "0x1234..."
}
```

**Security Notes:**
- ⚠️ `secret` is PRIVATE - user must store securely
- ⚠️ `wallet_address` should NOT be revealed on-chain
- ✅ `commitment` is PUBLIC (already on-chain)
- ✅ Data cached for 24 hours after analysis

---

#### **Check Passport Status**

```http
GET /api/v1/passport/status/{wallet_address}
```

**Response:**
```json
{
  "wallet_address": "0x1234...",
  "has_analysis": true,
  "has_passport_data": true,
  "passport_status": "ready_to_claim",
  "can_claim": true,
  "message": "Passport data ready. You can claim your passport."
}
```

**Status Values:**
- `ready_to_claim`: Passport ready, user can proceed
- `not_generated`: Analysis incomplete or no passport
- `generation_failed`: Passport generation encountered error

---

## 🔧 **Configuration**

### **Environment Variables**

```bash
# Service
APP_NAME=Silent Risk Backend
APP_VERSION=1.0.0
ENVIRONMENT=development
DEBUG=true
HOST=0.0.0.0
PORT=8000
LOG_LEVEL=INFO

# Kafka
KAFKA_BOOTSTRAP_SERVERS=localhost:9092
KAFKA_TOPIC_RISK_REQUESTS=risk-analysis-requests
KAFKA_TOPIC_RISK_RESULTS=risk-analysis-results

# Redis
REDIS_URL=redis://localhost:6379/0
ANALYSIS_CACHE_TTL=1800

# API
API_V1_PREFIX=/api/v1
CORS_ORIGINS=["http://localhost:3000"]
RATE_LIMIT_PER_MINUTE=60

# Security
SECRET_KEY=dev-secret-key-change-in-production
```

### **Important Settings**

| Variable | Purpose | Default |
|----------|---------|---------|
| `KAFKA_BOOTSTRAP_SERVERS` | Kafka broker address | localhost:9092 |
| `REDIS_URL` | Redis connection URL | redis://localhost:6379/0 |
| `ANALYSIS_CACHE_TTL` | Cache TTL in seconds | 1800 (30 min) |
| `CORS_ORIGINS` | Allowed frontend origins | ["http://localhost:3000"] |

---

## 🧪 **Testing**

### **Manual Testing**

```bash
# 1. Submit analysis
curl -X POST http://localhost:8000/api/v1/risk/analyze \
  -H "Content-Type: application/json" \
  -d '{
    "wallet_address": "0x1234567890123456789012345678901234567890",
    "force_refresh": false
  }'

# 2. Check status (use task_id from response)
curl http://localhost:8000/api/v1/risk/status/{task_id}

# 3. Get passport data (after analysis complete)
curl http://localhost:8000/api/v1/passport/claim-data/0x1234567890123456789012345678901234567890
```

### **API Documentation**

Visit http://localhost:8000/docs for interactive Swagger UI.

---

## 📊 **Data Flow**

```
1. User Request
   └─> POST /risk/analyze
       └─> Validate with Pydantic
           └─> Publish to Kafka
               └─> Return task_id

2. Worker Processing (separate service)
   └─> Consumes from Kafka
       └─> Processes analysis
           └─> Writes to Redis
               └─> Publishes result to Kafka

3. User Polling
   └─> GET /risk/status/{task_id}
       └─> Read from Redis
           └─> Return status + result

4. Passport Claim
   └─> GET /passport/claim-data/{wallet}
       └─> Read from Redis (key: passport:claim:{wallet})
           └─> Return claim data for ZK proof
```

---

## 🐛 **Troubleshooting**

### **Kafka Connection Failed**

```bash
# Check Kafka is running
docker-compose ps kafka

# Check Kafka logs
docker-compose logs kafka

# Restart Kafka
docker-compose restart kafka
```

### **Redis Connection Failed**

```bash
# Check Redis is running
docker-compose ps redis

# Test Redis connection
redis-cli ping

# Restart Redis
docker-compose restart redis
```

### **CORS Errors**

Update `CORS_ORIGINS` in `.env`:
```bash
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

### **Task Not Found**

- Task may have expired (TTL: 1 hour)
- Check if worker is running
- Verify Kafka topic configuration

---

## 📝 **Development**

### **Makefile Commands**

```bash
make .venv      # Create virtual environment
make dev        # Start development server
make format     # Format code with black
make lint       # Lint with flake8
make clean      # Clean cache files
```

### **Code Style**

- **Formatter:** Black
- **Linter:** Flake8
- **Type Hints:** Recommended
- **Docstrings:** Google style

---

## 🔒 **Security**

### **Production Checklist**

- [ ] Change `SECRET_KEY` to random value
- [ ] Set `DEBUG=false`
- [ ] Use HTTPS only
- [ ] Configure proper CORS origins
- [ ] Enable rate limiting
- [ ] Use environment secrets (not .env files)
- [ ] Enable API authentication (if needed)

### **Current Security**

- ✅ Input validation with Pydantic
- ✅ CORS middleware
- ✅ Error handling without stack traces
- ⚠️ No authentication (add if needed)
- ⚠️ No rate limiting (add for production)

---

## 🚀 **Deployment**

### **Docker (Recommended)**

```dockerfile
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY app/ app/

CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "8000"]
```

### **Systemd Service**

```ini
[Unit]
Description=Silent Risk Backend
After=network.target

[Service]
Type=simple
User=silentrisk
WorkingDirectory=/opt/silent-risk/backend
Environment="PATH=/opt/silent-risk/backend/.venv/bin"
ExecStart=/opt/silent-risk/backend/.venv/bin/uvicorn app.main:app --host 0.0.0.0 --port 8000
Restart=always

[Install]
WantedBy=multi-user.target
```

---

## 📚 **Related Documentation**

- **Main README:** [../README.md](../README.md)
- **Worker:** [../worker/README.md](../worker/README.md)
- **Frontend:** [../ui/README.md](../ui/README.md)
- **API Models:** [app/api/models.py](app/api/models.py)

---

## 🤝 **Contributing**

1. Follow code style (Black + Flake8)
2. Add type hints
3. Write docstrings
4. Update API docs if adding endpoints
5. Test manually with Swagger UI

---

**Backend API - Simple, Fast, Reliable** ⚡
