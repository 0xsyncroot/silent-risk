"""
Kafka Producer Service

Publishes messages to Kafka topics for async processing.
This service handles all outgoing messages from backend to workers.
"""

import json
import logging
import uuid
from typing import Dict, Any, Optional
from datetime import datetime

from aiokafka import AIOKafkaProducer
from aiokafka.errors import KafkaError

from app.config.settings import settings

logger = logging.getLogger(__name__)


class KafkaProducerService:
    """
    Async Kafka producer for publishing task requests
    
    Responsibilities:
    - Connect to Kafka cluster
    - Publish messages to topics with proper serialization
    - Handle connection errors and retries
    - Generate unique task IDs
    
    Architecture:
    - Singleton pattern for connection pooling
    - JSON serialization for all messages
    - Automatic message key generation for partitioning
    """
    
    def __init__(self):
        """Initialize producer (connection happens in start())"""
        self._producer: Optional[AIOKafkaProducer] = None
        self._started = False
    
    async def start(self):
        """
        Start Kafka producer connection
        
        Must be called before sending messages.
        Typically called on application startup.
        """
        if self._started:
            return
        
        try:
            self._producer = AIOKafkaProducer(
                bootstrap_servers=settings.KAFKA_BOOTSTRAP_SERVERS,
                value_serializer=lambda v: json.dumps(v).encode('utf-8'),
                key_serializer=lambda k: k.encode('utf-8') if k else None,
                compression_type='gzip',
                acks='all',  # Wait for all replicas to acknowledge
                request_timeout_ms=30000,  # 30 seconds
                # Note: aiokafka handles retries and in-flight requests automatically
            )
            
            await self._producer.start()
            self._started = True
            
            logger.info(
                "Kafka producer started",
                extra={"bootstrap_servers": settings.KAFKA_BOOTSTRAP_SERVERS}
            )
            
        except Exception as e:
            logger.error(f"Failed to start Kafka producer: {e}")
            raise
    
    async def stop(self):
        """
        Stop Kafka producer connection
        
        Should be called on application shutdown.
        """
        if self._producer and self._started:
            await self._producer.stop()
            self._started = False
            logger.info("Kafka producer stopped")
    
    async def publish_risk_analysis_request(
        self,
        commitment: str,
        wallet_address: str,
        force_refresh: bool = False
    ) -> str:
        """
        Publish privacy-preserving risk analysis request to Kafka
        
        Security:
        - Wallet ownership already verified via signature (backend)
        - Worker receives verified wallet for ephemeral analysis
        - Results stored on-chain with commitment (privacy-preserving)
        
        Args:
            commitment: Commitment hash for privacy-preserving storage
            wallet_address: VERIFIED Ethereum address (signature checked)
            force_refresh: Whether to bypass cache
            
        Returns:
            task_id: Unique task identifier for tracking
            
        Raises:
            KafkaError: If message publish fails
        """
        if not self._started:
            await self.start()
        
        task_id = str(uuid.uuid4())
        
        message = {
            "task_id": task_id,
            "commitment": commitment,
            "wallet_address": wallet_address.lower(),  # Verified wallet (ephemeral)
            "force_refresh": force_refresh,
            "timestamp": datetime.utcnow().isoformat(),
            "correlation_id": task_id
        }
        
        try:
            # Partition by commitment (not wallet) for privacy
            await self._producer.send_and_wait(
                settings.KAFKA_TOPIC_RISK_REQUESTS,
                value=message,
                key=commitment  # Privacy: partition by commitment hash
            )
            
            logger.info(
                f"Published risk analysis request",
                extra={
                    "task_id": task_id,
                    "commitment": commitment[:10] + "...",
                    "topic": settings.KAFKA_TOPIC_RISK_REQUESTS
                }
            )
            
            return task_id
            
        except KafkaError as e:
            logger.error(f"Failed to publish message to Kafka: {e}")
            raise
    
    async def publish_strategy_validation_request(
        self,
        commitment: str,
        wallet_address: str,
        parameters: Dict[str, Any],
        backtest_days: int = 30
    ) -> str:
        """
        Publish privacy-first strategy validation request to Kafka
        
        Args:
            commitment: Commitment hash (for privacy)
            wallet_address: VERIFIED wallet address (ephemeral processing)
            parameters: Strategy parameters to validate
            backtest_days: Days to backtest
            
        Returns:
            task_id: Unique task identifier
        """
        if not self._started:
            await self.start()
        
        task_id = str(uuid.uuid4())
        
        message = {
            "task_id": task_id,
            "commitment": commitment,
            "wallet_address": wallet_address.lower(),  # Ephemeral
            "parameters": parameters,
            "backtest_days": backtest_days,
            "timestamp": datetime.utcnow().isoformat(),
            "correlation_id": task_id
        }
        
        try:
            await self._producer.send_and_wait(
                settings.KAFKA_TOPIC_STRATEGY_REQUESTS,
                value=message,
                key=wallet_address.lower()
            )
            
            logger.info(
                f"Published strategy validation request",
                extra={
                    "task_id": task_id,
                    "wallet": wallet_address[:10] + "...",
                    "topic": settings.KAFKA_TOPIC_STRATEGY_REQUESTS
                }
            )
            
            return task_id
            
        except KafkaError as e:
            logger.error(f"Failed to publish strategy validation: {e}")
            raise


# Global producer instance
kafka_producer = KafkaProducerService()

