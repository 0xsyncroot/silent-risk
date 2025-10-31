"""
Blockchain Writer Service

Handles on-chain transaction submissions to smart contracts.
Primary use: Submit risk commitments to RiskScoreVault contract.

Architecture:
- Async transaction handling with retry logic
- Gas estimation and management
- Transaction status monitoring
- Nonce management for concurrent transactions

Security:
- Uses authorized updater wallet (hot wallet)
- Private key stored in environment variables
- Transaction signing handled locally

Author: Silent Risk Team
"""

import logging
from typing import Optional, Dict, Any
from decimal import Decimal

from web3 import Web3, AsyncWeb3
from web3.middleware import async_geth_poa_middleware
from eth_account import Account
from eth_account.signers.local import LocalAccount
from eth_abi import encode
from tenacity import retry, stop_after_attempt, wait_exponential

from app.config.settings import settings

logger = logging.getLogger(__name__)


class BlockchainWriter:
    """
    Service for submitting transactions to blockchain contracts
    
    Capabilities:
    - Submit risk score commitments to RiskScoreVault
    - Manage transaction nonces
    - Handle gas estimation and pricing
    - Retry failed transactions
    
    Usage:
        writer = BlockchainWriter()
        await writer.initialize()
        tx_hash = await writer.submit_risk_commitment(commitment_data)
    """
    
    def __init__(self):
        """Initialize blockchain writer (call initialize() after creation)"""
        self.w3: Optional[AsyncWeb3] = None
        self.account: Optional[LocalAccount] = None
        self.vault_contract = None
        self.is_initialized = False
        logger.info("BlockchainWriter created (needs initialization)")
    
    async def initialize(self):
        """
        Initialize Web3 connection and load contracts
        
        Requirements:
        - WORKER_PRIVATE_KEY in environment (authorized updater)
        - ETH_RPC_URL configured
        - VAULT_CONTRACT_ADDRESS configured
        
        Raises:
            ValueError: If required config missing
            ConnectionError: If cannot connect to RPC
        """
        if self.is_initialized:
            logger.warning("BlockchainWriter already initialized")
            return
        
        logger.info("Initializing BlockchainWriter...")
        
        # Validate configuration
        if not settings.WORKER_PRIVATE_KEY:
            raise ValueError("WORKER_PRIVATE_KEY not configured")
        if not settings.VAULT_CONTRACT_ADDRESS:
            raise ValueError("VAULT_CONTRACT_ADDRESS not configured")
        
        # Connect to blockchain
        self.w3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(settings.ETH_RPC_URL))
        self.w3.middleware_onion.inject(async_geth_poa_middleware, layer=0)
        
        # Verify connection
        try:
            is_connected = await self.w3.is_connected()
            if not is_connected:
                raise ConnectionError(f"Cannot connect to RPC: {settings.ETH_RPC_URL}")
            
            chain_id = await self.w3.eth.chain_id
            logger.info(f"Connected to chain ID: {chain_id}")
        except Exception as e:
            logger.error(f"Failed to connect to blockchain: {e}")
            raise
        
        # Load account
        self.account = Account.from_key(settings.WORKER_PRIVATE_KEY)
        logger.info(f"Loaded worker account: {self.account.address}")
        
        # Load RiskScoreVault contract
        # TODO: Load actual contract ABI
        # For now, we'll call functions directly via eth_sendTransaction
        self.vault_contract_address = Web3.to_checksum_address(
            settings.VAULT_CONTRACT_ADDRESS
        )
        
        self.is_initialized = True
        logger.info("BlockchainWriter initialized successfully")
    
    @retry(
        stop=stop_after_attempt(3),
        wait=wait_exponential(multiplier=1, min=2, max=10)
    )
    async def submit_risk_commitment(
        self,
        commitment: bytes,
        plaintext_score: int,
        block_height: int,
        nullifier_hash: bytes,
        address_proof: bytes = b''
    ) -> str:
        """
        Submit risk score commitment to RiskScoreVault contract
        
        Calls: RiskScoreVault.setRiskScoreFromPlaintext()
        
        Args:
            commitment: Commitment hash (32 bytes)
            plaintext_score: Risk score 0-10000 (will be encrypted on-chain)
            block_height: Current block height
            nullifier_hash: Nullifier for duplicate prevention
            address_proof: ZK proof bytes (optional)
            
        Returns:
            Transaction hash (hex string)
            
        Raises:
            ValueError: If parameters invalid
            Exception: If transaction fails
            
        Note:
            Uses setRiskScoreFromPlaintext() which encrypts on-chain.
            Alternative: Use setRiskScore() with pre-encrypted value.
        """
        if not self.is_initialized:
            await self.initialize()
        
        logger.info(
            f"Submitting risk commitment to vault",
            extra={
                "commitment": commitment[:10].hex(),
                "score": plaintext_score,
                "block": block_height
            }
        )
        
        # Validate inputs
        if not (0 <= plaintext_score <= 10000):
            raise ValueError(f"Invalid score: {plaintext_score}")
        if len(commitment) != 32:
            raise ValueError(f"Invalid commitment length: {len(commitment)}")
        
        # Encode function call
        # setRiskScoreFromPlaintext(bytes32,uint32,uint256,bytes32,bytes)
        function_signature = Web3.keccak(
            text="setRiskScoreFromPlaintext(bytes32,uint32,uint256,bytes32,bytes)"
        )[:4]
        
        # Encode parameters (ABI encoding)
        # TODO: Use actual contract ABI for proper encoding
        # For now, this is a placeholder structure
        calldata = function_signature + self._encode_parameters(
            commitment,
            plaintext_score,
            block_height,
            nullifier_hash,
            address_proof
        )
        
        # Get current nonce
        nonce = await self.w3.eth.get_transaction_count(self.account.address)
        
        # Estimate gas
        gas_estimate = await self._estimate_gas(calldata)
        
        # Get gas price
        gas_price = await self.w3.eth.gas_price
        
        # Build transaction
        tx = {
            'from': self.account.address,
            'to': self.vault_contract_address,
            'value': 0,
            'gas': gas_estimate,
            'gasPrice': gas_price,
            'nonce': nonce,
            'data': calldata,
            'chainId': await self.w3.eth.chain_id
        }
        
        # Sign transaction
        signed_tx = self.account.sign_transaction(tx)
        
        # Send transaction
        tx_hash = await self.w3.eth.send_raw_transaction(signed_tx.rawTransaction)
        tx_hash_hex = tx_hash.hex()
        
        logger.info(
            f"Transaction submitted",
            extra={
                "tx_hash": tx_hash_hex,
                "commitment": commitment[:10].hex()
            }
        )
        
        # Wait for confirmation (optional, configurable)
        if settings.WAIT_FOR_CONFIRMATION:
            receipt = await self.w3.eth.wait_for_transaction_receipt(
                tx_hash,
                timeout=120
            )
            
            if receipt['status'] != 1:
                raise Exception(f"Transaction failed: {tx_hash_hex}")
            
            logger.info(f"Transaction confirmed in block {receipt['blockNumber']}")
        
        return tx_hash_hex
    
    async def _estimate_gas(self, calldata: bytes) -> int:
        """
        Estimate gas for transaction
        
        Args:
            calldata: Encoded function call
            
        Returns:
            Estimated gas limit (with 20% buffer)
        """
        try:
            estimate = await self.w3.eth.estimate_gas({
                'from': self.account.address,
                'to': self.vault_contract_address,
                'data': calldata
            })
            # Add 20% buffer
            return int(estimate * 1.2)
        except Exception as e:
            logger.warning(f"Gas estimation failed: {e}, using default")
            return 300000  # Default gas limit
    
    def _encode_parameters(
        self,
        commitment: bytes,
        score: int,
        block_height: int,
        nullifier: bytes,
        proof: bytes
    ) -> bytes:
        """
        Encode function parameters using proper ABI encoding
        
        Args:
            commitment: bytes32
            score: uint32
            block_height: uint256
            nullifier: bytes32
            proof: bytes (dynamic)
            
        Returns:
            Encoded parameters according to Solidity ABI spec
        """
        # Proper ABI encoding using eth_abi library
        encoded = encode(
            ['bytes32', 'uint32', 'uint256', 'bytes32', 'bytes'],
            [commitment, score, block_height, nullifier, proof]
        )
        
        return encoded
    
    async def get_current_block(self) -> int:
        """
        Get current block number
        
        Returns:
            Current block height
            
        Raises:
            Exception: If not initialized or RPC fails
        """
        if not self.is_initialized:
            await self.initialize()
        
        return await self.w3.eth.block_number
    
    async def get_balance(self) -> Decimal:
        """
        Get worker account ETH balance
        
        Returns:
            Balance in ETH
        """
        if not self.is_initialized:
            await self.initialize()
        
        balance_wei = await self.w3.eth.get_balance(self.account.address)
        balance_eth = self.w3.from_wei(balance_wei, 'ether')
        return Decimal(str(balance_eth))
    
    async def close(self):
        """Close connections"""
        logger.info("Closing BlockchainWriter...")
        self.is_initialized = False


# Global instance
blockchain_writer = BlockchainWriter()

