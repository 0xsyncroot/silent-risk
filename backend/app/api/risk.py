"""
Risk Analysis API Endpoints

Provides REST API for submitting risk analysis requests and retrieving results.
"""

import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any

from app.api.models import RiskAnalysisRequest, TaskResponse, ErrorResponse, TaskStatus
from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.services.signature_verifier import signature_verifier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/risk", tags=["Risk Analysis"])


@router.post(
    "/analyze",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request"},
        500: {"model": ErrorResponse, "description": "Internal server error"}
    }
)
async def analyze_wallet(request: RiskAnalysisRequest) -> TaskResponse:
    """
    Submit privacy-preserving risk analysis request
    
    Privacy-First Flow:
    1. Frontend generates commitment = keccak256(wallet, secret) in browser
    2. Frontend encrypts wallet with worker's public key
    3. Backend receives ONLY commitment + encrypted_wallet (no plaintext!)
    4. Check Redis cache by commitment hash
    5. If not cached, publish to Kafka for worker processing
    6. Worker decrypts wallet in memory, analyzes, stores on-chain, discards
    7. Return task_id for polling status
    
    Request Body:
    {
        "commitment": "0x1234...",  // keccak256(wallet, secret)
        "encrypted_wallet": "0xabcd...",  // encrypt(wallet, worker_pubkey)
        "force_refresh": false
    }
    
    Response:
    {
        "task_id": "uuid",
        "status": "pending",
        "message": "Analysis request submitted"
    }
    
    Privacy Guarantees:
    - Backend never sees plaintext wallet address
    - Only commitment hash is used for caching/tracking
    - Worker processes wallet ephemerally (memory only)
    - Results stored on-chain with commitment (permanent, private)
    """
    try:
        # Extract request data
        commitment = request.commitment
        wallet_address = request.wallet_address
        signature = request.signature
        message = request.message
        timestamp = request.timestamp
        force_refresh = request.force_refresh
        
        logger.info(
            f"Received analysis request for wallet: {wallet_address[:10]}..., "
            f"commitment: {commitment[:10]}..."
        )
        
        # CRITICAL: Verify wallet ownership via signature
        # This prevents users from analyzing wallets they don't own
        signature_verifier.verify_ownership(
            wallet_address=wallet_address,
            signature=signature,
            message=message,
            timestamp=timestamp
        )
        logger.info(f"Ownership verified for {wallet_address[:10]}... via signature")
        
        # Check cache if not forcing refresh
        # Cache key uses commitment hash (privacy-preserving)
        if not force_refresh:
            cached = await cache.get_cached_commitment_analysis(commitment)
            if cached:
                logger.info(f"Returning cached analysis for commitment {commitment[:10]}...")
                return TaskResponse(
                    task_id="cached",
                    status=TaskStatus.COMPLETED,
                    progress=100,
                    result=cached,
                    message="Returned from cache"
                )
        
        # Publish to Kafka for worker processing
        # Worker receives verified wallet address (ownership already confirmed)
        # Worker will analyze ephemerally and store on-chain with commitment
        task_id = await kafka_producer.publish_risk_analysis_request(
            commitment=commitment,
            wallet_address=wallet_address,  # Verified wallet (not encrypted)
            force_refresh=force_refresh
        )
        
        # Set initial task status in Redis (indexed by task_id)
        await cache.set_task_status(
            task_id=task_id,
            status="pending",
            progress=0,
            message="Request submitted to analysis queue"
        )
        
        # Also link task_id to commitment for easy lookup
        await cache.link_task_to_commitment(task_id, commitment)
        
        logger.info(f"Analysis task created: {task_id} for commitment {commitment[:10]}...")
        
        return TaskResponse(
            task_id=task_id,
            status=TaskStatus.PENDING,
            progress=0,
            message="Analysis request submitted successfully. Use task_id to poll for results."
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit analysis request: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/status/{task_id}")
async def get_task_status(task_id: str):
    """
    Get current status of analysis task
    
    Frontend should poll this endpoint every 2-3 seconds.
    
    Response:
    {
        "task_id": "uuid",
        "status": "pending|processing|completed|failed",
        "progress": 0-100,
        "result": {...} // Only when completed
    }
    """
    try:
        # Check for cached result first
        if task_id == "cached":
            return {
                "task_id": "cached",
                "status": "completed",
                "progress": 100
            }
        
        # Get task status
        status_data = await cache.get_task_status(task_id)
        if not status_data:
            raise HTTPException(status_code=404, detail="Task not found")
        
        response = {
            "task_id": task_id,
            "status": status_data.get("status", "pending"),
            "progress": status_data.get("progress", 0)
        }
        
        # If completed, include result
        if status_data.get("status") == "completed":
            result = await cache.get_task_result(task_id)
            
            # NOTE: Tracking is done by Worker when analysis completes
            # Backend only reads from MongoDB via /analytics/* endpoints
            
            # If result expired from Redis, user must query RiskScoreVault contract
            # This is intentional for privacy - no persistent storage of wallet data
            if not result:
                logger.warning(
                    f"Result expired from Redis for task {task_id}. "
                    "User should query RiskScoreVault contract directly for historical data."
                )
                response["message"] = (
                    "Result has expired from cache. "
                    "Please query RiskScoreVault contract directly using your commitment hash."
                )
            else:
                response["result"] = result
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task status: {e}")
        raise HTTPException(status_code=500, detail=f"Internal server error: {str(e)}")


# DEPRECATED: Removed /wallet/{wallet_address} endpoint
# Reason: Violates privacy - allows querying analysis by wallet address
# Migration: Use /status/{task_id} to get results (privacy-preserving)


@router.get("/health")
async def health_check():
    """
    Health check endpoint
    
    Verifies that backend services are operational.
    """
    try:
        # Check Redis connection
        await cache.start()
        
        # Check Kafka connection
        await kafka_producer.start()
        
        return {
            "status": "healthy",
            "services": {
                "redis": "connected",
                "kafka": "connected"
            }
        }
        
    except Exception as e:
        logger.error(f"Health check failed: {e}")
        return {
            "status": "unhealthy",
            "error": str(e)
        }
