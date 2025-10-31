"""
Strategy Validation API Endpoints (Privacy-First)

Provides REST API for validating trading strategies with backtesting and recommendations.
Submits async tasks to Kafka for worker processing.

Privacy Architecture:
- Signature verification for ownership proof
- Commitment-based caching
- Worker ephemeral processing
- No wallet persistence
"""

import logging
from fastapi import APIRouter, HTTPException, status
from typing import Dict, Any, List, Optional
from pydantic import BaseModel, Field, validator
from enum import Enum

from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.services.signature_verifier import signature_verifier

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/strategy", tags=["Strategy Validation"])


# ============ MODELS ============

class StrategyType(str, Enum):
    SCALPING = "scalping"
    SWING = "swing"
    POSITION = "position"


class StrategyParameters(BaseModel):
    strategy_type: StrategyType
    take_profit: float = Field(gt=0, le=100, description="Take profit percentage")
    stop_loss: float = Field(gt=0, le=100, description="Stop loss percentage")
    position_size: float = Field(gt=0, le=100, description="Position size as % of portfolio")
    cooldown: Optional[float] = Field(None, ge=0, description="Cooldown period in hours")
    max_drawdown: Optional[float] = Field(None, gt=0, le=100, description="Maximum acceptable drawdown %")
    target_protocols: Optional[List[str]] = Field(None, description="Target protocols for trading")
    timeframe: Optional[str] = Field("4h", description="Trading timeframe")


class ValidationRequest(BaseModel):
    """
    Privacy-first strategy validation request
    
    Security: Same as RiskAnalysisRequest
    - Signature proves wallet ownership
    - Commitment hides wallet on-chain
    - Worker processes ephemerally
    """
    # Commitment for privacy
    commitment: str = Field(
        ...,
        description="Commitment hash: keccak256(abi.encodePacked(wallet, secret))",
        pattern="^0x[a-fA-F0-9]{64}$"
    )
    
    # Wallet for verification
    wallet_address: str = Field(
        ...,
        description="Ethereum address (must match signature)",
        pattern="^0x[a-fA-F0-9]{40}$"
    )
    
    # Signature for ownership proof
    signature: str = Field(
        ...,
        description="EIP-191 signature",
        pattern="^0x[a-fA-F0-9]{130}$"
    )
    
    # Message signed
    message: str = Field(
        ...,
        description="Signed message with timestamp"
    )
    
    # Timestamp for replay protection
    timestamp: int = Field(
        ...,
        description="Unix timestamp",
        gt=1704067200
    )
    
    # Strategy parameters
    parameters: StrategyParameters
    backtest_days: Optional[int] = Field(30, ge=7, le=365, description="Days to backtest")
    
    @validator('commitment')
    def validate_commitment(cls, v):
        if not v.startswith('0x') or len(v) != 66:
            raise ValueError('Invalid commitment format')
        return v.lower()
    
    @validator('wallet_address')
    def validate_wallet(cls, v):
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('Invalid wallet format')
        return v.lower()


class ValidationCheck(BaseModel):
    name: str
    status: str  # passed, warning, failed
    score: float
    message: str
    details: Optional[Dict[str, Any]] = None


class Recommendation(BaseModel):
    priority: str  # CRITICAL, HIGH, MEDIUM, LOW
    title: str
    description: str
    impact: str
    effort: str
    action: Optional[Dict[str, Any]] = None


class ValidationResult(BaseModel):
    wallet_address: str
    result: str  # passed, warning, failed
    overall_score: float
    checks: List[ValidationCheck]
    recommendations: List[Recommendation]
    parameters: StrategyParameters
    validated_at: str
    backtest_summary: Optional[Dict[str, Any]] = None


# ============ VALIDATION LOGIC ============

def validate_risk_reward_ratio(
    take_profit: float,
    stop_loss: float
) -> ValidationCheck:
    """Validate risk/reward ratio"""
    ratio = take_profit / stop_loss
    
    if ratio >= 2.0:
        return ValidationCheck(
            name="Risk/Reward Ratio",
            status="passed",
            score=100.0,
            message=f"Excellent R:R ratio of {ratio:.2f}:1. High profit potential with acceptable risk.",
            details={"ratio": ratio, "rating": "excellent"}
        )
    elif ratio >= 1.5:
        return ValidationCheck(
            name="Risk/Reward Ratio",
            status="passed",
            score=75.0,
            message=f"Good R:R ratio of {ratio:.2f}:1. Acceptable risk-reward balance.",
            details={"ratio": ratio, "rating": "good"}
        )
    elif ratio >= 1.0:
        return ValidationCheck(
            name="Risk/Reward Ratio",
            status="warning",
            score=50.0,
            message=f"Low R:R ratio of {ratio:.2f}:1. Consider increasing take profit or reducing stop loss.",
            details={"ratio": ratio, "rating": "low"}
        )
    else:
        return ValidationCheck(
            name="Risk/Reward Ratio",
            status="failed",
            score=20.0,
            message=f"Very poor R:R ratio of {ratio:.2f}:1. Strategy will likely lose money over time!",
            details={"ratio": ratio, "rating": "very_poor"}
        )


