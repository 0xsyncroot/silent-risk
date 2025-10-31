"""
Statistics Tracker Service

Tracks analysis results and ML performance metrics to MongoDB.
Runs asynchronously to avoid blocking the main API flow.
"""

import structlog
from datetime import datetime
from typing import Dict, Any, Optional
from app.db.mongodb import mongodb
from app.db.models import AnalysisRecord, MLStatsRecord, AttestationRecord
from app.db.repositories import AnalyticsRepository, MLStatsRepository, AttestationRepository

logger = structlog.get_logger(__name__)


class StatsTracker:
    """
    Tracks statistics and analytics to MongoDB
    
    Methods are async and non-blocking to prevent API slowdowns.
    Errors are logged but don't affect main flow.
    """
    
    @staticmethod
    async def track_analysis(
        wallet_address: str,
        risk_score: float,
        risk_band: str,
        confidence: float,
        risk_factors: Dict[str, Any],
        commitment: str,
        total_transactions: int = 0,
        total_volume_usd: float = 0.0
    ) -> Optional[str]:
        """
        Track a completed risk analysis
        
        Args:
            wallet_address: Ethereum wallet address
            risk_score: Overall risk score (0-100)
            risk_band: Risk category (LOW, MEDIUM, HIGH, CRITICAL)
            confidence: Model confidence (0-100)
            risk_factors: Detailed risk factor breakdown
            commitment: Privacy commitment hash
            total_transactions: Total transactions analyzed
            total_volume_usd: Total volume in USD
            
        Returns:
            Document ID if successful, None on error
        """
        try:
            if not mongodb.is_connected:
                logger.warning("MongoDB not connected, skipping stats tracking")
                return None
            
            analysis = AnalysisRecord(
                wallet_address=wallet_address,
                risk_score=risk_score,
                risk_band=risk_band,
                confidence=confidence,
                risk_factors=risk_factors,
                commitment=commitment,
                total_transactions=total_transactions,
                total_volume_usd=total_volume_usd,
                timestamp=datetime.utcnow(),
                passport_generated=False
            )
            
            repo = AnalyticsRepository(mongodb.db)
            doc_id = await repo.create_analysis(analysis)
            
            logger.info(
                "Analysis tracked to MongoDB",
                wallet=wallet_address[:10] + "...",
                risk_band=risk_band,
                doc_id=doc_id
            )
            
            # Update daily statistics (non-blocking)
            try:
                await repo.update_daily_statistics(datetime.utcnow())
            except Exception as e:
                logger.warning("Failed to update daily stats", error=str(e))
            
            return doc_id
            
        except Exception as e:
            logger.error("Failed to track analysis", error=str(e))
            return None
    
    @staticmethod
    async def track_ml_inference(
        model_version: str,
        latency_ms: float,
        success: bool = True
    ):
        """
        Track an ML model inference for performance monitoring
        
        Args:
            model_version: Version of the model used
            latency_ms: Processing time in milliseconds
            success: Whether inference was successful
        """
        try:
            if not mongodb.is_connected:
                return
            
            repo = MLStatsRepository(mongodb.db)
            await repo.record_inference(model_version, latency_ms, success)
            
            logger.debug(
                "ML inference tracked",
                model=model_version,
                latency=latency_ms,
                success=success
            )
            
        except Exception as e:
            logger.error("Failed to track ML inference", error=str(e))
    
    @staticmethod
    async def track_attestation(
        attestation_id: str,
        wallet_address: str,
        risk_band: str,
        commitment: str,
        tx_hash: Optional[str] = None,
        block_number: Optional[int] = None
    ) -> Optional[str]:
        """
        Track an issued NFT attestation/passport
        
        Args:
            attestation_id: Unique attestation ID
            wallet_address: Wallet that received attestation
            risk_band: Attested risk level
            commitment: ZK commitment
            tx_hash: On-chain transaction hash
            block_number: Block number
            
        Returns:
            Document ID if successful, None on error
        """
        try:
            if not mongodb.is_connected:
                logger.warning("MongoDB not connected, skipping attestation tracking")
                return None
            
            attestation = AttestationRecord(
                attestation_id=attestation_id,
                wallet_address=wallet_address,
                risk_band=risk_band,
                commitment=commitment,
                tx_hash=tx_hash,
                block_number=block_number,
                attested_at=datetime.utcnow(),
                verified=True
            )
            
            repo = AttestationRepository(mongodb.db)
            doc_id = await repo.create_attestation(attestation)
            
            logger.info(
                "Attestation tracked to MongoDB",
                attestation_id=attestation_id,
                wallet=wallet_address[:10] + "...",
                doc_id=doc_id
            )
            
            return doc_id
            
        except Exception as e:
            logger.error("Failed to track attestation", error=str(e))
            return None


# Global instance
stats_tracker = StatsTracker()

