"""
Worker Configuration Settings

Centralized configuration for worker service.
All settings are loaded from environment variables.
"""

from typing import List, Optional
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Worker settings loaded from environment variables"""
    
    # ============ SERVICE ============
    
    APP_NAME: str = Field(default="Silent Risk Worker")
    APP_VERSION: str = Field(default="1.0.0")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    LOG_LEVEL: str = Field(default="INFO")
    
    # ============ KAFKA ============
    
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:9092",
        description="Kafka broker addresses"
    )
    
    KAFKA_CONSUMER_GROUP: str = Field(
        default="silent-risk-workers",
        description="Consumer group ID for horizontal scaling"
    )
    
    KAFKA_TOPIC_RISK_REQUESTS: str = Field(
        default="risk-analysis-requests"
    )
    
    KAFKA_TOPIC_RISK_RESULTS: str = Field(
        default="risk-analysis-results"
    )
    
    KAFKA_TOPIC_STRATEGY_REQUESTS: str = Field(
        default="strategy-validation-requests"
    )
    
    KAFKA_TOPIC_STRATEGY_RESULTS: str = Field(
        default="strategy-validation-results"
    )
    
    # ============ REDIS ============
    
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    
    REDIS_PUBSUB_CHANNEL: str = Field(
        default="task_status_updates",
        description="Redis Pub/Sub channel for task updates"
    )
    
    ANALYSIS_CACHE_TTL: int = Field(
        default=1800,
        description="Cache TTL in seconds"
    )
    
    # ============ MONGODB ============
    
    MONGODB_URL: str = Field(
        default="mongodb://localhost:27017",
        description="MongoDB connection URL"
    )
    
    MONGODB_DB_NAME: str = Field(
        default="silent_risk",
        description="MongoDB database name"
    )
    
    MONGODB_MAX_POOL_SIZE: int = Field(
        default=10,
        description="Maximum connection pool size"
    )
    
    MONGODB_MIN_POOL_SIZE: int = Field(
        default=1,
        description="Minimum connection pool size"
    )
    
    # ============ BLOCKCHAIN ============
    
    ETH_RPC_URL: str = Field(
        default="https://sepolia.infura.io/v3/YOUR_PROJECT_ID",
        description="Ethereum RPC URL"
    )
    
    ETH_CHAIN_ID: int = Field(default=11155111, description="Ethereum chain ID (Sepolia)")
    
    ETHERSCAN_API_KEY: Optional[str] = Field(
        default=None,
        description="Etherscan API key (optional, rarely used)"
    )
    
    # ============ SMART CONTRACTS ============
    
    VAULT_CONTRACT_ADDRESS: str = Field(
        default="",
        description="RiskScoreVault contract address"
    )
    
    WORKER_PRIVATE_KEY: str = Field(
        default="",
        description="Worker wallet private key (authorized updater)"
    )
    
    WAIT_FOR_CONFIRMATION: bool = Field(
        default=True,
        description="Wait for transaction confirmation"
    )
    
    # ============ ANALYSIS ============
    
    FEATURE_WINDOW_DAYS: int = Field(
        default=90,
        description="Days of history to analyze"
    )
    
    MIN_TRANSACTIONS_REQUIRED: int = Field(
        default=5,
        description="Minimum transactions for analysis"
    )
    
    VOLATILITY_WINDOW: int = Field(
        default=30,
        description="Days for volatility calculation"
    )
    
    class Config:
        """Pydantic configuration"""
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


@lru_cache()
def get_settings() -> Settings:
    """Get cached settings instance"""
    return Settings()


settings = get_settings()
