# 🔌 Silent Risk - WebSocket Service

**Standalone WebSocket service for real-time task status updates**

---

## 🎯 **Overview**

Separated WebSocket service cho dễ dàng scaling và deployment riêng biệt với backend chính.

### **Architecture:**

```
Backend/Worker → Redis Pub/Sub → WebSocket Service → Clients
```

**Benefits:**
- ✅ Independent scaling
- ✅ Easy deployment
- ✅ Clean separation of concerns
- ✅ Backend doesn't manage WebSocket connections

---

## 🚀 **Quick Start**

### **Local Development:**

```bash
# 1. Install dependencies
make install

# 2. Copy environment file
cp env.example .env

# 3. Ensure Redis is running
docker-compose up -d redis

# 4. Run service
make dev
```

Service starts on `http://localhost:8001`

### **Using Docker:**

```bash
# Start all services
docker-compose up -d

# Check logs
docker-compose logs -f websocket

# Stop services
docker-compose down
```

---

## 📦 **Architecture**

### **Components:**

```
app/
├── main.py                          # FastAPI application
├── core/
│   ├── config.py                    # Configuration
│   └── connection_manager.py        # WebSocket connection manager
├── services/
│   └── redis_subscriber.py          # Redis pub/sub subscriber
└── api/
    └── websocket.py                 # WebSocket routes
```

### **Flow:**

1. **Backend/Worker publishes** task update to Redis:
   ```python
   # In backend or worker
   redis.publish('task_status_updates', json.dumps({
       'task_id': 'uuid',
       'status': 'processing',
       'progress': 40,
       'message': 'Fetching blockchain data...'
   }))
   ```

2. **WebSocket Service subscribes** to Redis channel and receives update

3. **WebSocket Service broadcasts** to all connected clients subscribed to that task

4. **Clients receive** real-time update instantly

---

## 🔌 **WebSocket Protocol**

### **Connection:**

```javascript
const ws = new WebSocket('ws://localhost:8001/ws');
```

### **Subscribe to Task:**

```javascript
ws.send(JSON.stringify({
  type: 'subscribe',
  task_id: '550e8400-e29b-41d4-a716-446655440000'
}));
```

**Response:**
```json
{
  "type": "subscribed",
  "task_id": "550e8400-...",
  "message": "Successfully subscribed"
}
```

### **Receive Updates:**

```json
{
  "type": "status_update",
  "task_id": "550e8400-...",
  "data": {
    "status": "processing",
    "progress": 40,
    "message": "Fetching blockchain data..."
  }
}
```

### **Unsubscribe:**

```javascript
ws.send(JSON.stringify({
  type: 'unsubscribe',
  task_id: '550e8400-e29b-41d4-a716-446655440000'
}));
```

---

## 🔧 **Configuration**

### **Environment Variables:**

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | 8001 | Service port |
| `REDIS_URL` | redis://localhost:6379/0 | Redis connection URL |
| `REDIS_PUBSUB_CHANNEL` | task_status_updates | Redis pub/sub channel |
| `WS_MAX_CONNECTIONS` | 1000 | Max concurrent connections |
| `LOG_LEVEL` | INFO | Logging level |

### **CORS:**

Configure allowed origins in `.env`:
```bash
CORS_ORIGINS=["http://localhost:3000","http://localhost:3001"]
```

---

## 📊 **Monitoring**

### **Health Check:**

```bash
curl http://localhost:8001/health
```

**Response:**
```json
{
  "status": "healthy",
  "redis": "connected",
  "active_connections": 5
}
```

### **WebSocket Statistics:**

```bash
curl http://localhost:8001/ws/stats
```

**Response:**
```json
{
  "total_connections": 5,
  "total_subscriptions": 12,
  "tasks_with_subscribers": 8,
  "connections_per_task": {
    "task-1": 2,
    "task-2": 3
  }
}
```

---

## 🧪 **Testing**

### **Manual Testing with wscat:**

```bash
# Install wscat
npm install -g wscat

# Connect
wscat -c ws://localhost:8001/ws

# Subscribe
> {"type": "subscribe", "task_id": "test-123"}

# Receive confirmation
< {"type": "subscribed", "task_id": "test-123", ...}
```

