"""
Signature Verification Service

Verifies wallet ownership through EIP-191 personal_sign signatures.
Prevents users from analyzing wallets they don't own.

Security Features:
- Signature verification (ecrecover)
- Timestamp validation (prevent replay attacks)
- Message format validation
- Rate limiting ready (can add IP-based limits)

Author: Silent Risk Team
"""

import logging
import time
from typing import Tuple

from eth_account import Account
from eth_account.messages import encode_defunct
from fastapi import HTTPException, status

logger = logging.getLogger(__name__)


class SignatureVerifier:
    """
    Service for verifying wallet ownership via signatures
    
    Flow:
    1. User signs message: "Silent Risk Analysis: {wallet} at {timestamp}"
    2. Backend receives: wallet, signature, message, timestamp
    3. Verify signature recovers to wallet address
    4. Verify timestamp is recent (< 5 minutes)
    5. Verify message format is correct
    
    Security Properties:
    - Cannot fake ownership (private key required for signature)
    - Cannot replay old requests (timestamp check)
    - Cannot analyze others' wallets (signature must match)
    """
    
    # Maximum age of a signature request (5 minutes)
    MAX_SIGNATURE_AGE_SECONDS = 300
    
    # Expected message format template
    MESSAGE_TEMPLATE = "Silent Risk Analysis: {wallet} at {timestamp}"
    
    def verify_ownership(
        self,
        wallet_address: str,
        signature: str,
        message: str,
        timestamp: int
    ) -> bool:
        """
        Verify that the user owns the wallet they're trying to analyze
        
        This prevents attack scenarios where:
        - User A tries to analyze User B's wallet
        - User tries to analyze high-reputation wallet to steal their score
        - User tries to replay old signatures
        
        Args:
            wallet_address: Claimed wallet address (must match signature)
            signature: EIP-191 signature from wallet
            message: Signed message containing wallet and timestamp
            timestamp: Unix timestamp when signed
            
        Returns:
            True if verification passes
            
        Raises:
            HTTPException: 401 if verification fails
        """
        
        # Step 1: Verify timestamp is recent (prevent replay attacks)
        self._verify_timestamp(timestamp)
        
        # Step 2: Verify message format
        self._verify_message_format(message, wallet_address, timestamp)
        
        # Step 3: Recover signer from signature
        recovered_address = self._recover_signer(message, signature)
        
        # Step 4: Verify recovered address matches claimed wallet
        if recovered_address.lower() != wallet_address.lower():
            logger.warning(
                f"Signature verification failed: "
                f"claimed={wallet_address[:10]}..., "
                f"recovered={recovered_address[:10]}..."
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Signature verification failed. The signature does not match the wallet address."
            )
        
        logger.info(f"Ownership verified for wallet: {wallet_address[:10]}...")
        return True
    
    def _verify_timestamp(self, timestamp: int):
        """
        Verify timestamp is recent to prevent replay attacks
        
        Args:
            timestamp: Unix timestamp from request
            
        Raises:
            HTTPException: 401 if timestamp is too old or in future
        """
        current_time = int(time.time())
        age = current_time - timestamp
        
        # Reject if timestamp is in the future (clock skew tolerance: 60s)
        if age < -60:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Timestamp is in the future. Please check your system clock."
            )
        
        # Reject if timestamp is too old (replay attack prevention)
        if age > self.MAX_SIGNATURE_AGE_SECONDS:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Signature has expired. Please sign a new message. (Age: {age}s, Max: {self.MAX_SIGNATURE_AGE_SECONDS}s)"
            )
        
        logger.debug(f"Timestamp verification passed (age: {age}s)")
    
    def _verify_message_format(
        self,
        message: str,
        wallet_address: str,
        timestamp: int
    ):
        """
        Verify message follows expected format
        
        Expected: "Silent Risk Analysis: {wallet} at {timestamp}"
        
        This prevents users from reusing signatures from other dApps.
        
        Args:
            message: Signed message
            wallet_address: Expected wallet in message
            timestamp: Expected timestamp in message
            
        Raises:
            HTTPException: 401 if message format is invalid
        """
        expected = self.MESSAGE_TEMPLATE.format(
            wallet=wallet_address.lower(),
            timestamp=timestamp
        )
        
        # Normalize for comparison (case-insensitive)
        if message.lower() != expected.lower():
            logger.warning(
                f"Message format validation failed. "
                f"Expected: '{expected}', Got: '{message}'"
            )
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=(
                    "Invalid message format. "
                    f"Expected: '{self.MESSAGE_TEMPLATE}' "
                    "with your wallet address and current timestamp."
                )
            )
        
        logger.debug("Message format verification passed")
    
    def _recover_signer(self, message: str, signature: str) -> str:
        """
        Recover Ethereum address from signature using ecrecover
        
        Uses EIP-191 personal_sign format (same as MetaMask, WalletConnect, etc.)
        
        Args:
            message: Original message that was signed
            signature: Signature bytes (0x + 130 hex chars)
            
        Returns:
            Recovered Ethereum address (checksummed)
            
        Raises:
            HTTPException: 401 if signature recovery fails
        """
        try:
            # Encode message in EIP-191 format
            # This adds prefix: "\x19Ethereum Signed Message:\n{len(message)}{message}"
            message_hash = encode_defunct(text=message)
            
            # Recover signer address from signature
            # This performs ecrecover: pubkey = ecrecover(hash, sig) → address
            recovered = Account.recover_message(
                message_hash,
                signature=signature
            )
            
            logger.debug(f"Recovered signer: {recovered[:10]}...")
            return recovered
            
        except Exception as e:
            logger.error(f"Signature recovery failed: {e}", exc_info=True)
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail=f"Failed to recover signer from signature: {str(e)}"
            )
    
    def generate_message_to_sign(
        self,
        wallet_address: str,
        timestamp: int
    ) -> str:
        """
        Generate the message that user should sign
        
        Helper function for frontend integration.
        
        Args:
            wallet_address: User's wallet address
            timestamp: Current Unix timestamp
            
        Returns:
            Message string to be signed
            
        Example:
            >>> verifier.generate_message_to_sign("0x742d...", 1704067200)
            "Silent Risk Analysis: 0x742d... at 1704067200"
        """
        return self.MESSAGE_TEMPLATE.format(
            wallet=wallet_address.lower(),
            timestamp=timestamp
        )


# Singleton instance
signature_verifier = SignatureVerifier()

