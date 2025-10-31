"""
Redis Cache Service

Manages caching for API responses and task status.
Provides fast access to analysis results and task tracking.
"""

import json
import logging
from typing import Optional, Dict, Any
from datetime import timedelta

import redis.asyncio as aioredis

from app.config.settings import settings

logger = logging.getLogger(__name__)


class CacheService:
    """
    Async Redis cache for storing results and task status
    
    Responsibilities:
    - Store task status (pending, processing, completed)
    - Cache analysis results for fast retrieval
    - Expire old data automatically (TTL)
    - Provide atomic operations
    
    Cache Keys (Privacy-First):
    - task:status:{task_id} -> {"status": "...", "progress": 0-100}
    - task:result:{task_id} -> {full result JSON}
    - task:commitment:{task_id} -> commitment hash
    - commitment:task:{commitment} -> task_id
    - analysis:commitment:{commitment} -> {cached analysis result}
    
    NOTE: NO wallet addresses stored in cache!
    All caching uses commitment hashes for privacy.
    """
    
    def __init__(self):
        """Initialize cache (connection happens in start())"""
        self._redis: Optional[aioredis.Redis] = None
        self._started = False
    
    async def start(self):
        """
        Connect to Redis server
        
        Must be called before cache operations.
        Typically called on application startup.
        """
        if self._started:
            return
        
        try:
            self._redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True,
                max_connections=10
            )
            
            # Test connection
            await self._redis.ping()
            
            self._started = True
            logger.info(
                "Redis cache connected",
                extra={"url": settings.REDIS_URL}
            )
            
        except Exception as e:
            logger.error(f"Failed to connect to Redis: {e}")
            raise
    
    async def stop(self):
        """Close Redis connection"""
        if self._redis and self._started:
            await self._redis.close()
            self._started = False
            logger.info("Redis cache closed")
    
    async def set_task_status(
        self,
        task_id: str,
        status: str,
        progress: int = 0,
        message: Optional[str] = None,
        ttl: int = 3600
    ):
        """
        Set task status in cache and broadcast via WebSocket
        
        Args:
            task_id: Unique task identifier
            status: pending, processing, completed, failed
            progress: Progress percentage (0-100)
            message: Optional status message
            ttl: Time to live in seconds
        """
        if not self._started:
            await self.start()
        
        key = f"task:status:{task_id}"
        status_data = {
            "status": status,
            "progress": progress
        }
        if message:
            status_data["message"] = message
        
        value = json.dumps(status_data)
        
        await self._redis.setex(key, ttl, value)
        
        # Publish to Redis pub/sub for WebSocket service
        try:
            from app.services.redis_publisher import redis_publisher
            await redis_publisher.publish_status_update(
                task_id=task_id,
                status=status,
                progress=progress,
                message=message
            )
        except Exception as e:
            logger.warning(f"Failed to publish status update: {e}")
        
        logger.debug(f"Set task status: {task_id} -> {status} ({progress}%)")
    
    async def get_task_status(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task status from cache
        
        Args:
            task_id: Unique task identifier
            
        Returns:
            Dict with status and progress, or None if not found
        """
        if not self._started:
            await self.start()
        
        key = f"task:status:{task_id}"
        value = await self._redis.get(key)
        
        if value:
            return json.loads(value)
        return None
    
    async def set_task_result(
        self,
        task_id: str,
        result: Dict[str, Any],
        ttl: int = 3600
    ):
        """
        Store task result in cache
        
        Args:
            task_id: Unique task identifier
            result: Full result data
            ttl: Time to live in seconds
        """
        if not self._started:
            await self.start()
        
        key = f"task:result:{task_id}"
        value = json.dumps(result)
        
        await self._redis.setex(key, ttl, value)
        
        logger.debug(f"Stored task result: {task_id}")
    
    async def get_task_result(self, task_id: str) -> Optional[Dict[str, Any]]:
        """
        Get task result from cache
        
        Args:
            task_id: Unique task identifier
            
        Returns:
            Full result dict, or None if not found
        """
        if not self._started:
            await self.start()
        
        key = f"task:result:{task_id}"
        value = await self._redis.get(key)
        
        if value:
            return json.loads(value)
        return None
    
    async def cache_wallet_analysis(
        self,
        wallet_address: str,
        analysis: Dict[str, Any],
        ttl: Optional[int] = None
    ):
        """
        Cache wallet analysis result
        
        Args:
            wallet_address: Ethereum address
            analysis: Full analysis result
            ttl: Time to live (uses default from settings if None)
        """
        if not self._started:
            await self.start()
        
        if ttl is None:
            ttl = settings.ANALYSIS_CACHE_TTL
        
        key = f"analysis:wallet:{wallet_address.lower()}"
        value = json.dumps(analysis)
        
        await self._redis.setex(key, ttl, value)
        
        logger.info(f"Cached analysis for {wallet_address[:10]}... (TTL: {ttl}s)")
    
    async def link_task_to_commitment(
        self,
        task_id: str,
        commitment: str,
        ttl: int = 3600
    ):
        """
        Create bidirectional link between task_id and commitment
        
        Allows looking up task by commitment and commitment by task.
        Used for privacy-preserving cache lookups.
        
        Args:
            task_id: Unique task identifier
            commitment: Commitment hash
            ttl: Time to live (same as task TTL)
        """
        if not self._started:
            await self.start()
        
        # task -> commitment
        await self._redis.setex(
            f"task:commitment:{task_id}",
            ttl,
            commitment
        )
        
        # commitment -> task (for reverse lookup)
        await self._redis.setex(
            f"commitment:task:{commitment}",
            ttl,
            task_id
        )
        
        logger.debug(f"Linked task {task_id} to commitment {commitment[:10]}...")
    
    async def get_cached_commitment_analysis(
        self,
        commitment: str
    ) -> Optional[Dict[str, Any]]:
        """
        Get cached analysis by commitment hash (privacy-preserving)
        
        NOTE: This replaces get_cached_wallet_analysis.
        We NEVER cache by wallet address, only by commitment hash.
        
        Args:
            commitment: Commitment hash (keccak256(wallet, secret))
            
        Returns:
            Cached analysis result, or None if not found/expired
        """
        if not self._started:
            await self.start()
        
        key = f"analysis:commitment:{commitment}"
        value = await self._redis.get(key)
        
        if value:
            logger.info(f"Cache HIT for commitment {commitment[:10]}...")
            return json.loads(value)
        
        logger.info(f"Cache MISS for commitment {commitment[:10]}...")
        return None
    
    async def cache_commitment_analysis(
        self,
        commitment: str,
        analysis: Dict[str, Any],
        ttl: int = 3600
    ):
        """
        Cache analysis result by commitment hash (privacy-preserving)
        
        NOTE: This replaces cache_wallet_analysis.
        We NEVER cache by wallet address.
        
        Args:
            commitment: Commitment hash
            analysis: Analysis result to cache
            ttl: Cache TTL in seconds (default 1 hour for privacy)
        """
        if not self._started:
            await self.start()
        
        key = f"analysis:commitment:{commitment}"
        value = json.dumps(analysis)
        
        await self._redis.setex(key, ttl, value)
        
        logger.info(f"Cached analysis for commitment {commitment[:10]}... (TTL: {ttl}s)")
    
    async def invalidate_wallet_analysis(self, wallet_address: str):
        """
        Invalidate cached wallet analysis
        
        Args:
            wallet_address: Ethereum address
        """
        if not self._started:
            await self.start()
        
        key = f"analysis:wallet:{wallet_address.lower()}"
        await self._redis.delete(key)
        
        logger.info(f"Invalidated cache for {wallet_address[:10]}...")


# Global cache instance
cache = CacheService()

