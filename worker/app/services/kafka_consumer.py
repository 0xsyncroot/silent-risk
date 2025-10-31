"""
Kafka Consumer Service

Consumes messages from Kafka topics and processes them asynchronously.
This is the main entry point for worker task processing.
"""

import asyncio
import json
import logging
from typing import Callable, Dict, Any

from aiokafka import AIOKafkaConsumer
from aiokafka.errors import KafkaError

from app.config.settings import settings

logger = logging.getLogger(__name__)


class KafkaConsumerService:
    """
    Async Kafka consumer for processing task requests
    
    Responsibilities:
    - Subscribe to Kafka topics
    - Consume messages and deserialize
    - Route messages to appropriate handlers
    - Handle errors and retries
    - Commit offsets after successful processing
    
    Architecture:
    - Consumer group for horizontal scaling
    - Auto-commit disabled for manual control
    - Message handlers registered per topic
    """
    
    def __init__(self):
        """Initialize consumer (connection happens in start())"""
        self._consumer: AIOKafkaConsumer = None
        self._handlers: Dict[str, Callable] = {}
        self._running = False
    
    def register_handler(self, topic: str, handler: Callable):
        """
        Register message handler for a topic
        
        Args:
            topic: Kafka topic name
            handler: Async function to process messages
                     Signature: async def handler(message: Dict) -> None
        """
        self._handlers[topic] = handler
        logger.info(f"Registered handler for topic: {topic}")
    
    async def start(self):
        """
        Start Kafka consumer and begin processing messages
        
        This method will run indefinitely until stop() is called.
        Must be called after registering all handlers.
        """
        if not self._handlers:
            logger.warning("No handlers registered. Consumer will not process messages.")
            return
        
        topics = list(self._handlers.keys())
        
        try:
            self._consumer = AIOKafkaConsumer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                group_id=settings.KAFKA_CONSUMER_GROUP,
                value_deserializer=lambda m: json.loads(m.decode('utf-8')),
                key_deserializer=lambda k: k.decode('utf-8') if k else None,
                enable_auto_commit=False,  # Manual commit for reliability
                auto_offset_reset='earliest',
                max_poll_records=10,
                session_timeout_ms=30000,
            )
            
            # CRITICAL: Subscribe BEFORE start for proper consumer group coordination
            self._consumer.subscribe(topics)
            
            await self._consumer.start()
            self._running = True
            
            logger.info(
                "Kafka consumer connected and subscribed",
                extra={
                    "bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS,
                    "group_id": settings.KAFKA_CONSUMER_GROUP,
                    "topics": topics
                }
            )
            
            # Start consuming messages
            logger.info("Starting message consume loop...")
            await self._consume_loop()
            logger.info("Consume loop ended")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka consumer: {e}")
            raise
    
    async def stop(self):
        """
        Stop Kafka consumer gracefully
        
        Waits for in-flight messages to complete.
        """
        self._running = False
        
        if self._consumer:
            await self._consumer.stop()
            logger.info("Kafka consumer stopped")
    
    async def _consume_loop(self):
        """
        Main consume loop
        
        Continuously polls for messages and processes them.
        """
        logger.info("Kafka consumer started - waiting for messages...")
        try:
            async for msg in self._consumer:
                logger.info(
                    f"📨 RECEIVED MESSAGE",
                    extra={
                        "topic": msg.topic,
                        "partition": msg.partition,
                        "offset": msg.offset,
                        "timestamp": msg.timestamp
                    }
                )
                
                if not self._running:
                    break
                
                try:
                    await self._process_message(msg)
                    
                    # Commit offset after successful processing
                    await self._consumer.commit()
                    
                except Exception as e:
                    logger.error(
                        f"Failed to process message from {msg.topic}",
                        extra={
                            "topic": msg.topic,
                            "partition": msg.partition,
                            "offset": msg.offset,
                            "error": str(e)
                        },
                        exc_info=True
                    )
                    
                    # Don't commit offset on error - message will be reprocessed
                    # TODO: Implement dead letter queue for repeated failures
                    
        except asyncio.CancelledError:
            logger.info("Consume loop cancelled")
        except Exception as e:
            logger.error(f"Consume loop error: {e}", exc_info=True)
    
    async def _process_message(self, msg):
        """
        Process a single message
        
        Args:
            msg: Kafka message object with topic, value, key, etc.
        """
        topic = msg.topic
        value = msg.value
        key = msg.key
        
        logger.info(
            f"Processing message from {topic}",
            extra={
                "topic": topic,
                "key": key,
                "offset": msg.offset,
                "partition": msg.partition
            }
        )
        
        # Get handler for topic
        logger.info(f"🔍 Looking for handler for topic: {topic}")
        logger.info(f"📋 Available handlers: {list(self._handlers.keys())}")
        
        handler = self._handlers.get(topic)
        if not handler:
            logger.warning(f"⚠️  NO HANDLER for topic: {topic}")
            return
        
        logger.info(f"✅ Handler found! Executing...")
        
        # Execute handler
        try:
            logger.info(f"🔄 Calling handler with value: {value}")
            await handler(value)
            
            logger.info(
                f"Successfully processed message",
                extra={
                    "topic": topic,
                    "task_id": value.get("task_id"),
                    "offset": msg.offset
                }
            )
            
        except Exception as e:
            logger.error(f"Handler error for {topic}: {e}", exc_info=True)
            raise


# Global consumer instance
kafka_consumer = KafkaConsumerService()