def validate_position_size(
    position_size: float,
    risk_band: str = "medium"
) -> ValidationCheck:
    """Validate position size based on risk profile"""
    max_size = {
        'low': 20,
        'medium': 10,
        'high': 5,
        'critical': 2
    }
    
    recommended_max = max_size.get(risk_band, 10)
    
    if position_size > recommended_max:
        return ValidationCheck(
            name="Position Size",
            status="failed",
            score=30.0,
            message=f"Position size {position_size}% is too large for {risk_band.upper()} risk profile. "
                   f"Maximum recommended: {recommended_max}%. Risk of large losses!",
            details={"position_size": position_size, "recommended_max": recommended_max}
        )
    elif position_size > recommended_max * 0.8:
        return ValidationCheck(
            name="Position Size",
            status="warning",
            score=60.0,
            message=f"Position size {position_size}% is high for {risk_band.upper()} risk profile. "
                   f"Consider reducing to {recommended_max}% or below.",
            details={"position_size": position_size, "recommended_max": recommended_max}
        )
    else:
        return ValidationCheck(
            name="Position Size",
            status="passed",
            score=100.0,
            message=f"Position size {position_size}% is appropriate for {risk_band.upper()} risk profile. "
                   f"Well-managed risk exposure.",
            details={"position_size": position_size, "recommended_max": recommended_max}
        )


def validate_strategy_type_compatibility(
    strategy_type: str,
    risk_band: str = "medium",
    tx_count: int = 0
) -> ValidationCheck:
    """Validate if strategy type matches risk profile"""
    
    if strategy_type == "scalping":
        if risk_band in ['high', 'critical']:
            return ValidationCheck(
                name="Strategy Type Compatibility",
                status="failed",
                score=20.0,
                message=f"Scalping requires LOW risk profile. Your wallet is {risk_band.upper()} risk. "
                       f"High-frequency trading with high risk = recipe for disaster!",
                details={"strategy_type": strategy_type, "risk_band": risk_band}
            )
        elif tx_count < 50:
            return ValidationCheck(
                name="Strategy Type Compatibility",
                status="warning",
                score=50.0,
                message=f"Scalping requires experience. You have only {tx_count} transactions. "
                       f"Consider starting with swing trading.",
                details={"strategy_type": strategy_type, "tx_count": tx_count}
            )
        else:
            return ValidationCheck(
                name="Strategy Type Compatibility",
                status="passed",
                score=85.0,
                message=f"Scalping compatible with your profile. {tx_count} transactions show experience.",
                details={"strategy_type": strategy_type, "risk_band": risk_band}
            )
    
    elif strategy_type == "swing":
        return ValidationCheck(
            name="Strategy Type Compatibility",
            status="passed",
            score=90.0,
            message=f"Swing trading is well-suited for {risk_band.upper()} risk profiles. Good balance of risk and reward.",
            details={"strategy_type": strategy_type, "risk_band": risk_band}
        )
    
    else:  # position
        if risk_band == 'critical':
            return ValidationCheck(
                name="Strategy Type Compatibility",
                status="warning",
                score=60.0,
                message=f"Position trading recommended for CRITICAL risk, but requires patience and time. "
                       f"Good long-term strategy if you can hold through volatility.",
                details={"strategy_type": strategy_type, "risk_band": risk_band}
            )
        else:
            return ValidationCheck(
                name="Strategy Type Compatibility",
                status="passed",
                score=95.0,
                message=f"Position trading is excellent for {risk_band.upper()} risk. Low stress, stable returns over time.",
                details={"strategy_type": strategy_type, "risk_band": risk_band}
            )


