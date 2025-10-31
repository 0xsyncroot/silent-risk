"""
Silent Risk Worker - Main Entry Point

Kafka consumer that processes risk analysis tasks.
Clean architecture with async message processing.
"""

import sys
import asyncio
import logging
import signal

from app.config.settings import settings
from app.services.kafka_consumer import kafka_consumer
from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.db.mongodb import mongodb
from app.handlers.risk_analysis import risk_analysis_handler
from app.handlers.strategy_validation import strategy_validation_handler

# Configure logging to console (stdout) for development
logging.basicConfig(
    level=getattr(logging, settings.LOG_LEVEL),
    format="%(asctime)s - %(name)s - %(levelname)s - %(message)s",
    handlers=[
        logging.StreamHandler(sys.stdout)  # Log to console
    ],
    force=True  # Override any existing config
)
logger = logging.getLogger(__name__)


class Worker:
    """
    Main worker application
    
    Responsibilities:
    - Initialize services (Kafka, Redis)
    - Register message handlers
    - Run consumer loop
    - Handle graceful shutdown
    """
    
    def __init__(self):
        self.running = False
    
    async def start(self):
        """
        Start worker services
        
        1. Connect to Redis
        2. Connect to Kafka (producer & consumer)
        3. Register message handlers
        4. Start consuming messages
        """
        logger.info("🚀 Starting Silent Risk Worker...")
        
        # Initialize services
        try:
            await cache.start()
            logger.info("✓ Redis connected")
        except Exception as e:
            logger.error(f"✗ Redis connection failed: {e}")
            raise
        
        try:
            await mongodb.start()
            logger.info("✓ MongoDB connected (ML performance tracking only)")
        except Exception as e:
            logger.warning(f"⚠ MongoDB connection failed (non-critical): {e}")
            # Continue without MongoDB - it's for analytics only
        
        try:
            await kafka_producer.start()
            logger.info("✓ Kafka producer connected")
        except Exception as e:
            logger.error(f"✗ Kafka producer connection failed: {e}")
            raise
        
        # Register message handlers
        kafka_consumer.register_handler(
            settings.KAFKA_TOPIC_RISK_REQUESTS,
            risk_analysis_handler.handle
        )
        
        kafka_consumer.register_handler(
            settings.KAFKA_TOPIC_STRATEGY_REQUESTS,
            strategy_validation_handler.handle
        )
        
        logger.info("✓ Message handlers registered (risk + strategy)")
        
        # Start consuming
        self.running = True
        logger.info("✅ Worker ready - listening for messages...")
        
        await kafka_consumer.start()
    
    async def stop(self):
        """
        Stop worker gracefully
        
        1. Stop consuming new messages
        2. Wait for in-flight messages
        3. Close connections
        """
        logger.info("🛑 Stopping worker...")
        
        self.running = False
        
        await kafka_consumer.stop()
        await kafka_producer.stop()
        await cache.stop()
        await mongodb.stop()
        
        logger.info("✅ Worker stopped")


async def main():
    """
    Main entry point
    
    Sets up signal handlers and starts worker.
    """
    worker = Worker()
    
    # Setup signal handlers for graceful shutdown
    loop = asyncio.get_event_loop()
    
    def signal_handler():
        logger.info("Received shutdown signal")
        asyncio.create_task(worker.stop())
    
    for sig in (signal.SIGTERM, signal.SIGINT):
        loop.add_signal_handler(sig, signal_handler)
    
    try:
        await worker.start()
    except KeyboardInterrupt:
        logger.info("Interrupted by user")
    except Exception as e:
        logger.error(f"Worker error: {e}", exc_info=True)
    finally:
        await worker.stop()


if __name__ == "__main__":
    asyncio.run(main())

