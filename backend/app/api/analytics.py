"""
Analytics API endpoints for dashboard overview

PRIVACY-FIRST DESIGN:
- NO wallet analysis data stored in database
- Only aggregated, anonymous ML performance metrics
- All wallet data stays client-side (localStorage/IndexedDB)
"""

from fastapi import APIRouter, Depends
from motor.motor_asyncio import AsyncIOMotorDatabase
from datetime import datetime
from typing import Dict, Any
from app.db.mongodb import get_database
from app.db.repositories import MLStatsRepository
import structlog

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/analytics", tags=["analytics"])


@router.get("/overview")
async def get_analytics_overview(
    db: AsyncIOMotorDatabase = Depends(get_database)
) -> Dict[str, Any]:
    """
    Get analytics overview statistics (Privacy-Preserving)
    
    PRIVACY DESIGN:
    - NO wallet-level data stored in database
    - Only aggregated, anonymous ML performance metrics
    - All wallet analysis results stored client-side only
    
    Returns:
    - ML inference count (anonymous, no wallet data)
    - Empty stats for privacy compliance
    - Real ML performance metrics only
    
    Data Source: ML stats only (no wallet data)
    """
    try:
        ml_repo = MLStatsRepository(db)
        
        # Get only ML performance metrics (no wallet data)
        ml_stats = await ml_repo.get_aggregated_stats()
        total_inferences = ml_stats.get("total_inferences", 0)
        
        # PRIVACY: Return zero for wallet-related metrics
        return {
            "totalAnalyses": total_inferences,  # ML inferences, not wallet analyses
            "attestationsIssued": 0,  # Not tracked for privacy
            "strategiesValidated": 0,  # Not tracked for privacy
            "privacyScore": 100,  # Always 100 - zero wallet data storage
            "recentAttestations": [],  # Not tracked for privacy
            "risk_band_distribution": [
                {"band": "LOW", "count": 0, "percentage": 0},
                {"band": "MEDIUM", "count": 0, "percentage": 0},
                {"band": "HIGH", "count": 0, "percentage": 0},
                {"band": "CRITICAL", "count": 0, "percentage": 0}
            ],
            "change": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "privacy_mode": True,
            "note": "Wallet analytics disabled for privacy - data stored client-side only"
        }
        
    except Exception as e:
        logger.error("Failed to fetch analytics overview", error=str(e))
        return {
            "totalAnalyses": 0,
            "attestationsIssued": 0,
            "strategiesValidated": 0,
            "privacyScore": 100,
            "recentAttestations": [],
            "risk_band_distribution": [
                {"band": "LOW", "count": 0, "percentage": 0},
                {"band": "MEDIUM", "count": 0, "percentage": 0},
                {"band": "HIGH", "count": 0, "percentage": 0},
                {"band": "CRITICAL", "count": 0, "percentage": 0}
            ],
            "change": 0,
            "timestamp": datetime.utcnow().isoformat(),
            "privacy_mode": True
        }
