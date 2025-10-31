"""
Silent Risk Backend - FastAPI Application

Privacy-preserving AI-powered risk analysis for Web3.
Clean architecture with Kafka-based async processing.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from app.api.risk import router as risk_router
from app.api.passport import router as passport_router
from app.api.strategy import router as strategy_router
from app.api.analytics import router as analytics_router
from app.api.attestations import router as attestations_router
from app.api.ml import router as ml_router
from app.config.settings import settings
from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.services.redis_publisher import redis_publisher
from app.db.mongodb import mongodb

# Configure logging
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s"
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager
    
    Handles startup and shutdown of services:
    - Kafka producer connection
    - Redis cache connection
    """
    # Startup
    logger.info("🚀 Starting Silent Risk Backend...")
    
    try:
        await kafka_producer.start()
        logger.info("✓ Kafka producer connected")
    except Exception as e:
        logger.error(f"✗ Kafka connection failed: {e}")
    
    try:
        await cache.start()
        logger.info("✓ Redis cache connected")
    except Exception as e:
        logger.error(f"✗ Redis connection failed: {e}")
    
    try:
        await redis_publisher.start()
        logger.info("✓ Redis publisher connected")
    except Exception as e:
        logger.error(f"✗ Redis publisher failed: {e}")
    
    try:
        await mongodb.start()
        logger.info("✓ MongoDB connected (ML stats only)")
    except Exception as e:
        logger.error(f"✗ MongoDB connection failed: {e}")
        logger.warning("⚠️  ML stats will be unavailable")
    
    logger.info("✅ Backend ready (Privacy-First: No wallet data storage)")
    
    yield
    
    # Shutdown
    logger.info("🛑 Shutting down...")
    
    await kafka_producer.stop()
    await cache.stop()
    await redis_publisher.stop()
    await mongodb.stop()
    
    logger.info("✅ Shutdown complete")


# Create FastAPI application
app = FastAPI(
    title="Silent Risk API",
    description="Privacy-preserving AI-powered risk analysis for Web3",
    version=settings.APP_VERSION,
    docs_url="/docs",
    redoc_url="/redoc",
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

# Include API routers
app.include_router(risk_router, prefix=settings.API_V1_PREFIX)
app.include_router(passport_router, prefix=settings.API_V1_PREFIX)
app.include_router(strategy_router, prefix=settings.API_V1_PREFIX)
app.include_router(analytics_router, prefix=settings.API_V1_PREFIX)
app.include_router(attestations_router, prefix=settings.API_V1_PREFIX)
app.include_router(ml_router, prefix=settings.API_V1_PREFIX)


@app.get("/")
async def root():
    """
    Root endpoint
    
    Returns basic API information.
    """
    return {
        "name": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "docs": "/docs",
        "status": "running"
    }


@app.get("/health")
async def health():
    """
    Health check endpoint
    
    Used by load balancers and monitoring systems.
    """
    return {
        "status": "healthy",
        "service": "backend"
    }


@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    """
    Global exception handler
    
    Catches unhandled exceptions and returns generic error response.
    """
    logger.error(f"Unhandled exception: {exc}", exc_info=True)
    return JSONResponse(
        status_code=500,
        content={"detail": "Internal server error"}
    )
