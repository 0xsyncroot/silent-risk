"""
MongoDB Data Models (Privacy-First)

PRIVACY DESIGN:
- NO wallet analysis data stored
- Only ML performance metrics (anonymous)
- All wallet data: Redis cache (ephemeral) + Client-side (user control)
"""

from datetime import datetime
from typing import Optional, List
from pydantic import BaseModel, Field


class MLStatsRecord(BaseModel):
    """
    ML model performance statistics (ANONYMOUS ONLY)
    
    Tracks model accuracy, latency, and inference counts over time.
    NO wallet addresses, NO analysis results, NO user data.
    """
    model_version: str = Field(..., description="ML model version")
    accuracy: float = Field(..., ge=0, le=100, description="Model accuracy (%)")
    total_inferences: int = Field(default=0, description="Total inferences performed")
    encrypted_computations: int = Field(default=0, description="FHE computations")
    
    # Performance metrics
    avg_latency_ms: float = Field(default=0.0, description="Average latency (ms)")
    min_latency_ms: float = Field(default=0.0)
    max_latency_ms: float = Field(default=0.0)
    
    # Timestamps
    timestamp: datetime = Field(default_factory=datetime.utcnow)
    last_trained: datetime = Field(default_factory=datetime.utcnow, description="Last training date")
    
    # Model metadata
    model_type: str = Field(default="concrete_ml", description="Model framework")
    fhe_enabled: bool = Field(default=True, description="FHE encryption enabled")
    
    # Array to store individual inference accuracies for calculating average
    accuracies: List[float] = Field(default_factory=list, description="Individual inference accuracies")
    
    class Config:
        protected_namespaces = ()  # Allow model_* field names
        json_schema_extra = {
            "example": {
                "model_version": "ensemble-v1.0",
                "accuracy": 89.5,
                "total_inferences": 10000,
                "encrypted_computations": 5000,
                "avg_latency_ms": 1.74,
                "min_latency_ms": 0.5,
                "max_latency_ms": 5.2,
                "timestamp": "2025-10-03T08:00:00Z",
                "last_trained": "2025-10-01T00:00:00Z",
                "model_type": "ensemble",
                "fhe_enabled": False,
                "accuracies": [85.0, 90.0, 88.5]
            }
        }


class DailyStatistics(BaseModel):
    """
    Daily aggregated statistics (ANONYMOUS ONLY)
    
    Tracks daily metrics for trend analysis.
    NO wallet addresses, only aggregate counts.
    """
    date: datetime = Field(..., description="Date for these statistics")
    
    # Anonymous aggregate metrics only
    total_ml_inferences: int = Field(default=0, description="ML inferences this day")
    avg_latency_ms: float = Field(default=0.0, description="Average latency")
    
    # Timestamps
    created_at: datetime = Field(default_factory=datetime.utcnow)
    updated_at: datetime = Field(default_factory=datetime.utcnow)
    
    class Config:
        json_schema_extra = {
            "example": {
                "date": "2025-10-03T00:00:00Z",
                "total_ml_inferences": 150,
                "avg_latency_ms": 1.85,
                "created_at": "2025-10-03T00:00:00Z",
                "updated_at": "2025-10-03T23:59:59Z"
            }
        }
