"""
Statistics Tracker Service (Privacy-First)

PRIVACY DESIGN:
- Only tracks anonymous ML performance metrics
- NO wallet analysis tracking
- NO attestation tracking
- NO user behavior tracking

Purpose: Monitor ML model performance for improvement, not user surveillance.
"""

import structlog
from datetime import datetime
from typing import Optional

from app.db.mongodb import mongodb
from app.db.repositories import MLStatsRepository, DailyStatisticsRepository

logger = structlog.get_logger(__name__)


class StatsTracker:
    """
    Privacy-First Statistics Tracker
    
    Only tracks:
    - ML model performance (latency, confidence)
    - Aggregated daily counts
    
    Does NOT track:
    - Wallet addresses
    - Risk analysis results
    - User attestations
    - Any personally identifiable information
    """
    
    async def track_ml_inference(
        self,
        model_version: str,
        latency_ms: float,
        success: bool = True,
        accuracy: Optional[float] = None
    ):
        """
        Track ML model inference performance (ANONYMOUS)
        
        Records:
        - Model version used
        - Inference latency
        - Model confidence/accuracy
        
        Does NOT record:
        - Wallet address
        - Risk score
        - Any user data
        
        Args:
            model_version: ML model version (e.g., "ensemble-v1.0")
            latency_ms: Inference latency in milliseconds
            success: Whether inference succeeded
            accuracy: Model confidence/accuracy percentage
        """
        try:
            db = mongodb.db
            if db is None:
                logger.warning("MongoDB not connected - skipping ML tracking")
                return
            
            ml_repo = MLStatsRepository(db)
            
            # Record inference (anonymous)
            await ml_repo.record_inference(
                model_version=model_version,
                latency_ms=latency_ms,
                success=success,
                accuracy=accuracy
            )
            
            # Update daily stats
            daily_repo = DailyStatisticsRepository(db)
            await daily_repo.update_daily_stats(ml_inferences=1)
            
            logger.debug(
                "ML inference tracked",
                model=model_version,
                latency_ms=latency_ms,
                accuracy=accuracy,
                success=success
            )
            
        except Exception as e:
            # Non-critical - don't fail analysis if tracking fails
            logger.debug("Failed to track ML inference", error=str(e))
    
    # REMOVED: track_analysis() - violates privacy
    # REMOVED: track_attestation() - violates privacy
    # REMOVED: update_daily_statistics() - replaced with ML-only version


# Global instance
stats_tracker = StatsTracker()