### **Test with Python:**

```python
import asyncio
import websockets
import json

async def test():
    async with websockets.connect('ws://localhost:8001/ws') as ws:
        # Subscribe
        await ws.send(json.dumps({
            'type': 'subscribe',
            'task_id': 'test-123'
        }))
        
        # Receive messages
        while True:
            message = await ws.recv()
            print('Received:', message)

asyncio.run(test())
```

---

## 🚢 **Deployment**

### **Docker:**

```bash
# Build image
docker build -t silent-risk-websocket .

# Run container
docker run -d \
  -p 8001:8001 \
  -e REDIS_URL=redis://redis:6379/0 \
  --name websocket \
  silent-risk-websocket
```

### **Docker Compose:**

```bash
docker-compose up -d
```

### **Kubernetes (Example):**

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: websocket-service
spec:
  replicas: 3
  selector:
    matchLabels:
      app: websocket
  template:
    metadata:
      labels:
        app: websocket
    spec:
      containers:
      - name: websocket
        image: silent-risk-websocket:latest
        ports:
        - containerPort: 8001
        env:
        - name: REDIS_URL
          value: "redis://redis-service:6379/0"
```

---

## 📈 **Scaling**

### **Horizontal Scaling:**

```bash
# Scale to 3 instances
docker-compose up -d --scale websocket=3
```

**Note:** Multiple WebSocket instances work fine because they all subscribe to the same Redis channel. Clients can connect to any instance.

### **Load Balancing:**

```nginx
# Nginx config
upstream websocket_backend {
    server websocket1:8001;
    server websocket2:8001;
    server websocket3:8001;
}

server {
    location /ws {
        proxy_pass http://websocket_backend;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "upgrade";
    }
}
```

---

## 🔐 **Security**

### **Current:**
- JSON validation
- Error handling
- Connection cleanup

### **Recommended for Production:**
- JWT token authentication
- Rate limiting per IP
- Message size limits
- TLS/SSL (wss://)
- Firewall rules

---

## 🐛 **Troubleshooting**

### **WebSocket not connecting:**

1. Check service is running:
   ```bash
   curl http://localhost:8001/health
   ```

2. Check Redis connection:
   ```bash
   redis-cli ping
   ```

3. Check logs:
   ```bash
   docker-compose logs websocket
   ```

### **Not receiving updates:**

1. Verify Redis pub/sub channel name matches
2. Check backend is publishing to correct channel
3. Verify client subscribed to correct task_id

---

## 📚 **Integration with Backend**

### **Backend Side (Publishing):**

```python
# In backend/app/services/cache.py
import redis.asyncio as aioredis

async def set_task_status(task_id, status, progress, message):
    # Update Redis cache
    await redis.setex(f"task:status:{task_id}", 3600, json.dumps({
        "status": status,
        "progress": progress,
        "message": message
    }))
    
    # Publish to WebSocket service
    await redis.publish('task_status_updates', json.dumps({
        'task_id': task_id,
        'status': status,
        'progress': progress,
        'message': message
    }))
```

### **Frontend Side (Consuming):**

```typescript
// Use the existing useWebSocket hook
const { subscribe } = useWebSocket({
  url: 'ws://localhost:8001/ws',  // Changed port!
  onMessage: (msg) => {
    if (msg.type === 'status_update') {
      setProgress(msg.data.progress);
    }
  }
});
```

---

## 🎯 **Best Practices**

1. **Use environment variables** for configuration
2. **Monitor connection count** for scaling decisions
3. **Set reasonable timeouts** for idle connections
4. **Log important events** for debugging
5. **Use health checks** in production
6. **Enable TLS** for production (wss://)
7. **Implement authentication** for production
8. **Set max connections limit** to prevent DoS

---

## 📄 **License**

Part of Silent Risk project.

---

## 🤝 **Contributing**

This is a standalone service that can be deployed independently. Follow the main project's contribution guidelines.

---

**🎉 WebSocket Service ready for independent deployment!**

