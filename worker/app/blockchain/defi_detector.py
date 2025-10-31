"""
DeFi Protocol Detector

Comprehensive detection of DeFi contract interactions.
Maintains a curated list of known DeFi protocols and patterns.
"""

import logging
from typing import Set, Dict, Any
from web3 import Web3

logger = logging.getLogger(__name__)


# Known DeFi Protocol Addresses (Ethereum Mainnet)
# Updated: 2025-10-03
DEFI_PROTOCOLS = {
    # DEXes (Decentralized Exchanges)
    "uniswap_v2": {
        "0x7a250d5630b4cf539739df2c5dacb4c659f2488d",  # UniswapV2 Router
        "0x5c69bee701ef814a2b6a3edd4b1652cb9cc5aa6f",  # UniswapV2 Factory
    },
    "uniswap_v3": {
        "0xe592427a0aece92de3edee1f18e0157c05861564",  # SwapRouter
        "0x1f98431c8ad98523631ae4a59f267346ea31f984",  # UniswapV3 Factory
        "0xc36442b4a4522e871399cd717abdd847ab11fe88",  # NonfungiblePositionManager
    },
    "sushiswap": {
        "0xd9e1ce17f2641f24ae83637ab66a2cca9c378b9f",  # SushiSwap Router
        "0xc0aee478e3658e2610c5f7a4a2e1777ce9e4f2ac",  # SushiSwap Factory
    },
    "curve": {
        "0x99a58482bd75cbab83b27ec03ca68ff489b5788f",  # Curve Registry
        "0xd51a44d3fae010294c616388b506acda1bfaae46",  # Curve Tricrypto
        "0xbebc44782c7db0a1a60cb6fe97d0b483032ff1c7",  # Curve 3pool
    },
    "balancer": {
        "0xba12222222228d8ba445958a75a0704d566bf2c8",  # Balancer Vault
    },
    "1inch": {
        "0x1111111254eeb25477b68fb85ed929f73a960582",  # 1inch V5 Router
        "0x111111125421ca6dc452d289314280a0f8842a65",  # 1inch V4 Router
    },
    
    # Lending Protocols
    "aave_v2": {
        "0x7d2768de32b0b80b7a3454c06bdac94a69ddc7a9",  # LendingPool
        "0xb53c1a33016b2dc2ff3653530bff1848a515c8c5",  # LendingPoolAddressesProvider
    },
    "aave_v3": {
        "0x87870bca3f3fd6335c3f4ce8392d69350b4fa4e2",  # Pool
        "0x2f39d218133afab8f2b819b1066c7e434ad94e9e",  # PoolAddressesProvider
    },
    "compound_v2": {
        "0x3d9819210a31b4961b30ef54be2aed79b9c9cd3b",  # Comptroller
        "0xc00e94cb662c3520282e6f5717214004a7f26888",  # COMP token
    },
    "compound_v3": {
        "0xc3d688b66703497daa19211eedff47f25384cdc3",  # cUSDCv3
    },
    "maker": {
        "0x5ef30b9986345249bc32d8928b7ee64de9435e39",  # CDP Manager
        "0x9759a6ac90977b93b58547b4a71c78317f391a28",  # DAI Join
    },
    
    # Liquid Staking
    "lido": {
        "0xae7ab96520de3a18e5e111b5eaab095312d7fe84",  # stETH
        "0xdc24316b9ae028f1497c275eb9192a3ea0f67022",  # stETH Curve Pool
    },
    "rocket_pool": {
        "0xae78736cd615f374d3085123a210448e74fc6393",  # rETH
        "0x2cac916b2a963bf162f076c0a8a4a8200bcfbfb4",  # Deposit Pool
    },
    
    # Derivatives & Options
    "synthetix": {
        "0xc011a73ee8576fb46f5e1c5751ca3b9fe0af2a6f",  # SNX token
        "0x8700daec35af8ff88c16bdf0418774cb3d7599b4",  # Synthetix Proxy
    },
    "gmx": {
        "0xfc5a1a6eb076a2c7ad06ed22c90d7e710e35ad0a",  # GMX token
    },
    
    # Aggregators
    "cowswap": {
        "0x9008d19f58aabd9ed0d60971565aa8510560ab41",  # GPv2Settlement
    },
    "paraswap": {
        "0xdef171fe48cf0115b1d80b88dc8eab59176fee57",  # AugustusSwapper
    },
    
    # NFT Marketplaces (DeFi component)
    "opensea": {
        "0x00000000000000adc04c56bf30ac9d3c0aaf14dc",  # Seaport 1.5
        "0x00000000000001ad428e4906ae43d8f9852d0dd6",  # Seaport 1.6
    },
    "blur": {
        "0x000000000000ad05ccc4f10045630fb830b95127",  # Blur Marketplace
    },
    
    # Yield Aggregators
    "yearn": {
        "0x0bc529c00c6401aef6d220be8c6ea1667f6ad93e",  # YFI token
        "0xba2e7fed597fd0e3e70f5130bcdbbfe06bb94fe1",  # YearnRegistry
    },
    "convex": {
        "0x4e3fbd56cd56c3e72c1403e103b45db9da5b9d2b",  # CVX token
        "0xf403c135812408bfbe8713b5a23a04b3d48aae31",  # Booster
    },
}

