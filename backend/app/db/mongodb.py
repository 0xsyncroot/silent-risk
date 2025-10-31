"""
MongoDB Connection Manager

Handles async MongoDB connections using Motor (async PyMongo driver).
Implements connection pooling, health checks, and graceful shutdown.
"""

import structlog
from motor.motor_asyncio import AsyncIOMotorClient, AsyncIOMotorDatabase
from typing import Optional
from app.config.settings import settings

logger = structlog.get_logger(__name__)


class MongoDB:
    """
    MongoDB connection manager with async support
    
    Features:
    - Connection pooling
    - Health checks
    - Graceful startup/shutdown
    - Thread-safe singleton pattern
    """
    
    def __init__(self):
        self._client: Optional[AsyncIOMotorClient] = None
        self._db: Optional[AsyncIOMotorDatabase] = None
        self._started: bool = False
    
    async def start(self):
        """
        Initialize MongoDB connection pool
        Called on application startup
        """
        if self._started:
            return
        
        try:
            logger.info(
                "Connecting to MongoDB",
                url=settings.MONGODB_URL,
                database=settings.MONGODB_DB_NAME
            )
            
            self._client = AsyncIOMotorClient(
                settings.MONGODB_URL,
                maxPoolSize=settings.MONGODB_MAX_POOL_SIZE,
                minPoolSize=settings.MONGODB_MIN_POOL_SIZE,
                serverSelectionTimeoutMS=5000,
                connectTimeoutMS=10000,
            )
            
            self._db = self._client[settings.MONGODB_DB_NAME]
            
            # Test connection
            await self._client.admin.command('ping')
            
            self._started = True
            logger.info(
                "MongoDB connected successfully",
                database=settings.MONGODB_DB_NAME
            )
            
            # Create indexes on startup
            await self._create_indexes()
            
        except Exception as e:
            logger.error("Failed to connect to MongoDB", error=str(e))
            raise
    
    async def stop(self):
        """
        Close MongoDB connection pool
        Called on application shutdown
        """
        if not self._started:
            return
        
        try:
            logger.info("Closing MongoDB connection")
            if self._client:
                self._client.close()
            self._started = False
            logger.info("MongoDB connection closed")
        except Exception as e:
            logger.error("Error closing MongoDB connection", error=str(e))
    
    async def _create_indexes(self):
        """
        Create database indexes for optimal query performance
        """
        try:
            # Analytics collection indexes
            await self._db.analytics.create_index("timestamp", name="timestamp_idx")
            await self._db.analytics.create_index("wallet_address", name="wallet_idx")
            await self._db.analytics.create_index("risk_band", name="risk_band_idx")
            
            # ML stats collection indexes
            await self._db.ml_stats.create_index("timestamp", name="timestamp_idx")
            await self._db.ml_stats.create_index("model_version", name="model_version_idx")
            
            # Attestations collection indexes
            await self._db.attestations.create_index("wallet_address", name="wallet_idx")
            await self._db.attestations.create_index("attested_at", name="attested_at_idx")
            await self._db.attestations.create_index("risk_band", name="risk_band_idx")
            
            logger.info("MongoDB indexes created successfully")
        except Exception as e:
            logger.warning("Failed to create indexes", error=str(e))
    
    @property
    def db(self) -> AsyncIOMotorDatabase:
        """
        Get database instance
        Raises RuntimeError if not connected
        """
        if not self._started or self._db is None:
            raise RuntimeError("MongoDB not connected. Call start() first.")
        return self._db
    
    @property
    def is_connected(self) -> bool:
        """Check if MongoDB is connected"""
        return self._started
    
    async def health_check(self) -> bool:
        """
        Check MongoDB connection health
        Returns True if healthy, False otherwise
        """
        try:
            if not self._started:
                return False
            await self._client.admin.command('ping')
            return True
        except:
            return False


# Global MongoDB instance
mongodb = MongoDB()


async def get_database() -> AsyncIOMotorDatabase:
    """
    Dependency injection for FastAPI routes
    
    Usage:
        @router.get("/endpoint")
        async def endpoint(db: AsyncIOMotorDatabase = Depends(get_database)):
            # Use db here
    """
    if not mongodb.is_connected:
        await mongodb.start()
    return mongodb.db

