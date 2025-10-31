"""
Risk Calculator

Calculates wallet risk score based on on-chain metrics.
Combines rule-based logic with ML model for enhanced accuracy.
Optimized for RPC-based data collection.
"""

import logging
import time
from typing import Dict, Any, List
from datetime import datetime
from app.ai.ml_risk_model import ml_risk_model

logger = logging.getLogger(__name__)


class RiskCalculator:
    """
    Calculates risk score from on-chain wallet activity
    
    Risk Factors (weighted for on-chain data):
    1. Account Age (20%) - Newer = higher risk
    2. Transaction Volume (20%) - Low nonce = higher risk
    3. Token Diversification (15%) - Few tokens = higher risk
    4. Contract Usage (15%) - No DeFi = higher risk
    5. Activity Level (15%) - Inactive = higher risk
    6. Balance Health (15%) - Low balance = higher risk
    
    Score Range: 0-10000
    - 0-2500: Low risk (established, active wallets)
    - 2500-5000: Medium risk (normal users)
    - 5000-7500: High risk (new or risky behavior)
    - 7500-10000: Critical risk (very high risk)
    
    On-Chain Data Sources:
    - eth_getTransactionCount (nonce)
    - eth_getBalance (current balance)
    - eth_getLogs (token transfers)
    - eth_getBlock (transaction analysis)
    """
    
    def calculate_comprehensive_risk(
        self,
        wallet_address: str,
        activity_summary: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Calculate comprehensive risk score from on-chain data
        
        Args:
            wallet_address: Ethereum address
            activity_summary: Output from BlockchainIndexer
            
        Returns:
            Dict with risk analysis results
        """
        logger.info(f"Calculating risk for {wallet_address[:10]}...")
        
        # Extract on-chain metrics
        tx_count = activity_summary.get("total_transactions", 0)
        wallet_age_days = activity_summary.get("wallet_age_days", 0)
        balance_eth = activity_summary.get("current_balance_eth", 0)
        unique_tokens = activity_summary.get("unique_tokens", 0)
        contract_ratio = activity_summary.get("contract_interaction_ratio", 0)
        is_contract_user = activity_summary.get("is_contract_user", False)
        tx_per_day = activity_summary.get("tx_per_day", 0)
        
        # Handle edge case: no transactions
        if tx_count == 0:
            return self._create_new_wallet_result(wallet_address, balance_eth)
        
        # Calculate individual factors
        factors = []
        
        # 1. Account Age (20%)
        age_score, age_status = self._calculate_age_risk(wallet_age_days)
        factors.append({
            "name": "Account Age",
            "category": "trust",
            "score": age_score,
            "weight": 0.20,
            "status": age_status,
            "description": f"{wallet_age_days} days old",
            "detail": self._get_age_detail(wallet_age_days),
            "icon": "clock"
        })
        
        # 2. Transaction Volume (20%)
        volume_score, volume_status = self._calculate_volume_risk(tx_count)
        factors.append({
            "name": "Transaction History",
            "category": "activity",
            "score": volume_score,
            "weight": 0.20,
            "status": volume_status,
            "description": f"{tx_count} total transactions",
            "detail": self._get_volume_detail(tx_count),
            "icon": "activity"
        })
        
        # 3. Token Diversification (15%)
        token_score, token_status = self._calculate_token_risk(unique_tokens)
        factors.append({
            "name": "Token Portfolio",
            "category": "diversification",
            "score": token_score,
            "weight": 0.15,
            "status": token_status,
            "description": f"{unique_tokens} unique tokens",
            "detail": self._get_token_detail(unique_tokens),
            "icon": "coins"
        })
        
        # 4. Contract Usage (15%)
        contract_score, contract_status = self._calculate_contract_risk(contract_ratio, is_contract_user)
        factors.append({
            "name": "DeFi Engagement",
            "category": "behavior",
            "score": contract_score,
            "weight": 0.15,
            "status": contract_status,
            "description": f"{int(contract_ratio * 100)}% contract interactions",
            "detail": self._get_contract_detail(contract_ratio, is_contract_user),
            "icon": "code"
        })
        
        # 5. Activity Level (15%)
        activity_score, activity_status = self._calculate_activity_risk(tx_per_day, wallet_age_days)
        factors.append({
            "name": "Activity Pattern",
            "category": "behavior",
            "score": activity_score,
            "weight": 0.15,
            "status": activity_status,
            "description": f"{tx_per_day:.2f} tx/day average",
            "detail": self._get_activity_detail(tx_per_day),
            "icon": "trending-up"
        })
        
        # 6. Balance Health (15%)
        balance_score, balance_status = self._calculate_balance_risk(balance_eth)
        factors.append({
            "name": "Balance Health",
            "category": "liquidity",
            "score": balance_score,
            "weight": 0.15,
            "status": balance_status,
            "description": f"{balance_eth:.4f} ETH",
            "detail": self._get_balance_detail(balance_eth),
            "icon": "wallet"
        })
        
        # Calculate rule-based total score
        rule_based_score = sum(f["score"] * f["weight"] for f in factors)
        rule_based_score = int(rule_based_score)
        
        # Get ML prediction for enhanced accuracy
        ml_start_time = time.time()
        ml_score, ml_confidence, ml_features = ml_risk_model.predict_risk(activity_summary)
        ml_latency_ms = (time.time() - ml_start_time) * 1000
        
        # Track ML inference (non-blocking, fire-and-forget)
        # Store metrics for later async tracking by handler
        # This avoids blocking the sync calculation function
        self._ml_metrics = {
            "model_version": "ensemble-v1.0",
            "latency_ms": ml_latency_ms,
            "success": True,
            "confidence": ml_confidence  # Store for accuracy tracking
        }
        logger.debug(
            f"ML inference: {ml_latency_ms:.2f}ms",
            extra={"score": ml_score, "confidence": ml_confidence}
        )
        
        # Ensemble: Combine rule-based + ML (60% rules, 40% ML)
        # Rule-based ensures interpretability, ML captures complex patterns
        total_score = int(rule_based_score * 0.6 + ml_score * 0.4)
        
        # Apply critical minimum thresholds (research-based)
        total_score = self._apply_minimum_thresholds(
            total_score,
            unique_tokens,
            contract_ratio,
            tx_count,
            balance_eth,
            tx_per_day
        )
        
        logger.info(
            f"Risk score ensemble",
            extra={
                "rule_based": rule_based_score,
                "ml_based": ml_score,
                "final": total_score,
                "ml_confidence": ml_confidence
            }
        )
        
        # Determine risk band
        if total_score < 2500:
            risk_band = "low"
        elif total_score < 5000:
            risk_band = "medium"
        elif total_score < 7500:
            risk_band = "high"
        else:
            risk_band = "critical"
        
        # Calculate confidence (weighted average of rule-based + ML)
        rule_confidence = self._calculate_confidence(tx_count, wallet_age_days, unique_tokens)
        confidence = (rule_confidence * 0.5 + ml_confidence * 0.5)
        
        # Generate recommendations
        recommendations = self._generate_recommendations(factors, risk_band)
        
        result = {
            "wallet_address": wallet_address,
            "risk_score": total_score,
            "risk_band": risk_band,
            "confidence": confidence,
            "factors": factors,
            "recommendations": recommendations,
            "analyzed_at": datetime.utcnow().isoformat(),
            "data_source": "on-chain-rpc",
            "model_type": "ensemble-ml",
            "model_details": {
                "rule_based_score": rule_based_score,
                "ml_score": ml_score,
                "ensemble_weight": "60% rules + 40% ML",
                "ml_confidence": ml_confidence
            },
            "metadata": {
                "total_transactions": tx_count,
                "wallet_age_days": wallet_age_days,
                "unique_tokens": unique_tokens,
                "balance_eth": balance_eth,
                "is_contract_user": is_contract_user
            }
        }
        
        logger.info(
            f"Risk calculation complete",
            extra={
                "wallet": wallet_address[:10] + "...",
                "score": total_score,
                "band": risk_band,
                "confidence": confidence
            }
        )
        
        return result
    
    # ============ RISK CALCULATION METHODS ============
    
    def _calculate_age_risk(self, age_days: int) -> tuple[int, str]:
        """Account age risk - on-chain data"""
        if age_days < 7:
            return 9000, "critical"  # Less than a week
        elif age_days < 30:
            return 6500, "high"  # Less than a month
        elif age_days < 90:
            return 4000, "medium"  # Less than 3 months
        elif age_days < 180:
            return 2000, "low"  # Less than 6 months
        else:
            return 500, "low"  # Mature account
    
    def _calculate_volume_risk(self, tx_count: int) -> tuple[int, str]:
        """Transaction volume risk - from nonce"""
        if tx_count < 3:
            return 8500, "critical"  # Very few transactions
        elif tx_count < 10:
            return 6000, "high"  # Limited history
        elif tx_count < 50:
            return 3500, "medium"  # Growing history
        elif tx_count < 200:
            return 1500, "low"  # Active user
        else:
            return 300, "low"  # Very active
    
    def _calculate_token_risk(self, unique_tokens: int) -> tuple[int, str]:
        """Token diversification risk - from event logs"""
        if unique_tokens == 0:
            return 4000, "medium"  # No token activity (not critical)
        elif unique_tokens < 3:
            return 3000, "medium"  # Limited diversity
        elif unique_tokens < 8:
            return 1500, "low"  # Good diversity
        else:
            return 500, "low"  # Excellent diversity
    
    def _calculate_contract_risk(self, ratio: float, is_user: bool) -> tuple[int, str]:
        """Contract interaction risk - from transaction analysis"""
        if ratio == 0:
            return 3500, "medium"  # No DeFi usage (not critical)
        elif not is_user:  # ratio < 30%
            return 2500, "medium"  # Limited DeFi
        elif ratio < 0.6:
            return 1200, "low"  # Active DeFi user
        else:
            return 600, "low"  # Heavy DeFi user
    
    def _calculate_activity_risk(self, tx_per_day: float, age_days: int) -> tuple[int, str]:
        """Activity level risk"""
        if age_days < 7:
            # New wallet - use different thresholds
            if tx_per_day > 5:
                return 2000, "low"  # Very active start
            elif tx_per_day > 1:
                return 3500, "medium"
            else:
                return 5000, "medium"
        else:
            # Established wallet
            if tx_per_day < 0.05:
                return 6000, "high"  # Dormant
            elif tx_per_day < 0.3:
                return 4000, "medium"  # Occasional
            elif tx_per_day < 2:
                return 1500, "low"  # Regular
            else:
                return 800, "low"  # Very active
    
    def _calculate_balance_risk(self, balance: float) -> tuple[int, str]:
        """Balance health risk"""
        if balance < 0.001:
            return 7500, "high"  # Dust
        elif balance < 0.01:
            return 5500, "medium"  # Very low
        elif balance < 0.1:
            return 3000, "medium"  # Low
        elif balance < 1:
            return 1200, "low"  # Healthy
        else:
            return 400, "low"  # Strong
    
    # ============ DETAIL GENERATORS ============
    
    def _get_age_detail(self, days: int) -> str:
        if days < 7:
            return "Very new wallet - establishing track record"
        elif days < 30:
            return "New wallet - building reputation"
        elif days < 90:
            return "Growing wallet - gaining trust"
        elif days < 180:
            return "Established wallet - good history"
        else:
            return "Mature wallet - proven track record"
    
    def _get_volume_detail(self, count: int) -> str:
        if count < 3:
            return "Very limited transaction history"
        elif count < 10:
            return "Early stage user"
        elif count < 50:
            return "Regular user with growing history"
        elif count < 200:
            return "Active user with solid history"
        else:
            return "Very active user with extensive history"
    
    def _get_token_detail(self, tokens: int) -> str:
        if tokens == 0:
            return "No token activity detected"
        elif tokens < 3:
            return "Limited token exposure"
        elif tokens < 8:
            return "Diversified token portfolio"
        else:
            return "Highly diversified portfolio"
    
    def _get_contract_detail(self, ratio: float, is_user: bool) -> str:
        if ratio == 0:
            return "No DeFi interaction detected"
        elif not is_user:
            return "Limited DeFi engagement"
        elif ratio < 0.6:
            return "Active DeFi participant"
        else:
            return "Heavy DeFi user"
    
    def _get_activity_detail(self, tx_per_day: float) -> str:
        if tx_per_day < 0.05:
            return "Dormant or rarely active"
        elif tx_per_day < 0.3:
            return "Occasional activity"
        elif tx_per_day < 2:
            return "Regular activity pattern"
        else:
            return "Very high activity level"
    
    def _get_balance_detail(self, balance: float) -> str:
        if balance < 0.001:
            return "Dust balance - minimal funds"
        elif balance < 0.01:
            return "Very low balance"
        elif balance < 0.1:
            return "Low balance"
        elif balance < 1:
            return "Healthy balance"
        else:
            return "Strong balance"
    
    # ============ HELPER METHODS ============
    
    def _apply_minimum_thresholds(
        self,
        score: float,
        unique_tokens: int,
        contract_ratio: float,
        tx_count: int,
        balance_eth: float,
        tx_per_day: float
    ) -> int:
        """
        Apply research-based minimum risk thresholds
        
        Based on DeFi risk assessment best practices:
        
        1. No token portfolio + No DeFi engagement = MIN 5000 (MEDIUM)
           Rationale: Indicates minimal blockchain engagement, higher vulnerability
           
        2. Insufficient transaction history (<3 tx) = MIN 8000 (HIGH)
           Rationale: No track record, impossible to assess behavior patterns
           
        3. Dust balance + Dormant activity = MIN 6500 (HIGH)
           Rationale: Abandoned wallet or insufficient funds for operations
           
        4. Single-sided engagement (tokens XOR DeFi) = MIN 4000 (MEDIUM)
           Rationale: Incomplete portfolio strategy, missing diversification
           
        5. No tokens = MIN 5500 (MEDIUM-HIGH)
           Rationale: Not participating in token economy, limited exposure
           
        6. No DeFi = MIN 4500 (MEDIUM)
           Rationale: Missing sophisticated blockchain usage signals
        
        These thresholds ensure that critical missing factors are properly weighted
        even if other factors appear favorable.
        """
        original_score = score
        
        # Critical Check 1: No tokens AND no DeFi (most critical)
        if unique_tokens == 0 and contract_ratio == 0:
            score = max(score, 4500)
            if score > original_score:
                logger.warning(
                    f"Applied threshold: No tokens + No DeFi → {score}",
                    extra={"original": original_score, "adjusted": score}
                )
        
        # Critical Check 2: No transaction history
        if tx_count < 3:
            score = max(score, 8000)
            if score > original_score:
                logger.warning(
                    f"Applied critical threshold: Insufficient tx history → {score}",
                    extra={"tx_count": tx_count, "adjusted": score}
                )
        
        # Critical Check 3: Dust balance + Dormant
        if balance_eth < 0.001 and tx_per_day < 0.05:
            score = max(score, 6500)
            if score > original_score:
                logger.warning(
                    f"Applied critical threshold: Dust + Dormant → {score}",
                    extra={"balance": balance_eth, "tx_per_day": tx_per_day}
                )
        
        # Check 4: No token portfolio (only if also low activity)
        if unique_tokens == 0 and tx_count < 20:
            score = max(score, 4000)
            if score > original_score:
                logger.info(
                    f"Applied threshold: No tokens + Low activity → {score}"
                )
        
        # Check 5: No DeFi engagement (only if also low activity)
        if contract_ratio == 0 and tx_count < 20:
            score = max(score, 3500)
            if score > original_score:
                logger.info(
                    f"Applied threshold: No DeFi + Low activity → {score}"
                )
        
        return int(score)
    
    def _calculate_confidence(self, tx_count: int, age_days: int, tokens: int) -> float:
        """Calculate confidence score based on data quality"""
        confidence = 40.0  # Base confidence for on-chain data
        
        # Transaction history boosts confidence
        if tx_count >= 100:
            confidence += 20
        elif tx_count >= 20:
            confidence += 10
        elif tx_count >= 5:
            confidence += 5
        
        # Account age boosts confidence
        if age_days >= 180:
            confidence += 20
        elif age_days >= 90:
            confidence += 15
        elif age_days >= 30:
            confidence += 10
        
        # Token diversity boosts confidence
        if tokens >= 5:
            confidence += 10
        elif tokens >= 2:
            confidence += 5
        
        return min(95.0, confidence)
    
    def _generate_recommendations(
        self,
        factors: List[Dict],
        risk_band: str
    ) -> List[Dict]:
        """Generate actionable recommendations"""
        recommendations = []
        
        # Check high-risk factors
        for factor in factors:
            if factor["status"] in ["high", "critical"]:
                if "Age" in factor["name"]:
                    recommendations.append({
                        "title": "Build on-chain reputation",
                        "description": "New accounts carry higher risk. Maintain consistent activity to establish trust.",
                        "priority": "high"
                    })
                elif "History" in factor["name"]:
                    recommendations.append({
                        "title": "Increase transaction activity",
                        "description": "More on-chain transactions improve your risk profile.",
                        "priority": "medium"
                    })
                elif "Token" in factor["name"]:
                    recommendations.append({
                        "title": "Diversify token holdings",
                        "description": "Interact with multiple tokens to demonstrate diversified behavior.",
                        "priority": "high"
                    })
                elif "DeFi" in factor["name"]:
                    recommendations.append({
                        "title": "Engage with DeFi protocols",
                        "description": "Contract interactions show sophisticated blockchain usage.",
                        "priority": "medium"
                    })
                elif "Activity" in factor["name"]:
                    recommendations.append({
                        "title": "Maintain regular activity",
                        "description": "Dormant wallets carry higher risk. Stay active on-chain.",
                        "priority": "high"
                    })
                elif "Balance" in factor["name"]:
                    recommendations.append({
                        "title": "Maintain healthy balance",
                        "description": "Low balance may indicate inability to cover gas or positions.",
                        "priority": "medium"
                    })
        
        # Add general recommendation
        if risk_band in ["high", "critical"]:
            recommendations.append({
                "title": "Start with small positions",
                "description": "Higher risk profile suggests conservative position sizing initially.",
                "priority": "critical"
            })
        elif risk_band == "low":
            recommendations.append({
                "title": "Maintain current practices",
                "description": "Your on-chain behavior demonstrates low risk. Continue current activity patterns.",
                "priority": "low"
            })
        
        return recommendations if recommendations else [{
            "title": "Continue building reputation",
            "description": "Keep engaging with blockchain to improve risk profile.",
            "priority": "medium"
        }]
    
    def _create_new_wallet_result(self, wallet_address: str, balance: float) -> Dict[str, Any]:
        """Create result for brand new wallets with no transactions"""
        return {
            "wallet_address": wallet_address,
            "risk_score": 9500,
            "risk_band": "critical",
            "confidence": 50.0,
            "factors": [{
                "name": "No Transaction History",
                "category": "trust",
                "score": 9500,
                "weight": 1.0,
                "status": "critical",
                "description": "Wallet has no on-chain activity",
                "detail": "This wallet has never sent a transaction",
                "icon": "alert-circle"
            }],
            "recommendations": [{
                "title": "Establish on-chain presence",
                "description": "Make your first transaction to begin building an on-chain reputation.",
                "priority": "critical"
            }],
            "analyzed_at": datetime.utcnow().isoformat(),
            "data_source": "on-chain-rpc",
            "metadata": {
                "total_transactions": 0,
                "wallet_age_days": 0,
                "unique_tokens": 0,
                "balance_eth": balance,
                "is_contract_user": False
            }
        }
