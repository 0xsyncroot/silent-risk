"""
Kafka Producer Service (Worker Side)

Publishes results back to Kafka after processing.
Worker uses this to send results to backend.
"""

import json
import logging
from typing import Dict, Any, Optional
from datetime import datetime

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

from app.config.settings import settings

logger = logging.getLogger(__name__)


class KafkaProducerService:
    """
    Async Kafka producer for publishing task results
    
    Responsibilities:
    - Publish task results to result topics
    - Handle serialization
    - Retry on failures
    """
    
    def __init__(self):
        """Initialize producer (connection happens in start())"""
        self._producer: Optional[AIOKafkaProducer] = None
        self._started = False
    
    async def start(self):
        """Start Kafka producer connection"""
        if self._started:
            return
        
        try:
            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                compression_type='gzip',
                acks='all',
                request_timeout_ms=30000,  # 30 seconds
                # Note: 'retries' removed - aiokafka handles retries automatically
            )
            
            await self._producer.start()
            self._started = True
            
            logger.info("Kafka producer started (worker)")
            
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            raise
    
    async def stop(self):
        """Stop Kafka producer connection"""
        if self._producer and self._started:
            await self._producer.stop()
            self._started = False
            logger.info("Kafka producer stopped (worker)")
    
    async def publish_risk_analysis_result(
        self,
        task_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """
        Publish risk analysis result
        
        Args:
            task_id: Task identifier from original request
            status: completed or failed
            result: Analysis result dict (if successful)
            error: Error message (if failed)
        """
        if not self._started:
            await self.start()
        
        message = {
            "task_id": task_id,
            "status": status,
            "result": result,
            "error": error,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        try:
            await self._producer.send_and_wait(
                settings.KAFKA_TOPIC_RISK_RESULTS,
                value=message,
                key=task_id
            )
            
            logger.info(
                f"Published risk analysis result",
                extra={
                    "task_id": task_id,
                    "status": status,
                    "topic": settings.KAFKA_TOPIC_RISK_RESULTS
                }
            )
            
        except KafkaError as e:
            logger.error(f"Failed to publish result: {e}")
            raise
    
    async def publish_strategy_validation_result(
        self,
        task_id: str,
        status: str,
        result: Optional[Dict[str, Any]] = None,
        error: Optional[str] = None
    ):
        """
        Publish strategy validation result
        
        Args:
            task_id: Task identifier from original request
            status: completed or failed
            result: Validation result dict (if successful)
            error: Error message (if failed)
        """
        if not self._started:
            await self.start()
        
        message = {
            "task_id": task_id,
            "status": status,
            "result": result,
            "error": error,
            "processed_at": datetime.utcnow().isoformat()
        }
        
        try:
            await self._producer.send_and_wait(
                settings.KAFKA_TOPIC_STRATEGY_RESULTS,
                value=message,
                key=task_id
            )
            
            logger.info(
                f"Published strategy validation result",
                extra={
                    "task_id": task_id,
                    "status": status,
                    "topic": settings.KAFKA_TOPIC_STRATEGY_RESULTS
                }
            )
            
        except KafkaError as e:
            logger.error(f"Failed to publish result: {e}")
            raise


# Global producer instance
kafka_producer = KafkaProducerService()

