"""
Redis Pub/Sub Subscriber

Listens to Redis pub/sub channel for task status updates
and broadcasts them to WebSocket clients.

Architecture:
  Backend/Worker → Redis Pub/Sub → WebSocket Service → Clients
"""

import logging
import json
import asyncio
from typing import Optional

import redis.asyncio as aioredis

from app.core.config import settings
from app.core.connection_manager import connection_manager

logger = logging.getLogger(__name__)


class RedisSubscriber:
    """
    Redis pub/sub subscriber for task status updates
    
    Flow:
    1. Backend/Worker publish to Redis channel: task_status_updates
    2. This service subscribes to the channel
    3. On message received, broadcast to WebSocket clients
    """
    
    def __init__(self):
        self._redis: Optional[aioredis.Redis] = None
        self._pubsub: Optional[aioredis.client.PubSub] = None
        self._subscriber_task: Optional[asyncio.Task] = None
        self._running = False
    
    async def start(self):
        """Start Redis subscriber"""
        if self._running:
            return
        
        try:
            # Connect to Redis
            self._redis = await aioredis.from_url(
                settings.REDIS_URL,
                encoding="utf-8",
                decode_responses=True
            )
            
            # Test connection
            await self._redis.ping()
            logger.info(f"Connected to Redis: {settings.REDIS_URL}")
            
            # Create pub/sub instance
            self._pubsub = self._redis.pubsub()
            
            # Subscribe to channel
            await self._pubsub.subscribe(settings.REDIS_PUBSUB_CHANNEL)
            logger.info(f"Subscribed to Redis channel: {settings.REDIS_PUBSUB_CHANNEL}")
            
            # Start subscriber task
            self._running = True
            self._subscriber_task = asyncio.create_task(self._listen())
            
            logger.info("Redis subscriber started")
            
        except Exception as e:
            logger.error(f"Failed to start Redis subscriber: {e}")
            raise
    
    async def stop(self):
        """Stop Redis subscriber"""
        if not self._running:
            return
        
        logger.info("Stopping Redis subscriber...")
        
        self._running = False
        
        # Cancel subscriber task
        if self._subscriber_task:
            self._subscriber_task.cancel()
            try:
                await self._subscriber_task
            except asyncio.CancelledError:
                pass
        
        # Unsubscribe and close
        if self._pubsub:
            await self._pubsub.unsubscribe(settings.REDIS_PUBSUB_CHANNEL)
            await self._pubsub.close()
        
        if self._redis:
            await self._redis.close()
        
        logger.info("Redis subscriber stopped")
    
    async def _listen(self):
        """
        Listen for messages on Redis pub/sub channel
        
        Message format:
        {
            "task_id": "uuid",
            "status": "processing",
            "progress": 40,
            "message": "Fetching blockchain data..."
        }
        """
        try:
            while self._running:
                message = await self._pubsub.get_message(
                    ignore_subscribe_messages=True,
                    timeout=1.0
                )
                
                if message and message['type'] == 'message':
                    await self._handle_message(message['data'])
        
        except asyncio.CancelledError:
            logger.info("Subscriber task cancelled")
        except Exception as e:
            logger.error(f"Error in subscriber loop: {e}", exc_info=True)
            # Attempt to reconnect
            if self._running:
                logger.info("Attempting to reconnect in 5 seconds...")
                await asyncio.sleep(5)
                await self.start()
    
    async def _handle_message(self, data: str):
        """
        Handle received message from Redis
        
        Args:
            data: JSON string with task status update
        """
        try:
            # Parse message
            message = json.loads(data)
            task_id = message.get("task_id")
            
            if not task_id:
                logger.warning(f"Received message without task_id: {data}")
                return
            
            # Extract status data
            status_data = {
                "status": message.get("status"),
                "progress": message.get("progress", 0),
                "message": message.get("message", "")
            }
            
            # Broadcast to WebSocket clients
            await connection_manager.broadcast_status_update(task_id, status_data)
            
            logger.debug(f"Broadcasted update for task {task_id}: {status_data}")
        
        except json.JSONDecodeError:
            logger.error(f"Failed to parse message: {data}")
        except Exception as e:
            logger.error(f"Error handling message: {e}", exc_info=True)
    
    def is_connected(self) -> bool:
        """Check if Redis subscriber is connected"""
        return self._running and self._redis is not None


# Global instance
redis_subscriber = RedisSubscriber()

