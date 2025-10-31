"""
Redis Cache Service (Worker Side)

Worker writes results to Redis for backend to retrieve.
Provides fast access to analysis results.
"""

import json
import logging
from typing import Optional, Dict, Any

import redis.asyncio as aioredis

from app.config.settings import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Async Redis cache for storing results
    
    Responsibilities:
    - Update task status during processing
    - Store final results
    - Cache wallet analysis for fast retrieval
    """
    
    def __init__(self):
        """Initialize cache (connection happens in start())"""
        self._redis: Optional[aioredis.Redis] = None
        self._started = False
    
    @property
    def redis(self):
        """
        Expose Redis client for direct operations
        
        Returns:
            Redis client instance
            
        Raises:
            RuntimeError: If cache not started
        """
        if not self._started or not self._redis:
            raise RuntimeError("Cache not started. Call await cache.start() first")
        return self._redis
    
    async def start(self):
        """Connect to Redis server"""
        if self._started:
            return
        
        try:
            self._redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10
            )
            
            await self._redis.ping()
            
            self._started = True
            logger.info("Redis cache connected (worker)")
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def stop(self):
        """Close Redis connection"""
        if self._redis and self._started:
            await self._redis.close()
            self._started = False
            logger.info("Redis cache closed (worker)")
    
    async def update_task_status(
        self,
        task_id: str,
        status: str,
        progress: int = 0,
        message: str = None
    ):
        """
        Update task status in cache AND broadcast via Redis Pub/Sub
        
        Args:
            task_id: Unique task identifier
            status: pending, processing, completed, failed
            progress: Progress percentage (0-100)
            message: Optional status message
        """
        if not self._started:
            await self.start()
        
        # Update Redis key for backend polling
        key = f"task:status:{task_id}"
        value = json.dumps({
            "status": status,
            "progress": progress,
            "message": message
        })
        
        await self._redis.setex(key, 3600, value)
        
        # Broadcast to WebSocket via Redis Pub/Sub
        # This allows real-time updates to client
        pubsub_message = json.dumps({
            "task_id": task_id,
            "status": status,
            "progress": progress,
            "message": message or f"{status.capitalize()} ({progress}%)"
        })
        
        # Import settings to use configured channel
        from app.config.settings import settings
        await self._redis.publish(settings.REDIS_PUBSUB_CHANNEL, pubsub_message)
        
        logger.debug(f"Updated task status: {task_id} -> {status} ({progress}%)")
    
    async def store_task_result(
        self,
        task_id: str,
        result: Dict[str, Any]
    ):
        """
        Store task result in cache
        
        Args:
            task_id: Unique task identifier
            result: Full result data
        """
        if not self._started:
            await self.start()
        
        key = f"task:result:{task_id}"
        value = json.dumps(result)
        
        await self._redis.setex(key, 3600, value)
        
        logger.info(f"Stored task result: {task_id}")
    
    async def cache_commitment_analysis(
        self,
        commitment: str,
        analysis: Dict[str, Any],
        ttl: int = 3600
    ):
        """
        Cache analysis result by commitment hash (privacy-preserving)
        
        PRIVACY: We NEVER cache by wallet address, only by commitment hash.
        This prevents linking wallet to risk score in cache.
        
        Args:
            commitment: Commitment hash
            analysis: Full analysis result
            ttl: Cache TTL in seconds (default 1 hour for privacy)
        """
        if not self._started:
            await self.start()
        
        key = f"analysis:commitment:{commitment}"
        value = json.dumps(analysis)
        
        await self._redis.setex(key, ttl, value)
        
        logger.info(f"Cached analysis for commitment {commitment[:10]}... (TTL: {ttl}s)")


# Global cache instance
cache = CacheService()

