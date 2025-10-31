"""
API Request/Response Models (Privacy-First Architecture)

All models follow zero-knowledge principles:
- Backend NEVER receives wallet addresses directly
- Only commitments and encrypted data are transmitted
- User maintains full control of their private data

Author: Silent Risk Team
"""

from typing import Optional, Dict, Any, List
from datetime import datetime
from enum import Enum

from pydantic import BaseModel, Field, validator


# ============ ENUMS ============


class TaskStatus(str, Enum):
    """Task processing status"""
    PENDING = "pending"
    PROCESSING = "processing"
    COMPLETED = "completed"
    FAILED = "failed"


class RiskBand(str, Enum):
    """Risk classification bands (matches on-chain enum)"""
    NONE = "none"
    LOW = "low"
    MEDIUM = "medium"
    HIGH = "high"
    CRITICAL = "critical"


# ============ RISK ANALYSIS MODELS ============


class RiskAnalysisRequest(BaseModel):
    """
    Request model for privacy-preserving risk analysis with ownership proof
    
    Two-Phase Security Model:
    
    PHASE 1 - OWNERSHIP VERIFICATION (Signature):
    - User signs message proving they own the wallet
    - Backend verifies signature (prevents analyzing others' wallets)
    - Worker receives verified wallet (ephemeral processing)
    
    PHASE 2 - PRIVACY PRESERVATION (Commitment + ZK):
    - Commitment hides wallet in on-chain storage
    - ZK proof enables anonymous passport minting
    - Organizations verify risk without knowing wallet
    
    Attack Prevention:
    - Cannot analyze someone else's wallet (signature required)
    - Cannot replay old requests (timestamp check)
    - Cannot fake ownership (ecrecover verification)
    """
    
    # Commitment for privacy (used in on-chain storage)
    commitment: str = Field(
        ...,
        description="Commitment hash: keccak256(abi.encodePacked(wallet, secret))",
        pattern="^0x[a-fA-F0-9]{64}$",
        examples=["0x1234..."]
    )
    
    # Wallet address for ownership verification
    wallet_address: str = Field(
        ...,
        description="Ethereum address to analyze (must match signature)",
        pattern="^0x[a-fA-F0-9]{40}$",
        examples=["0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb"]
    )
    
    # Signature proving ownership (EIP-191 personal_sign)
    signature: str = Field(
        ...,
        description="Signature of message by wallet owner",
        pattern="^0x[a-fA-F0-9]{130}$",  # 65 bytes = 130 hex chars
        examples=["0xabc..."]
    )
    
    # Message that was signed (includes timestamp for replay protection)
    message: str = Field(
        ...,
        description="Signed message: 'Silent Risk Analysis: {wallet} at {timestamp}'",
        examples=["Silent Risk Analysis: 0x742d... at 1704067200"]
    )
    
    # Timestamp for replay attack prevention
    timestamp: int = Field(
        ...,
        description="Unix timestamp when message was signed",
        gt=1704067200,  # After Jan 1, 2024
        examples=[1704067200]
    )
    
    force_refresh: bool = Field(
        default=False,
        description="Force new analysis even if cached"
    )
    
    @validator('commitment')
    def validate_commitment(cls, v):
        """Ensure commitment is a valid 32-byte hex string"""
        if not v.startswith('0x') or len(v) != 66:
            raise ValueError('Commitment must be a 32-byte hex string (0x + 64 chars)')
        return v.lower()
    
    @validator('wallet_address')
    def validate_wallet(cls, v):
        """Ensure wallet address is valid Ethereum address"""
        if not v.startswith('0x') or len(v) != 42:
            raise ValueError('Invalid Ethereum address format')
        return v.lower()
    
    @validator('message')
    def validate_message_format(cls, v, values):
        """Ensure message follows expected format with timestamp"""
        if 'wallet_address' in values and 'timestamp' in values:
            expected_wallet = values['wallet_address'].lower()
            expected_timestamp = str(values['timestamp'])
            
            # Message must contain wallet and timestamp
            if expected_wallet not in v.lower() or expected_timestamp not in v:
                raise ValueError(
                    f"Message must contain wallet address and timestamp. "
                    f"Expected format: 'Silent Risk Analysis: {{wallet}} at {{timestamp}}'"
                )
        
        return v


class RiskFactor(BaseModel):
    """Individual risk factor contributing to overall risk score"""
    name: str = Field(..., description="Factor name")
    score: int = Field(..., ge=0, le=10000, description="Factor score (0-10000)")
    status: str = Field(..., description="Status: good, medium, high")
    description: Optional[str] = Field(None, description="Detailed description")


class RiskAnalysisResult(BaseModel):
    """
    Risk analysis result (cached in Redis, permanent copy on-chain)
    
    NOTE: This result does NOT contain wallet address.
    Only commitment hash is included for privacy.
    """
    commitment: str = Field(..., description="Commitment hash that identifies this analysis")
    risk_score: int = Field(..., ge=0, le=10000, description="Overall risk score")
    risk_band: RiskBand = Field(..., description="Risk classification band")
    confidence: int = Field(..., ge=0, le=100, description="Confidence level")
    factors: List[RiskFactor] = Field(default_factory=list, description="Risk factors breakdown")
    
    analyzed_at: str = Field(..., description="ISO timestamp when analysis completed")
    block_height: Optional[int] = Field(None, description="Block height when stored on-chain")
    vault_address: Optional[str] = Field(None, description="RiskScoreVault contract address")
    
    # Passport info (if generated)
    passport: Optional[Dict[str, Any]] = Field(
        None,
        description="Passport commitment details if generated"
    )


# ============ STRATEGY VALIDATION MODELS ============


