"""
Network Manager

Manages Web3 connections to blockchain networks.
Simple implementation focused on Ethereum Sepolia.
"""

import logging
from typing import Optional

from web3 import AsyncWeb3
from web3.middleware import async_geth_poa_middleware

from app.config.settings import settings

logger = logging.getLogger(__name__)


class NetworkManager:
    """
    Manages Web3 connections
    
    Responsibilities:
    - Connect to Ethereum RPC
    - Handle PoA middleware (Sepolia)
    - Provide async Web3 instance
    """
    
    def __init__(self):
        self._web3: Optional[AsyncWeb3] = None
    
    async def get_async_web3(self, network: str = "ethereum") -> AsyncWeb3:
        """
        Get async Web3 instance
        
        Args:
            network: Network name (currently only "ethereum" supported)
            
        Returns:
            AsyncWeb3 instance connected to configured RPC
        """
        if self._web3 is not None:
            return self._web3
        
        # Create Web3 instance
        self._web3 = AsyncWeb3(AsyncWeb3.AsyncHTTPProvider(
            settings.ETH_RPC_URL,
            request_kwargs={"timeout": 30}
        ))
        
        # Add PoA middleware for Sepolia
        if settings.ETH_CHAIN_ID == 11155111:  # Sepolia
            self._web3.middleware_onion.inject(async_geth_poa_middleware, layer=0)
        
        # Verify connection
        try:
            block_number = await self._web3.eth.block_number
            logger.info(
                f"Connected to Ethereum",
                extra={
                    "rpc": settings.ETH_RPC_URL[:30] + "...",
                    "chain_id": settings.ETH_CHAIN_ID,
                    "block": block_number
                }
            )
        except Exception as e:
            logger.error(f"Failed to connect to Ethereum RPC: {e}")
            raise
        
        return self._web3
    
    async def close(self):
        """Close Web3 connection"""
        if self._web3:
            # AsyncWeb3 doesn't need explicit close
            self._web3 = None
            logger.info("Web3 connection closed")


# Global instance
_network_manager: Optional[NetworkManager] = None


async def get_network_manager() -> NetworkManager:
    """
    Get global NetworkManager instance
    
    Returns:
        Singleton NetworkManager instance
    """
    global _network_manager
    
    if _network_manager is None:
        _network_manager = NetworkManager()
    
    return _network_manager
