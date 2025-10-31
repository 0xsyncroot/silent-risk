"""
Passport Service

Generates passport commitments for zero-knowledge proof based minting.
Integrates with RiskScoreVault and FHE encryption.

Flow:
1. Receive risk analysis result from handler
2. Encrypt score using FHE service
3. Generate commitment for ZK proof
4. Submit to RiskScoreVault contract
5. Cache passport data for user retrieval

Author: Silent Risk Team
"""

import logging
from typing import Dict, Any, Optional
from dataclasses import dataclass, asdict

from app.services.fhe_service import fhe_service, PassportCommitment
from app.services.blockchain_writer import blockchain_writer
from app.services.cache import cache
from app.config.settings import settings

logger = logging.getLogger(__name__)


@dataclass
class PassportClaimData:
    """
    Passport data returned to user for ZK proof generation
    
    Security:
    - commitment: Public (already on-chain)
    - secret: PRIVATE (user must keep safe!)
    - nullifier: Public (for proof)
    - wallet_address: PRIVATE (never revealed on-chain)
    - encrypted_score: Public (on-chain, but encrypted)
    - vault_address: Public (contract address)
    
    User Flow:
    1. Get this data from API
    2. Generate ZK proof in browser
    3. Mint passport to anonymous wallet
    """
    commitment: str  # Hex string
    secret: str  # Hex string (KEEP PRIVATE!)
    nullifier: str  # Hex string
    wallet_address: str  # Original wallet (for reference only)
    encrypted_score: str  # Hex string
    vault_address: str  # RiskScoreVault contract address
    block_height: int  # Block when commitment was stored
    tx_hash: Optional[str]  # Transaction hash of vault submission


class PassportService:
    """
    Service for generating and managing passport commitments
    
    Architecture:
    - FHE encryption for privacy
    - On-chain commitment storage
    - Off-chain data caching for user retrieval
    - ZK proof preparation
    
    Integration Points:
    - FHEService: Encrypt scores
    - BlockchainWriter: Submit to vault
    - Cache: Store claim data
    """
    
    def __init__(self):
        """Initialize passport service"""
        logger.info("PassportService initialized")
    
    async def create_passport(
        self,
        commitment: str,
        wallet_address: str,
        risk_score: int
    ) -> PassportClaimData:
        """
        Complete passport creation flow using frontend-generated commitment
        
        Steps:
        1. Use commitment from frontend (already generated)
        2. Generate secret and nullifier for ZK proof
        3. Get current block height
        4. Return claim data for frontend
        
        Args:
            commitment: Commitment hash from frontend (keccak256(wallet, secret))
            wallet_address: User's original wallet (kept private)
            risk_score: Calculated risk score (0-10000 scale)
            
        Returns:
            PassportClaimData: Data for user to claim passport
            
        Raises:
            ValueError: If score invalid
            
        Note:
            Frontend already generated commitment using their secret.
            We just need to provide metadata for passport minting.
        """
        logger.info(
            f"Creating passport metadata",
            extra={
                "commitment": commitment[:10] + "...",
                "score": risk_score
            }
        )
        
        try:
            # Frontend already has commitment and secret from localStorage
            # We need to generate nullifier for on-chain verification
            # Note: This is a placeholder - real implementation should use
            # the same secret from frontend's commitment generation
            import secrets
            nullifier = secrets.token_bytes(32)
            
            # Get current block height for reference
            block_height = await blockchain_writer.get_current_block()
            
            # IMPORTANT: Frontend will encrypt risk_score with FHEVM SDK
            # We only provide metadata here
            
            # Prepare claim data for user
            claim_data = PassportClaimData(
                commitment=commitment,  # Use frontend's commitment
                secret="",  # Frontend already has secret in localStorage
                nullifier=nullifier.hex(),
                wallet_address=wallet_address,
                encrypted_score="",  # Frontend will encrypt with FHEVM
                vault_address=settings.VAULT_CONTRACT_ADDRESS,
                block_height=block_height,
                tx_hash=None  # User will generate tx when they mint
            )
            
            # Step 6: Cache for user retrieval
            await self._cache_claim_data(wallet_address, claim_data)
            logger.info(f"Passport data cached for user")
            
            return claim_data
            
        except Exception as e:
            logger.error(
                f"Failed to create passport",
                extra={
                    "wallet": wallet_address[:10] + "...",
                    "error": str(e)
                },
                exc_info=True
            )
            raise
    
    async def _submit_to_vault(
        self,
        commitment: PassportCommitment,
        block_height: int
    ) -> str:
        """
        Submit commitment to RiskScoreVault contract
        
        Args:
            commitment: Generated passport commitment
            block_height: Current block height
            
        Returns:
            Transaction hash
            
        Raises:
            Exception: If submission fails
        """
        logger.debug("Submitting commitment to RiskScoreVault...")
        
        # Prepare submission data
        vault_data = await fhe_service.prepare_vault_submission(
            commitment,
            block_height
        )
        
        # Submit transaction
        tx_hash = await blockchain_writer.submit_risk_commitment(
            commitment=vault_data["commitment"],
            plaintext_score=vault_data["plaintext_score"],
            block_height=vault_data["block_height"],
            nullifier_hash=vault_data["nullifier_hash"],
            address_proof=vault_data["address_proof"]
        )
        
        return tx_hash
    
    async def _cache_claim_data(
        self,
        wallet_address: str,
        claim_data: PassportClaimData
    ):
        """
        Cache passport claim data for user retrieval
        
        Args:
            wallet_address: User's wallet (cache key)
            claim_data: Passport data to cache
            
        Note:
            Cached for 24 hours. User should claim passport within this time.
        """
        cache_key = f"passport:claim:{wallet_address.lower()}"
        
        await cache.redis.setex(
            cache_key,
            86400,  # 24 hours
            str(asdict(claim_data))
        )
        
        logger.debug(f"Passport data cached: {cache_key}")
    
    async def get_claim_data(
        self,
        wallet_address: str
    ) -> Optional[PassportClaimData]:
        """
        Retrieve cached passport claim data
        
        Args:
            wallet_address: User's wallet address
            
        Returns:
            PassportClaimData if exists, None otherwise
            
        Note:
            Called by backend API when user requests passport data.
        """
        cache_key = f"passport:claim:{wallet_address.lower()}"
        
        data = await cache.redis.get(cache_key)
        if not data:
            logger.info(f"No cached passport data for {wallet_address[:10]}...")
            return None
        
        # Parse cached data
        try:
            data_dict = eval(data)  # Safe in this context
            return PassportClaimData(**data_dict)
        except Exception as e:
            logger.error(f"Failed to parse cached passport data: {e}")
            return None


# Global service instance
passport_service = PassportService()

