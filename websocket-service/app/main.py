"""
Silent Risk - WebSocket Service

Standalone WebSocket service for real-time task status updates.
Separate from main backend for easy scaling and deployment.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.core.config import settings
from app.api.websocket import router as websocket_router
from app.services.redis_subscriber import redis_subscriber

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format='%(asctime)s - %(name)s - %(levelname)s - %(message)s'
)

logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Lifespan context manager for startup and shutdown events
    """
    # Startup
    logger.info("Starting WebSocket service...")
    
    # Start Redis subscriber for real-time updates
    await redis_subscriber.start()
    
    logger.info(f"WebSocket service started on port {settings.PORT}")
    
    yield
    
    # Shutdown
    logger.info("Shutting down WebSocket service...")
    await redis_subscriber.stop()
    logger.info("WebSocket service stopped")


# Create FastAPI app
app = FastAPI(
    title="Silent Risk - WebSocket Service",
    description="Real-time task status updates via WebSocket",
    version="1.0.0",
    lifespan=lifespan
)

# CORS middleware
app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include WebSocket router
app.include_router(websocket_router)


@app.get("/")
async def root():
    """Root endpoint"""
    return {
        "service": "Silent Risk WebSocket Service",
        "version": "1.0.0",
        "status": "running"
    }


@app.get("/health")
async def health_check():
    """
    Health check endpoint
    
    Returns service health status
    """
    redis_status = "connected" if redis_subscriber.is_connected() else "disconnected"
    
    return {
        "status": "healthy" if redis_status == "connected" else "degraded",
        "redis": redis_status,
        "active_connections": len(redis_subscriber.connection_manager.connection_subscriptions)
    }


if __name__ == "__main__":
    import uvicorn
    
    uvicorn.run(
        "app.main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
        log_level=settings.LOG_LEVEL.lower()
    )

