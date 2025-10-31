"""
Attestations API endpoints

PRIVACY-FIRST DESIGN:
- NO attestation data stored in database
- All attestations are client-side only
- This API returns empty for maximum privacy
"""

from fastapi import APIRouter
from typing import Dict, List, Any
import structlog

logger = structlog.get_logger(__name__)
router = APIRouter(prefix="/attestations", tags=["attestations"])


@router.get("/recent")
async def get_recent_attestations(
    limit: int = 10
) -> Dict[str, Any]:
    """
    Get recent attestations (Privacy-Preserving)
    
    PRIVACY DESIGN:
    - NO attestation data stored in database
    - All attestations are client-side only (localStorage/IndexedDB)
    - This endpoint returns empty for maximum privacy
    
    Args:
        limit: Maximum number of attestations to return (default: 10)
        
    Returns:
        Empty list - attestations not tracked for privacy
    """
    try:
        # PRIVACY: Attestations not stored server-side
        return {
            "attestations": [],
            "count": 0,
            "privacy_mode": True,
            "note": "Attestations not tracked for privacy - stored client-side only"
        }
        
    except Exception as e:
        logger.error("Failed to fetch recent attestations", error=str(e))
        return {
            "attestations": [],
            "count": 0,
            "privacy_mode": True
        }