def validate_stop_loss_sanity(
    stop_loss: float,
    strategy_type: str
) -> ValidationCheck:
    """Validate stop loss is not too tight or too loose"""
    
    min_stop_loss = {
        'scalping': 1.0,
        'swing': 3.0,
        'position': 5.0
    }
    
    max_stop_loss = {
        'scalping': 5.0,
        'swing': 15.0,
        'position': 30.0
    }
    
    min_sl = min_stop_loss.get(strategy_type, 3.0)
    max_sl = max_stop_loss.get(strategy_type, 15.0)
    
    if stop_loss < min_sl:
        return ValidationCheck(
            name="Stop Loss Sanity",
            status="warning",
            score=50.0,
            message=f"Stop loss {stop_loss}% is too tight for {strategy_type} trading. "
                   f"Recommended minimum: {min_sl}%. Risk of premature exits.",
            details={"stop_loss": stop_loss, "min_recommended": min_sl}
        )
    elif stop_loss > max_sl:
        return ValidationCheck(
            name="Stop Loss Sanity",
            status="warning",
            score=60.0,
            message=f"Stop loss {stop_loss}% is very wide for {strategy_type} trading. "
                   f"Recommended maximum: {max_sl}%. May allow excessive losses.",
            details={"stop_loss": stop_loss, "max_recommended": max_sl}
        )
    else:
        return ValidationCheck(
            name="Stop Loss Sanity",
            status="passed",
            score=100.0,
            message=f"Stop loss {stop_loss}% is appropriate for {strategy_type} trading. "
                   f"Within recommended range of {min_sl}%-{max_sl}%.",
            details={"stop_loss": stop_loss, "recommended_range": [min_sl, max_sl]}
        )


def generate_recommendations(
    checks: List[ValidationCheck],
    parameters: StrategyParameters
) -> List[Recommendation]:
    """Generate smart recommendations based on validation results"""
    recommendations = []
    
    # Find the R:R check
    rr_check = next((c for c in checks if c.name == "Risk/Reward Ratio"), None)
    if rr_check and rr_check.score < 75:
        ratio = rr_check.details.get('ratio', 1.0)
        optimal_tp = parameters.stop_loss * 2.0
        
        recommendations.append(Recommendation(
            priority="HIGH",
            title="Optimize Risk/Reward Ratio",
            description=f"Current R:R is {ratio:.2f}:1. Increase take profit from {parameters.take_profit}% "
                       f"to {optimal_tp:.1f}% for better 2:1 ratio.",
            impact="High - Doubles profit potential per trade",
            effort="Low - Simple parameter adjustment",
            action={"suggested_take_profit": optimal_tp}
        ))
    
    # Find position size check
    ps_check = next((c for c in checks if c.name == "Position Size"), None)
    if ps_check and ps_check.score < 60:
        recommended = ps_check.details.get('recommended_max', 10)
        
        recommendations.append(Recommendation(
            priority="HIGH",
            title="Reduce Position Size",
            description=f"Current {parameters.position_size}% position is too risky. "
                       f"Reduce to {recommended}% to protect capital during downturns.",
            impact="High - Prevents catastrophic losses",
            effort="Low - Adjust position size parameter",
            action={"suggested_position_size": recommended}
        ))
    
    # Stop loss recommendations
    sl_check = next((c for c in checks if c.name == "Stop Loss Sanity"), None)
    if sl_check and sl_check.score < 70:
        if parameters.stop_loss < 3.0:
            recommendations.append(Recommendation(
                priority="MEDIUM",
                title="Widen Stop Loss",
                description=f"Stop loss {parameters.stop_loss}% is too tight. "
                           f"Consider 3-5% to avoid being stopped out by normal volatility.",
                impact="Medium - Reduces premature exits",
                effort="Low - Increase stop loss parameter",
                action={"suggested_stop_loss": 4.0}
            ))
    
    # Strategy type recommendations
    st_check = next((c for c in checks if c.name == "Strategy Type Compatibility"), None)
    if st_check and st_check.status == "failed":
        recommendations.append(Recommendation(
            priority="CRITICAL",
            title="Change Strategy Type",
            description=f"{parameters.strategy_type.value.title()} trading is not suitable for your risk profile. "
                       f"Switch to swing or position trading for better alignment.",
            impact="Critical - Prevents high-risk mismatch",
            effort="Low - Select different strategy type",
            action={"suggested_strategy_type": "swing"}
        ))
    
    # General best practices
    if not recommendations:
        recommendations.append(Recommendation(
            priority="LOW",
            title="Monitor Performance",
            description="Your strategy parameters look good! Continue monitoring performance "
                       "and adjust based on real trading results.",
            impact="Low - Ongoing optimization",
            effort="Low - Regular review"
        ))
    
    return sorted(recommendations, key=lambda x: {
        'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3
    }[x.priority])


