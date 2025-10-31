"""
Risk Analysis Handler - Privacy-Preserving Wallet Analysis

Orchestrates: Blockchain data fetch → ML risk scoring → FHE passport generation
Privacy: Wallet addresses processed ephemerally (memory only, never persisted)
Real-time: Progress updates via Redis Pub/Sub → WebSocket (10%, 40%, 60%, 80%, 100%)
"""

import logging
from typing import Dict, Any

from app.blockchain.indexer import BlockchainIndexer
from app.analysis.risk_calculator import RiskCalculator
from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.services.passport_service import passport_service
from app.services.stats_tracker import stats_tracker

logger = logging.getLogger(__name__)


class RiskAnalysisHandler:
    """
    Processes Kafka messages for privacy-preserving risk analysis.
    
    Pipeline: RPC data fetch → Ensemble ML (60% rules + 40% ML) → FHE passport → Cache
    Privacy: Wallet addresses ephemeral (memory only), results cached by commitment hash
    Performance: 5-15s typical (blockchain 2-5s, ML 100-500ms, FHE 2-8s)
    """
    
    def __init__(self):
        self.indexer = BlockchainIndexer()
        self.calculator = RiskCalculator()
    
    async def handle(self, message: Dict[str, Any]):
        """
        Process risk analysis request from Kafka.
        
        Args:
            message: {task_id, commitment, wallet_address, force_refresh}
                     wallet_address is pre-verified (EIP-191) and processed ephemerally
        
        Flow: Fetch blockchain data → ML scoring → FHE passport → Publish & cache
        Privacy: Wallet address never persisted, results cached by commitment hash
        Progress: Real-time updates via Redis Pub/Sub (10%, 40%, 60%, 80%, 100%)
        """
        task_id = message.get("task_id")
        commitment = message.get("commitment")
        wallet_address = message.get("wallet_address")
        force_refresh = message.get("force_refresh", False)
        
        logger.info(
            f"Processing risk analysis",
            extra={
                "task_id": task_id,
                "commitment": commitment[:10] + "..." if commitment else "N/A",
                "force_refresh": force_refresh
            }
        )
        
        try:
            # Step 1: Request submitted (10%)
            await cache.update_task_status(
                task_id, 
                "processing", 
                progress=10, 
                message="Request submitted"
            )
            logger.info(f"[{task_id}] Step 1/5: Request submitted")
            
            # Step 2: Fetch blockchain data (40%)
            logger.info(f"[{task_id}] Step 2/5: Fetching blockchain data...")
            activity_summary = await self.indexer.get_wallet_activity_summary(
                wallet_address=wallet_address,
                network="ethereum"
            )
            
            await cache.update_task_status(
                task_id, 
                "processing", 
                progress=40, 
                message="Fetching blockchain data"
            )
            logger.info(
                f"[{task_id}] Blockchain data fetched",
                extra={
                    "tx_count": activity_summary.get("total_transactions", 0),
                    "wallet_age_days": activity_summary.get("wallet_age_days", 0)
                }
            )
            
            # Step 3: Calculate risk score (60%)
            logger.info(f"[{task_id}] Step 3/5: Calculating risk score...")
            risk_analysis = self.calculator.calculate_comprehensive_risk(
                wallet_address=wallet_address,
                activity_summary=activity_summary
            )
            
            # Extract risk score for passport generation
            risk_score = risk_analysis.get("risk_score", 0)
            risk_band = risk_analysis.get("risk_band", "unknown")
            
            await cache.update_task_status(
                task_id, 
                "processing", 
                progress=60, 
                message="Calculating risk score"
            )
            logger.info(
                f"[{task_id}] Risk score calculated",
                extra={
                    "score": risk_score,
                    "band": risk_band
                }
            )
            
            # Step 4: Generate FHE passport metadata (80%)
            logger.info(f"[{task_id}] Step 4/5: Generating passport metadata...")
            try:
                passport_data = await passport_service.create_passport(
                    commitment=commitment,
                    wallet_address=wallet_address,
                    risk_score=risk_score
                )
                
                # Add passport info to risk analysis result
                # NOTE: Frontend already has commitment + secret in localStorage
                # Frontend will encrypt risk_score using Zama FHEVM SDK
                risk_analysis["passport"] = {
                    "commitment": passport_data.commitment,
                    "nullifier_hash": passport_data.nullifier,
                    "vault_address": passport_data.vault_address,
                    "block_height": passport_data.block_height,
                    "risk_score": risk_score,  # Plaintext for frontend to encrypt with FHEVM
                    "tx_hash": passport_data.tx_hash,
                    "status": "ready_to_claim"
                }
                
                logger.info(
                    f"[{task_id}] Passport generated successfully",
                    extra={
                        "commitment": passport_data.commitment[:16] + "...",
                        "tx_hash": passport_data.tx_hash
                    }
                )
            except Exception as passport_error:
                # Passport generation failed, but analysis succeeded
                # Continue with analysis result (non-blocking)
                logger.error(
                    f"[{task_id}] Passport generation failed (non-critical)",
                    extra={"error": str(passport_error)},
                    exc_info=True
                )
                risk_analysis["passport"] = {
                    "status": "generation_failed",
                    "error": str(passport_error)
                }
            
            await cache.update_task_status(
                task_id, 
                "processing", 
                progress=80, 
                message="Generating passport"
            )
            
            # Step 5: Publish & cache results (100%)
            logger.info(f"[{task_id}] Step 5/5: Finalizing results...")
            
            # Publish result to Kafka for backend consumption
            await kafka_producer.publish_risk_analysis_result(
                task_id=task_id,
                status="completed",
                result=risk_analysis
            )
            
            # Cache by commitment hash (NOT wallet address) for privacy
            await cache.store_task_result(task_id, risk_analysis)
            await cache.cache_commitment_analysis(commitment, risk_analysis)
            
            # Mark completed
            await cache.update_task_status(
                task_id, 
                "completed", 
                progress=100, 
                message="Analysis complete!"
            )
            logger.info(f"[{task_id}] Analysis completed successfully")
            
            # Track ML performance metrics only (no wallet/score data)
            ml_metrics = getattr(self.calculator, '_ml_metrics', None)
            if ml_metrics:
                import asyncio
                asyncio.create_task(
                    self._track_ml_performance_only(
                        model_version=ml_metrics.get("model_version", "ensemble-v1.0"),
                        latency_ms=ml_metrics.get("latency_ms", 0),
                        confidence=ml_metrics.get("confidence", 0)
                    )
                )
            
            logger.info(
                f"Risk analysis completed",
                extra={
                    "task_id": task_id,
                    "commitment": commitment[:10] + "...",
                    "risk_score": risk_score,
                    "passport_status": risk_analysis["passport"]["status"]
                }
            )
            
            # wallet_address goes out of scope here (ephemeral processing complete)
            
        except Exception as e:
            logger.error(
                f"Risk analysis failed",
                extra={
                    "task_id": task_id,
                    "commitment": commitment[:10] + "..." if commitment else "N/A",
                    "error": str(e)
                },
                exc_info=True
            )
            
            # Publish failure
            await kafka_producer.publish_risk_analysis_result(
                task_id=task_id,
                status="failed",
                error=str(e)
            )
            
            # Update status
            await cache.update_task_status(task_id, "failed", progress=0, message=f"Analysis failed: {str(e)}")
    
    async def _track_ml_performance_only(
        self,
        model_version: str,
        latency_ms: float,
        confidence: float
    ):
        """
        Track ML performance metrics (latency, confidence) without user data.
        
        Privacy: NO wallet addresses, risk scores, or user-identifiable info tracked.
        Storage: Aggregated stats only in MongoDB for ML dashboard.
        """
        try:
            await stats_tracker.track_ml_inference(
                model_version=model_version,
                latency_ms=latency_ms,
                success=True,
                accuracy=confidence  # Use confidence as accuracy metric
            )
            
            logger.debug(
                "ML performance tracked",
                extra={
                    "model": model_version,
                    "latency_ms": latency_ms,
                    "confidence": confidence
                }
            )
        except Exception as e:
            logger.debug(f"Failed to track ML performance: {e}")


# Global handler instance
risk_analysis_handler = RiskAnalysisHandler()

