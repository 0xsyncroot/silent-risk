"""
Configuration for WebSocket Service

Loads settings from environment variables.
"""

from typing import List
from pydantic_settings import BaseSettings
from pydantic import Field


class Settings(BaseSettings):
    """WebSocket Service Settings"""
    
    # Service Configuration
    APP_NAME: str = "Silent Risk WebSocket Service"
    HOST: str = Field(default="0.0.0.0", description="Host to bind to")
    PORT: int = Field(default=8001, description="Port to bind to")
    DEBUG: bool = Field(default=True, description="Debug mode")
    LOG_LEVEL: str = Field(default="INFO", description="Logging level")
    
    # Redis Configuration
    REDIS_URL: str = Field(
        default="redis://localhost:6379/0",
        description="Redis connection URL"
    )
    REDIS_PUBSUB_CHANNEL: str = Field(
        default="task_status_updates",
        description="Redis pub/sub channel for task updates"
    )
    
    # CORS Configuration
    CORS_ORIGINS: List[str] = Field(
        default=["http://localhost:3000", "http://localhost:3001"],
        description="Allowed CORS origins"
    )
    
    # WebSocket Configuration
    WS_MAX_CONNECTIONS: int = Field(
        default=1000,
        description="Maximum concurrent WebSocket connections"
    )
    WS_HEARTBEAT_INTERVAL: int = Field(
        default=30,
        description="WebSocket heartbeat interval in seconds"
    )
    
    class Config:
        env_file = ".env"
        case_sensitive = True


# Global settings instance
settings = Settings()

