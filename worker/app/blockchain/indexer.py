"""
Blockchain Indexer

Fetches on-chain data directly via RPC for wallet risk analysis.
Minimizes external API dependencies - uses direct blockchain queries.
"""

import logging
from typing import List, Dict, Any, Optional
from datetime import datetime

from web3 import Web3
from web3.exceptions import Web3Exception

from app.blockchain.network_manager import get_network_manager
from app.blockchain.defi_detector import defi_detector
from app.config.settings import settings

logger = logging.getLogger(__name__)


# ERC20 Transfer Event Signature
ERC20_TRANSFER_TOPIC = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef"


class BlockchainIndexer:
    """
    On-chain data indexer using direct RPC queries
    
    Architecture:
    - Primary: Direct blockchain RPC queries
    - Fallback: Etherscan API (only when RPC insufficient)
    
    On-Chain Metrics:
    - Transaction count (eth_getTransactionCount)
    - Current balance (eth_getBalance)
    - Recent blocks scan (eth_getLogs for transfers)
    - Contract interactions (transaction receipts)
    
    Why On-Chain First:
    - No rate limits from external APIs
    - Real-time data
    - More reliable
    - Can detect complex patterns
    """
    
    def __init__(self):
        self.etherscan_api_key = settings.ETHERSCAN_API_KEY
        self.use_etherscan_fallback = bool(self.etherscan_api_key)
    
    async def get_wallet_balance(self, wallet_address: str) -> Dict[str, Any]:
        """
        Get current wallet balance from on-chain
        
        Uses: eth_getBalance RPC call
        
        Args:
            wallet_address: Ethereum address
            
        Returns:
            Dict with balance info
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            balance_wei = await w3.eth.get_balance(checksum_address)
            balance_eth = float(w3.from_wei(balance_wei, 'ether'))
            
            logger.info(f"Balance: {balance_eth:.6f} ETH")
            
            return {
                "balance_wei": balance_wei,
                "balance_eth": balance_eth
            }
            
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return {"balance_wei": 0, "balance_eth": 0.0}
    
    async def get_transaction_count(self, wallet_address: str) -> int:
        """
        Get total transaction count from on-chain
        
        Uses: eth_getTransactionCount RPC call
        This returns the nonce, which equals total sent transactions.
        
        Args:
            wallet_address: Ethereum address
            
        Returns:
            Number of transactions sent by this address
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            tx_count = await w3.eth.get_transaction_count(checksum_address)
            
            logger.info(f"Transaction count: {tx_count}")
            return tx_count
            
        except Exception as e:
            logger.error(f"Failed to get transaction count: {e}")
            return 0
    
    async def get_balance(self, wallet_address: str) -> dict:
        """
        Get current ETH balance
        
        Args:
            wallet_address: Ethereum address
            
        Returns:
            Dict with balance in Wei and ETH
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            balance_wei = await w3.eth.get_balance(checksum_address)
            balance_eth = float(Web3.from_wei(balance_wei, 'ether'))
            
            logger.info(f"Balance: {balance_eth:.4f} ETH")
            return {
                "balance_wei": int(balance_wei),
                "balance_eth": balance_eth
            }
            
        except Exception as e:
            logger.error(f"Failed to get balance: {e}")
            return {
                "balance_wei": 0,
                "balance_eth": 0.0
            }
    
    async def scan_recent_blocks_for_activity(
        self,
        wallet_address: str,
        blocks_to_scan: int = 1000
    ) -> Dict[str, Any]:
        """
        Scan recent blocks for wallet activity using on-chain logs
        
        Uses: eth_getLogs to find:
        - ERC20 transfers (Transfer events)
        - Contract interactions
        - Received transactions
        
        This is more reliable than Etherscan API and has no rate limits.
        
        Args:
            wallet_address: Ethereum address
            blocks_to_scan: Number of recent blocks to scan
            
        Returns:
            Dict with activity metrics
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            current_block = await w3.eth.block_number
            from_block = max(0, current_block - blocks_to_scan)
            
            logger.info(
                f"Scanning blocks {from_block} to {current_block} for {wallet_address[:10]}..."
            )
            
            # Query ERC20 Transfer events where wallet is involved
            # Topics: [Transfer signature, from/to addresses]
            
            # Transfers FROM wallet
            logs_sent = await w3.eth.get_logs({
                'fromBlock': from_block,
                'toBlock': 'latest',
                'topics': [
                    ERC20_TRANSFER_TOPIC,
                    Web3.to_hex(int(checksum_address, 16).to_bytes(32, 'big'))  # from
                ]
            })
            
            # Transfers TO wallet
            logs_received = await w3.eth.get_logs({
                'fromBlock': from_block,
                'toBlock': 'latest',
                'topics': [
                    ERC20_TRANSFER_TOPIC,
                    None,  # any from
                    Web3.to_hex(int(checksum_address, 16).to_bytes(32, 'big'))  # to
                ]
            })
            
            # Extract unique token contracts
            token_contracts_sent = set(log['address'] for log in logs_sent)
            token_contracts_received = set(log['address'] for log in logs_received)
            all_token_contracts = token_contracts_sent | token_contracts_received
            
            # Get unique blocks for activity timeline
            active_blocks = set(
                log['blockNumber'] for log in (logs_sent + logs_received)
            )
            
            activity_data = {
                "blocks_scanned": blocks_to_scan,
                "from_block": from_block,
                "to_block": current_block,
                "erc20_transfers_sent": len(logs_sent),
                "erc20_transfers_received": len(logs_received),
                "unique_tokens": len(all_token_contracts),
                "unique_token_addresses": list(all_token_contracts),
                "active_blocks_count": len(active_blocks),
                "activity_detected": len(logs_sent) + len(logs_received) > 0
            }
            
            logger.info(
                f"Activity scan complete",
                extra={
                    "sent": len(logs_sent),
                    "received": len(logs_received),
                    "tokens": len(all_token_contracts)
                }
            )
            
            return activity_data
            
        except Exception as e:
            logger.error(f"Failed to scan blocks: {e}")
            return {
                "blocks_scanned": 0,
                "erc20_transfers_sent": 0,
                "erc20_transfers_received": 0,
                "unique_tokens": 0,
                "activity_detected": False
            }
    
    async def get_first_transaction_block(self, wallet_address: str) -> Optional[int]:
        """
        Find first transaction block using binary search on-chain
        
        This estimates wallet age without external APIs.
        Uses eth_getTransactionCount at different blocks.
        
        Args:
            wallet_address: Ethereum address
            
        Returns:
            Block number of first transaction (estimated)
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            current_block = await w3.eth.block_number
            
            # Quick check: any transactions at all?
            current_nonce = await w3.eth.get_transaction_count(checksum_address)
            if current_nonce == 0:
                return None
            
            # Binary search for first transaction
            # This is approximate but efficient
            left, right = 0, current_block
            first_active_block = current_block
            
            # Limit search iterations to avoid too many RPC calls
            max_iterations = 20
            iteration = 0
            
            while left < right and iteration < max_iterations:
                mid = (left + right) // 2
                
                try:
                    nonce_at_mid = await w3.eth.get_transaction_count(
                        checksum_address,
                        mid
                    )
                    
                    if nonce_at_mid == 0:
                        # No transactions before this block
                        left = mid + 1
                    else:
                        # Has transactions at this block
                        first_active_block = mid
                        right = mid - 1
                        
                except Exception:
                    # If block doesn't support historical queries, break
                    break
                
                iteration += 1
            
            logger.info(f"First transaction estimated at block: {first_active_block}")
            return first_active_block
            
        except Exception as e:
            logger.error(f"Failed to find first transaction block: {e}")
            return None
    
    async def estimate_wallet_age_days(self, first_block: Optional[int]) -> int:
        """
        Estimate wallet age from first transaction block
        
        Uses block timestamps to calculate age in days.
        
        Args:
            first_block: Block number of first transaction
            
        Returns:
            Age in days
        """
        if first_block is None:
            return 0
        
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            # Get first block timestamp
            first_block_data = await w3.eth.get_block(first_block)
            first_timestamp = first_block_data['timestamp']
            
            # Calculate age
            current_timestamp = datetime.utcnow().timestamp()
            age_seconds = current_timestamp - first_timestamp
            age_days = int(age_seconds / 86400)
            
            logger.info(f"Wallet age: {age_days} days")
            return age_days
            
        except Exception as e:
            logger.error(f"Failed to estimate wallet age: {e}")
            # Fallback: estimate from block number
            # Ethereum: ~13 seconds per block
            network_manager = await get_network_manager()
            w3 = await network_manager.get_async_web3("ethereum")
            current_block = await w3.eth.block_number
            blocks_elapsed = current_block - first_block
            age_days = int((blocks_elapsed * 13) / 86400)
            return age_days
    
    async def analyze_contract_interactions(
        self,
        wallet_address: str,
        sample_size: int = 10
    ) -> Dict[str, Any]:
        """
        Analyze recent contract interactions on-chain with DeFi detection
        
        Samples recent transactions to understand interaction patterns.
        Uses advanced DeFi protocol detection for accurate analysis.
        
        Args:
            wallet_address: Ethereum address
            sample_size: Number of recent transactions to analyze
            
        Returns:
            Dict with contract interaction metrics including DeFi analysis
        """
        network_manager = await get_network_manager()
        w3 = await network_manager.get_async_web3("ethereum")
        
        try:
            checksum_address = Web3.to_checksum_address(wallet_address)
            current_block = await w3.eth.block_number
            
            # Collect transactions for analysis
            transactions = []
            total_gas_used = 0
            
            # Sample recent blocks (increased from 100 to 200 for better sampling)
            blocks_to_check = 200
            max_tx_to_analyze = 100  # Limit to avoid too much processing
            
            logger.info(f"Scanning last {blocks_to_check} blocks for wallet interactions...")
            
            for block_num in range(current_block - blocks_to_check, current_block):
                if len(transactions) >= max_tx_to_analyze:
                    break
                    
                try:
                    block = await w3.eth.get_block(block_num, full_transactions=True)
                    
                    for tx in block['transactions']:
                        if tx['from'].lower() == wallet_address.lower():
                            # Store transaction for DeFi analysis
                            transactions.append({
                                'to': tx['to'].lower() if tx['to'] else None,
                                'input': tx['input'].hex() if isinstance(tx['input'], bytes) else tx['input'],
                                'value': tx['value'],
                                'hash': tx['hash'].hex() if isinstance(tx['hash'], bytes) else tx['hash']
                            })
                            
                            # Get gas used
                            try:
                                receipt = await w3.eth.get_transaction_receipt(tx['hash'])
                                total_gas_used += receipt['gasUsed']
                            except Exception:
                                pass
                            
                            if len(transactions) >= max_tx_to_analyze:
                                break
                    
                except Exception as e:
                    logger.debug(f"Failed to process block {block_num}: {e}")
                    continue
            
            # Use DeFi detector for advanced analysis
            defi_analysis = defi_detector.analyze_defi_usage(transactions)
            
            total_tx_found = len(transactions)
            avg_gas = total_gas_used / total_tx_found if total_tx_found > 0 else 0
            
            # Legacy metrics for backward compatibility
            contract_interactions = defi_analysis['defi_transactions']
            simple_transfers = defi_analysis['simple_transfers']
            contract_ratio = defi_analysis['defi_ratio']
            
            logger.info(
                f"Contract analysis complete: {total_tx_found} tx, "
                f"{defi_analysis['defi_transactions']} DeFi, "
                f"{defi_analysis['protocol_count']} protocols, "
                f"sophistication: {defi_analysis['sophistication_score']}"
            )
            
            return {
                # Legacy fields (for backward compatibility)
                "sample_size": total_tx_found,
                "contract_interactions": contract_interactions,
                "simple_transfers": simple_transfers,
                "contract_interaction_ratio": contract_ratio,
                "avg_gas_used": int(avg_gas),
                "is_contract_user": contract_ratio > 0.3,
                
                # Enhanced DeFi metrics
                "defi_transactions": defi_analysis['defi_transactions'],
                "defi_ratio": defi_analysis['defi_ratio'],
                "is_defi_user": defi_analysis['is_defi_user'],
                "protocols_used": defi_analysis['protocols_used'],
                "protocol_count": defi_analysis['protocol_count'],
                "defi_categories": defi_analysis['categories'],
                "sophistication_score": defi_analysis['sophistication_score'],
            }
            
        except Exception as e:
            logger.error(f"Failed to analyze contract interactions: {e}")
            return {
                "sample_size": 0,
                "contract_interactions": 0,
                "simple_transfers": 0,
                "contract_interaction_ratio": 0,
                "avg_gas_used": 0,
                "is_contract_user": False,
                "defi_transactions": 0,
                "defi_ratio": 0.0,
                "is_defi_user": False,
                "protocols_used": [],
                "protocol_count": 0,
                "defi_categories": {},
                "sophistication_score": "none",
            }
    
    async def get_wallet_activity_summary(
        self,
        wallet_address: str,
        network: str = "ethereum"
    ) -> Dict[str, Any]:
        """
        Get comprehensive wallet activity summary using on-chain data
        
        This is the main method called by risk analysis handler.
        Uses ONLY on-chain RPC queries - no external APIs.
        
        Args:
            wallet_address: Ethereum address
            network: Network name (default: ethereum)
            
        Returns:
            Dict with wallet metrics for risk calculation
        """
        logger.info(f"Analyzing wallet on-chain: {wallet_address[:10]}...")
        
        # OPTIMIZATION: Parallel fetching for better performance
        # Run independent blockchain queries concurrently
        import asyncio
        
        # Batch 1: Independent queries (parallel)
        tx_count_task = asyncio.create_task(self.get_transaction_count(wallet_address))
        balance_task = asyncio.create_task(self.get_balance(wallet_address))
        first_block_task = asyncio.create_task(self.get_first_transaction_block(wallet_address))
        
        # Wait for batch 1
        tx_count, balance_data, first_block = await asyncio.gather(
            tx_count_task,
            balance_task,
            first_block_task
        )
        
        # Batch 2: Queries that depend on batch 1 (parallel)
        wallet_age_task = asyncio.create_task(self.estimate_wallet_age_days(first_block))
        recent_activity_task = asyncio.create_task(
            self.scan_recent_blocks_for_activity(wallet_address, blocks_to_scan=200)  # Reduced from 1000 for speed
        )
        contract_analysis_task = asyncio.create_task(self.analyze_contract_interactions(wallet_address))
        
        # Wait for batch 2
        wallet_age_days, recent_activity, contract_analysis = await asyncio.gather(
            wallet_age_task,
            recent_activity_task,
            contract_analysis_task
        )
        
        # Calculate derived metrics
        tx_per_day = tx_count / wallet_age_days if wallet_age_days > 0 else 0
        
        # Estimate total value (not precise without full history, but we have balance)
        # For risk analysis, current balance + activity level is sufficient
        
        summary = {
            "wallet_address": wallet_address,
            "network": network,
            
            # Core metrics
            "total_transactions": tx_count,
            "wallet_age_days": wallet_age_days,
            "current_balance_eth": balance_data["balance_eth"],
            
            # Activity metrics
            "tx_per_day": tx_per_day,
            "is_active": tx_count > 0,
            
            # Token activity (from log scanning)
            "unique_tokens": recent_activity["unique_tokens"],
            "erc20_transfers_sent": recent_activity["erc20_transfers_sent"],
            "erc20_transfers_received": recent_activity["erc20_transfers_received"],
            
            # Contract interaction (legacy - for backward compatibility)
            "unique_contracts": len(recent_activity.get("unique_token_addresses", [])),
            "contract_interaction_ratio": contract_analysis["contract_interaction_ratio"],
            "is_contract_user": contract_analysis["is_contract_user"],
            "avg_gas_used": contract_analysis["avg_gas_used"],
            
            # Enhanced DeFi metrics
            "defi_transactions": contract_analysis.get("defi_transactions", 0),
            "defi_ratio": contract_analysis.get("defi_ratio", 0.0),
            "is_defi_user": contract_analysis.get("is_defi_user", False),
            "defi_protocols_used": contract_analysis.get("protocols_used", []),
            "defi_protocol_count": contract_analysis.get("protocol_count", 0),
            "defi_categories": contract_analysis.get("defi_categories", {}),
            "defi_sophistication": contract_analysis.get("sophistication_score", "none"),
            
            # Metadata
            "first_block": first_block,
            "data_source": "on-chain-rpc",
            "activity_detected": recent_activity["activity_detected"]
        }
        
        logger.info(
            f"On-chain analysis complete",
            extra={
                "wallet": wallet_address[:10] + "...",
                "tx_count": tx_count,
                "age_days": wallet_age_days,
                "tokens": recent_activity["unique_tokens"]
            }
        )
        
        return summary
