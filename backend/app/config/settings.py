"""
Backend Configuration Settings

Centralized configuration for FastAPI backend service.
All settings are loaded from environment variables.
"""

from typing import List
from functools import lru_cache
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """Application settings loaded from environment variables"""
    
    # ============ SERVICE ============
    
    APP_NAME: str = Field(default="Silent Risk Backend")
    APP_VERSION: str = Field(default="1.0.0")
    ENVIRONMENT: str = Field(default="development")
    DEBUG: bool = Field(default=True)
    
    HOST: str = Field(default="0.0.0.0")
    PORT: int = Field(default=8000)
    LOG_LEVEL: str = Field(default="INFO")
    
    # ============ KAFKA ============
    
    KAFKA_BOOTSTRAP_SERVERS: str = Field(
        default="localhost:9092",
        description="Kafka broker addresses (comma-separated)"
    )
    
    KAFKA_TOPIC_RISK_REQUESTS: str = Field(
        default="risk-analysis-requests",
        description="Topic for risk analysis requests"
    )
    
    KAFKA_TOPIC_RISK_RESULTS: str = Field(
        default="risk-analysis-results",
        description="Topic for risk analysis results"
    )
    
    KAFKA_TOPIC_STRATEGY_REQUESTS: str = Field(
        default="strategy-validation-requests",
        description="Topic for strategy validation requests"
    )
    
    KAFKA_TOPIC_STRATEGY_RESULTS: str = Field(
        default="strategy-validation-results",
        description="Topic for strategy validation results"
    )
    
    # ============ REDIS CACHE ============
    
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    
    ANALYSIS_CACHE_TTL: int = Field(
        default=3600,
        description="Cache TTL in seconds (1 hour) - intentionally short for privacy"
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
        description="Max connection pool size"
    )
    
    MONGODB_MIN_POOL_SIZE: int = Field(
        default=1,
        description="Min connection pool size"
    )
    
    # ============ API ============
    
    API_V1_PREFIX: str = Field(default="/api/v1")
    
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    
    RATE_LIMIT_PER_MINUTE: int = Field(default=60)
    
    # ============ SECURITY ============
    
    SECRET_KEY: str = Field(
        default="dev-secret-key-change-in-production"
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