class StrategyType(str, Enum):
    """Trading strategy types"""
    SCALPING = "scalping"
    SWING = "swing"
    POSITION = "position"


class StrategyParameters(BaseModel):
    """Strategy parameters for validation"""
    strategy_type: StrategyType
    take_profit: float = Field(..., gt=0, le=100, description="Take profit percentage")
    stop_loss: float = Field(..., gt=0, le=100, description="Stop loss percentage")
    position_size: float = Field(..., gt=0, le=100, description="Position size percentage")
    cooldown: int = Field(..., gt=0, description="Cooldown period in hours")
    max_drawdown: float = Field(..., gt=0, le=100, description="Max drawdown percentage")


class StrategyValidationRequest(BaseModel):
    """
    Request for strategy validation
    
    Privacy: Uses commitment instead of wallet address
    """
    commitment: str = Field(
        ...,
        description="User's commitment hash",
        pattern="^0x[a-fA-F0-9]{64}$"
    )
    
    encrypted_wallet: str = Field(
        ...,
        description="Encrypted wallet for fetching on-chain metrics"
    )
    
    parameters: StrategyParameters = Field(..., description="Strategy parameters to validate")
    backtest_days: int = Field(default=30, ge=1, le=90, description="Backtest period in days")


class ValidationCheck(BaseModel):
    """Individual validation check result"""
    name: str
    status: str  # passed, warning, failed
    score: float = Field(..., ge=0, le=100)
    message: str
    details: Optional[Dict[str, Any]] = None


class AIAnalysis(BaseModel):
    """AI-powered strategy analysis"""
    win_rate: float = Field(..., ge=0, le=100, description="Predicted win rate %")
    sharpe_ratio: float = Field(..., description="Expected Sharpe ratio")
    score: float = Field(..., ge=0, le=100, description="Overall AI score")
    insights: List[str] = Field(default_factory=list, description="AI-generated insights")


class BacktestSummary(BaseModel):
    """Backtest simulation results"""
    total_trades: int
    winning_trades: int
    losing_trades: int
    win_rate: float
    profit_loss: float
    max_drawdown: float
    sharpe_ratio: float


class ValidationResult(BaseModel):
    """Complete strategy validation result"""
    commitment: str = Field(..., description="User's commitment hash")
    result: str = Field(..., description="PASSED, WARNING, or FAILED")
    overall_score: float = Field(..., ge=0, le=100, description="Overall validation score")
    
    checks: List[ValidationCheck] = Field(default_factory=list)
    recommendations: List[str] = Field(default_factory=list)
    
    ai_analysis: Optional[AIAnalysis] = None
    backtest_summary: Optional[BacktestSummary] = None
    
    validated_at: str = Field(..., description="ISO timestamp")


# ============ COMMON RESPONSE MODELS ============


class ErrorResponse(BaseModel):
    """Standard error response"""
    detail: str = Field(..., description="Error message")
    error_code: Optional[str] = Field(None, description="Machine-readable error code")


class TaskResponse(BaseModel):
    """Asynchronous task response"""
    task_id: str = Field(..., description="Unique task identifier for polling")
    status: TaskStatus = Field(..., description="Current task status")
    progress: int = Field(default=0, ge=0, le=100, description="Progress percentage")
    message: Optional[str] = Field(None, description="Status message")
    
    # Result is only included when status is COMPLETED
    result: Optional[Dict[str, Any]] = Field(None, description="Task result data")
    error: Optional[str] = Field(None, description="Error message if FAILED")


# ============ PASSPORT MODELS ============


class PassportClaimData(BaseModel):
    """
    Data required by frontend to generate ZK proof and claim passport
    
    Privacy Note:
    - This data is returned to the user who initiated the analysis
    - Secret and encrypted_score_data are private inputs for ZK circuit
    - User generates proof in browser, mints from anonymous wallet
    """
    commitment: str = Field(..., description="Commitment hash")
    vault_address: str = Field(..., description="RiskScoreVault contract address")
    block_height: int = Field(..., description="Block when commitment was recorded")
    tx_hash: str = Field(..., description="Transaction hash of commitment submission")
    
    # Private data for ZK proof generation (keep secure!)
    secret: str = Field(..., description="Secret used in commitment (DO NOT SHARE!)")
    encrypted_score_data: str = Field(..., description="FHE encrypted score")
    nullifier_seed: str = Field(..., description="Seed for generating nullifier")
    
    risk_score: int = Field(..., description="Plaintext risk score (for user reference)")
    generated_at: str = Field(..., description="ISO timestamp")
    
    instructions: Dict[str, str] = Field(
        default_factory=lambda: {
            "step1": "Keep your secret safe - you'll need it to claim your passport",
            "step2": "Generate ZK proof in your browser using the provided data",
            "step3": "Mint passport NFT from any anonymous wallet",
            "step4": "Your original wallet address remains private"
        }
    )


class PassportStatus(str, Enum):
    """Passport generation status"""
    READY_TO_CLAIM = "ready_to_claim"
    GENERATION_FAILED = "generation_failed"
    NOT_GENERATED = "not_generated"
    CLAIMED = "claimed"


class PassportStatusResponse(BaseModel):
    """Response for passport status check"""
    status: PassportStatus = Field(..., description="Current passport status")
    commitment: Optional[str] = Field(None, description="Commitment hash if available")
    vault_address: Optional[str] = Field(None, description="Vault contract address")
    block_height: Optional[int] = Field(None, description="Block height when recorded")
    tx_hash: Optional[str] = Field(None, description="Transaction hash")
    error: Optional[str] = Field(None, description="Error message if generation failed")
    message: Optional[str] = Field(None, description="Human-readable status message")