# ============ API ENDPOINTS ============

class TaskResponse(BaseModel):
    """Response for async task submission"""
    task_id: str
    status: str
    message: str
    progress: Optional[int] = None
    result: Optional[ValidationResult] = None


@router.post(
    "/validate",
    response_model=TaskResponse,
    status_code=status.HTTP_202_ACCEPTED,
    responses={
        400: {"description": "Invalid request"},
        500: {"description": "Internal server error"}
    }
)
async def validate_strategy(request: ValidationRequest) -> TaskResponse:
    """
    Submit privacy-first strategy validation request (async via Kafka)
    
    Privacy Flow:
    1. Verify signature (ownership proof)
    2. Check timestamp (replay protection)
    3. Cache by commitment (not wallet)
    4. Publish verified wallet to Kafka
    5. Worker processes ephemerally
    6. Return task_id for polling
    
    Performs comprehensive validation including:
    - Risk/reward ratio analysis
    - Position size evaluation  
    - Strategy type compatibility
    - Stop loss sanity checks
    - Smart recommendations
    - AI-powered predictions
    - Historical backtesting
    
    Returns task_id to poll for results via /status/{task_id}
    """
    try:
        commitment = request.commitment
        wallet_address = request.wallet_address.lower()
        
        logger.info(
            f"Strategy validation request",
            extra={
                "commitment": commitment[:10] + "...",
                "strategy_type": request.parameters.strategy_type.value,
                "backtest_days": request.backtest_days
            }
        )
        
        # CRITICAL: Verify wallet ownership via signature
        signature_verifier.verify_ownership(
            wallet_address=wallet_address,
            signature=request.signature,
            message=request.message,
            timestamp=request.timestamp
        )
        logger.info(f"Ownership verified for {wallet_address[:10]}...")
        
        # Check cache by commitment (privacy-preserving)
        cache_key = f"strategy:{commitment}:{request.parameters.strategy_type.value}"
        cached = await cache.get(cache_key)
        
        if cached:
            logger.info(f"Returning cached strategy validation for commitment {commitment[:10]}...")
            return TaskResponse(
                task_id="cached",
                status="completed",
                message="Returned from cache",
                progress=100,
                result=ValidationResult(**cached)
            )
        
        # Publish to Kafka for worker processing
        # Worker receives VERIFIED wallet address for ephemeral processing
        task_id = await kafka_producer.publish_strategy_validation_request(
            commitment=commitment,
            wallet_address=wallet_address,  # Verified, will be processed ephemerally
            parameters=request.parameters.dict(),
            backtest_days=request.backtest_days
        )
        
        # Set initial task status
        await cache.set_task_status(task_id, "pending", progress=0)
        
        # Link task to commitment
        await cache.link_task_to_commitment(task_id, commitment)
        
        return TaskResponse(
            task_id=task_id,
            status="pending",
            message="Strategy validation request submitted successfully"
        )
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to submit strategy validation: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get(
    "/status/{task_id}",
    response_model=TaskResponse,
    responses={
        404: {"description": "Task not found"},
        500: {"description": "Internal server error"}
    }
)
async def get_validation_status(task_id: str) -> TaskResponse:
    """
    Get current status of strategy validation task
    
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
            return TaskResponse(
                task_id="cached",
                status="completed",
                progress=100,
                message="Returned from cache"
            )
        
        # Get task status
        status_data = await cache.get_task_status(task_id)
        if not status_data:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Task not found"
            )
        
        response = TaskResponse(
            task_id=task_id,
            status=status_data.get("status", "pending"),
            progress=status_data.get("progress", 0),
            message=status_data.get("message", "")
        )
        
        # If completed, include result
        if status_data.get("status") == "completed":
            result = await cache.get_task_result(task_id)
            
            # If result expired from Redis, user must re-validate
            # This is intentional for privacy - no persistent storage
            if not result:
                logger.warning(f"Result expired from Redis for task {task_id}")
                response.message = (
                    "Validation result has expired from cache. "
                    "Please submit a new validation request."
                )
            else:
                response.result = ValidationResult(**result)
        
        return response
        
    except HTTPException:
        raise
    except Exception as e:
        logger.error(f"Failed to get task status: {e}", exc_info=True)
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"Internal server error: {str(e)}"
        )


@router.get("/health")
async def health_check():
    """Health check for strategy validation service"""
    return {"status": "healthy", "service": "strategy_validation"}