# Function signature patterns for DeFi operations
DEFI_FUNCTION_SIGNATURES = {
    # Swap/Trade
    "0x38ed1739": "swapExactTokensForTokens",  # Uniswap V2
    "0x7ff36ab5": "swapExactETHForTokens",
    "0x18cbafe5": "swapExactTokensForETH",
    "0x5c11d795": "swapExactTokensForTokensSupportingFeeOnTransferTokens",
    "0xc04b8d59": "exactInput",  # Uniswap V3
    "0x414bf389": "exactInputSingle",
    "0xdb3e2198": "exactOutput",
    "0x5023b4df": "exactOutputSingle",
    
    # Lending
    "0xe8eda9df": "deposit",  # Aave
    "0x69328dec": "withdraw",
    "0xa415bcad": "borrow",
    "0x573ade81": "repay",
    "0xa0712d68": "mint",  # Compound
    "0xdb006a75": "redeem",
    
    # Liquidity
    "0xe8e33700": "addLiquidity",
    "0xf305d719": "addLiquidityETH",
    "0xbaa2abde": "removeLiquidity",
    "0x02751cec": "removeLiquidityETH",
    "0x88316456": "increaseLiquidity",  # Uniswap V3 positions
    "0x0c49ccbe": "decreaseLiquidity",
    
    # Staking
    "0xa694fc3a": "stake",
    "0x2e1a7d4d": "withdraw",
    "0x3ccfd60b": "claim",
    "0xe2bbb158": "deposit",  # Staking pools
    
    # Governance
    "0x15373e3d": "delegate",
    "0x5c19a95c": "delegateBySig",
}

# ERC20 token contract patterns (basic DeFi)
ERC20_SIGNATURES = {
    "0xa9059cbb": "transfer",
    "0x23b872dd": "transferFrom",
    "0x095ea7b3": "approve",
}


