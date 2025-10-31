"""
Redis Publisher Service

Publishes task status updates to Redis pub/sub channel
for WebSocket service to broadcast to clients.
"""

import logging
import json
from typing import Optional

import redis.asyncio as aioredis

from app.config.settings import settings

logger = logging.getLogger(__name__)


class RedisPublisher:
    """
    Redis publisher for task status updates
    
    Architecture:
    - Backend publishes updates to Redis pub/sub channel
    - WebSocket service subscribes to channel
    - WebSocket service broadcasts to clients
    """
    
    PUBSUB_CHANNEL = "task_status_updates"
    
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._started = False
    
    async def start(self):
        """Connect to Redis"""
        if self._started:
            return
        
        try:
            self._redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            
            await self._redis.ping()
            
            self._started = True
            logger.info("Redis publisher connected")
        
        except Exception as e:
            logger.error(f"Failed to connect Redis publisher: {e}")
            raise
    
    async def stop(self):
        """Close Redis connection"""
        if self._redis and self._started:
            await self._redis.close()
            self._started = False
            logger.info("Redis publisher closed")
    
    async def publish_status_update(
        self,
        task_id: str,
        status: str,
        progress: int = 0,
        message: Optional[str] = None
    ):
        """
        Publish task status update to Redis channel
        
        Args:
            task_id: Task identifier
            status: Task status (pending, processing, completed, failed)
            progress: Progress percentage (0-100)
            message: Optional status message
        """
        if not self._started:
            await self.start()
        
        update = {
            "task_id": task_id,
            "status": status,
            "progress": progress
        }
        
        if message:
            update["message"] = message
        
        try:
            # Publish to Redis channel
            await self._redis.publish(
                self.PUBSUB_CHANNEL,
                json.dumps(update)
            )
            
            logger.debug(
                f"Published status update for task {task_id}: "
                f"{status} ({progress}%)"
            )
        
        except Exception as e:
            logger.error(f"Failed to publish status update: {e}")


# Global instance
redis_publisher = RedisPublisher()