class DeFiDetector:
    """
    Advanced DeFi protocol detector
    
    Detection Methods:
    1. Known protocol address matching (high confidence)
    2. Function signature analysis (medium confidence)
    3. Gas usage patterns (low confidence)
    4. ERC20 interactions (basic DeFi)
    """
    
    def __init__(self):
        # Flatten all protocol addresses
        self.known_defi_addresses: Set[str] = set()
        for protocol, addresses in DEFI_PROTOCOLS.items():
            for addr in addresses:
                self.known_defi_addresses.add(addr.lower())
        
        logger.info(f"DeFi Detector initialized with {len(self.known_defi_addresses)} known protocols")
    
    def is_defi_contract(self, contract_address: str, tx_input: str = None) -> Dict[str, Any]:
        """
        Detect if a contract is a DeFi protocol
        
        Args:
            contract_address: Contract address to check
            tx_input: Transaction input data (optional)
            
        Returns:
            Dict with detection results
        """
        contract_address = contract_address.lower()
        
        # Method 1: Known protocol address (HIGH confidence)
        if contract_address in self.known_defi_addresses:
            protocol_name = self._identify_protocol(contract_address)
            return {
                "is_defi": True,
                "confidence": "high",
                "detection_method": "known_protocol",
                "protocol_name": protocol_name,
                "category": self._get_protocol_category(protocol_name)
            }
        
        # Method 2: Function signature analysis (MEDIUM confidence)
        if tx_input and len(tx_input) >= 10:
            func_sig = tx_input[:10].lower()
            
            # Check DeFi function signatures
            if func_sig in DEFI_FUNCTION_SIGNATURES:
                return {
                    "is_defi": True,
                    "confidence": "medium",
                    "detection_method": "function_signature",
                    "function_name": DEFI_FUNCTION_SIGNATURES[func_sig],
                    "category": self._categorize_function(DEFI_FUNCTION_SIGNATURES[func_sig])
                }
            
            # Check ERC20 interactions (basic DeFi)
            if func_sig in ERC20_SIGNATURES:
                return {
                    "is_defi": True,
                    "confidence": "low",
                    "detection_method": "erc20_interaction",
                    "function_name": ERC20_SIGNATURES[func_sig],
                    "category": "token_transfer"
                }
        
        # Method 3: Has input data = likely contract interaction
        if tx_input and tx_input != '0x':
            return {
                "is_defi": True,
                "confidence": "low",
                "detection_method": "has_input_data",
                "category": "generic_contract"
            }
        
        # Not a DeFi interaction
        return {
            "is_defi": False,
            "confidence": "high",
            "detection_method": "no_match",
            "category": "simple_transfer"
        }
    
    def _identify_protocol(self, address: str) -> str:
        """Identify which protocol an address belongs to"""
        address = address.lower()
        for protocol, addresses in DEFI_PROTOCOLS.items():
            if address in {a.lower() for a in addresses}:
                return protocol
        return "unknown"
    
    def _get_protocol_category(self, protocol_name: str) -> str:
        """Get category of a protocol"""
        if any(x in protocol_name for x in ["uniswap", "sushiswap", "curve", "balancer", "1inch", "cowswap", "paraswap"]):
            return "dex"
        elif any(x in protocol_name for x in ["aave", "compound", "maker"]):
            return "lending"
        elif any(x in protocol_name for x in ["lido", "rocket_pool"]):
            return "liquid_staking"
        elif any(x in protocol_name for x in ["yearn", "convex"]):
            return "yield"
        elif any(x in protocol_name for x in ["opensea", "blur"]):
            return "nft"
        else:
            return "other_defi"
    
    def _categorize_function(self, function_name: str) -> str:
        """Categorize a function by its operation type"""
        func_lower = function_name.lower()
        if "swap" in func_lower or "trade" in func_lower:
            return "dex"
        elif "lend" in func_lower or "borrow" in func_lower or "deposit" in func_lower or "withdraw" in func_lower:
            return "lending"
        elif "liquidity" in func_lower:
            return "liquidity"
        elif "stake" in func_lower:
            return "staking"
        else:
            return "other_defi"
    
    def analyze_defi_usage(self, transactions: list) -> Dict[str, Any]:
        """
        Analyze DeFi usage from a list of transactions
        
        Args:
            transactions: List of transaction dicts with 'to' and 'input' fields
            
        Returns:
            Dict with comprehensive DeFi analysis
        """
        total_tx = len(transactions)
        if total_tx == 0:
            return {
                "total_transactions": 0,
                "defi_transactions": 0,
                "defi_ratio": 0.0,
                "is_defi_user": False,
                "protocols_used": [],
                "categories": {}
            }
        
        defi_tx_count = 0
        protocols_used = set()
        categories = {}
        
        for tx in transactions:
            if not tx.get('to'):
                continue
            
            detection = self.is_defi_contract(
                tx['to'],
                tx.get('input', '0x')
            )
            
            if detection['is_defi']:
                defi_tx_count += 1
                
                # Track protocol
                if 'protocol_name' in detection:
                    protocols_used.add(detection['protocol_name'])
                
                # Track category
                category = detection.get('category', 'unknown')
                categories[category] = categories.get(category, 0) + 1
        
        defi_ratio = defi_tx_count / total_tx
        
        return {
            "total_transactions": total_tx,
            "defi_transactions": defi_tx_count,
            "simple_transfers": total_tx - defi_tx_count,
            "defi_ratio": round(defi_ratio, 3),
            "is_defi_user": defi_ratio > 0.3,  # 30% threshold
            "protocols_used": list(protocols_used),
            "protocol_count": len(protocols_used),
            "categories": categories,
            "sophistication_score": self._calculate_sophistication(defi_ratio, len(protocols_used), categories)
        }
    
    def _calculate_sophistication(self, defi_ratio: float, protocol_count: int, categories: dict) -> str:
        """
        Calculate user sophistication level
        
        Returns: beginner, intermediate, advanced, expert
        """
        category_count = len(categories)
        
        if defi_ratio > 0.7 and protocol_count >= 5 and category_count >= 3:
            return "expert"  # Heavy DeFi user across multiple categories
        elif defi_ratio > 0.5 and protocol_count >= 3:
            return "advanced"  # Active DeFi user
        elif defi_ratio > 0.2 and protocol_count >= 1:
            return "intermediate"  # Regular DeFi user
        elif defi_ratio > 0:
            return "beginner"  # Some DeFi exposure
        else:
            return "none"  # No DeFi usage


# Global instance
defi_detector = DeFiDetector()
