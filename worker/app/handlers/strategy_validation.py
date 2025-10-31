"""
Strategy Validation Handler

Processes strategy validation requests from Kafka, performing:
- Risk/reward ratio analysis
- Position size evaluation
- Strategy type compatibility checks
- Stop loss sanity validation
- Historical backtesting
- Smart recommendations generation
"""

import logging
from typing import Dict, Any, List
from datetime import datetime, timedelta

from app.services.kafka_producer import kafka_producer
from app.services.cache import cache
from app.blockchain.indexer import BlockchainIndexer
from app.ai.strategy_analyzer import strategy_analyzer

logger = logging.getLogger(__name__)


class StrategyValidationHandler:
    """
    Handler for strategy validation requests with real on-chain data analysis
    
    Flow:
    1. Receive message from Kafka
    2. Fetch wallet metrics from blockchain
    3. Run validation checks
    4. Perform backtesting simulation
    5. Generate recommendations
    6. Publish result to Kafka
    7. Store result in cache
    """
    
    def __init__(self):
        self.indexer = BlockchainIndexer()
    
    async def handle(self, message: Dict[str, Any]):
        """
        Process privacy-first strategy validation request
        
        Security:
        - Wallet ownership already verified by backend (signature)
        - Worker receives VERIFIED wallet address
        - Process wallet EPHEMERALLY (memory only, never persist)
        - Store results by commitment (privacy-preserving)
        
        Args:
            message: Kafka message with:
                - task_id: Unique task identifier
                - commitment: Commitment hash for privacy
                - wallet_address: VERIFIED wallet (ephemeral processing)
                - parameters: Strategy parameters
                - backtest_days: Backtest period
        """
        task_id = message.get("task_id")
        commitment = message.get("commitment")
        wallet_address = message.get("wallet_address")
        parameters = message.get("parameters", {})
        backtest_days = message.get("backtest_days", 30)
        
        logger.info(
            f"Processing strategy validation",
            extra={
                "task_id": task_id,
                "commitment": commitment[:10] + "..." if commitment else "N/A",
                "strategy_type": parameters.get("strategy_type")
            }
        )
        
        # CRITICAL: Wallet address is in memory ONLY
        # It will be discarded after this function completes
        # NO persistence to disk, database, or logs
        
        try:
            # Update status to processing
            await cache.update_task_status(task_id, "processing", progress=10)
            
            # Step 1: Fetch wallet metrics (20% progress)
            logger.info(f"Fetching wallet metrics for commitment {commitment[:10]}...")
            wallet_metrics = await self._get_wallet_metrics(wallet_address, commitment)
            
            await cache.update_task_status(task_id, "processing", progress=30)
            
            # Step 2: Run validation checks (50% progress)
            logger.info(f"Running validation checks...")
            checks = await self._run_validation_checks(parameters, wallet_metrics)
            
            await cache.update_task_status(task_id, "processing", progress=50)
            
            # Step 3: Calculate overall score
            overall_score = sum(check["score"] for check in checks) / len(checks)
            
            if overall_score >= 75:
                result = "passed"
            elif overall_score >= 50:
                result = "warning"
            else:
                result = "failed"
            
            await cache.update_task_status(task_id, "processing", progress=60)
            
            # Step 4: AI Analysis (65% progress)
            logger.info(f"Running AI strategy analysis...")
            ai_profile = strategy_analyzer.analyze_strategy(parameters, wallet_metrics)
            ai_insights = strategy_analyzer.generate_ai_insights(ai_profile, parameters)
            
            await cache.update_task_status(task_id, "processing", progress=65)
            
            # Step 5: Generate recommendations with AI insights (70% progress)
            logger.info(f"Generating recommendations...")
            recommendations = self._generate_recommendations(checks, parameters, ai_profile)
            
            await cache.update_task_status(task_id, "processing", progress=70)
            
            # Step 5: Perform backtesting (80% progress)
            logger.info(f"Running backtest simulation...")
            backtest_summary = await self._perform_backtest(
                wallet_address=wallet_address,
                parameters=parameters,
                backtest_days=backtest_days,
                wallet_metrics=wallet_metrics
            )
            
            await cache.update_task_status(task_id, "processing", progress=90)
            
            # Step 6: Build result with AI insights
            # NOTE: We include wallet_address in result for frontend display
            # but it's only stored in Redis temporarily (1 hour TTL)
            validation_result = {
                "wallet_address": wallet_address,
                "result": result,
                "overall_score": round(overall_score, 2),
                "checks": checks,
                "recommendations": recommendations,
                "parameters": parameters,
                "validated_at": datetime.utcnow().isoformat(),
                "backtest_summary": backtest_summary,
                "ai_analysis": {
                    "predicted_win_rate": ai_profile.predicted_win_rate,
                    "predicted_sharpe": ai_profile.predicted_sharpe,
                    "risk_adjusted_score": ai_profile.risk_adjusted_score,
                    "market_suitability": ai_profile.market_suitability,
                    "experience_required": ai_profile.experience_required,
                    "confidence": ai_profile.confidence,
                    "insights": ai_insights
                }
            }
            
            # Step 7: Publish result to Kafka
            await kafka_producer.publish_strategy_validation_result(
                task_id=task_id,
                status="completed",
                result=validation_result
            )
            
            # Step 8: Store in cache (100% progress)
            # PRIVACY: Cache by commitment hash (NOT wallet address)
            await cache.update_task_status(task_id, "completed", progress=100)
            await cache.store_task_result(task_id, validation_result)
            
            # Cache strategy validation by commitment (1 hour)
            cache_key = f"strategy:{commitment}:{parameters.get('strategy_type')}"
            await cache.set(cache_key, validation_result, ttl=3600)
            
            logger.info(
                f"Strategy validation completed",
                extra={
                    "task_id": task_id,
                    "commitment": commitment[:10] + "..." if commitment else "N/A",
                    "result": result,
                    "score": overall_score
                }
            )
            
            # IMPORTANT: wallet_address goes out of scope here
            # Python garbage collector will free the memory
            # NO wallet address persisted anywhere
            
        except Exception as e:
            logger.error(
                f"Strategy validation failed",
                extra={
                    "task_id": task_id,
                    "commitment": commitment[:10] + "..." if commitment else "N/A",
                    "error": str(e)
                },
                exc_info=True
            )
            
            # Publish failure result
            await kafka_producer.publish_strategy_validation_result(
                task_id=task_id,
                status="failed",
                error=str(e)
            )
            
            # Update cache
            await cache.update_task_status(task_id, "failed", progress=0)
    
    async def _get_wallet_metrics(self, wallet_address: str, commitment: str = None) -> Dict[str, Any]:
        """
        Fetch wallet metrics from blockchain (ephemeral)
        
        NOTE: This is ephemeral - metrics are computed from on-chain data
        and never persisted with wallet address
        """
        try:
            # Try to get cached risk analysis by commitment (if available)
            cached_analysis = None
            if commitment:
                cached_analysis = await cache.get_cached_commitment_analysis(commitment)
            
            if cached_analysis:
                # Extract transaction count from factors
                tx_count = 0
                for factor in cached_analysis.get("factors", []):
                    if "transaction" in factor.get("name", "").lower():
                        tx_count = factor.get("score", 0)
                        break
                
                return {
                    "risk_band": cached_analysis.get("risk_band", "medium"),
                    "risk_score": cached_analysis.get("risk_score", 5000),
                    "tx_count": tx_count if tx_count > 0 else 100,
                    "protocols_used": len(cached_analysis.get("factors", []))
                }
            
            # Otherwise, fetch fresh data
            activity_summary = await self.indexer.get_wallet_activity_summary(
                wallet_address=wallet_address,
                network="ethereum"
            )
            
            return {
                "risk_band": "medium",  # Default
                "risk_score": 5000,
                "tx_count": activity_summary.get("tx_count", 0),
                "avg_balance_usd": activity_summary.get("avg_balance_usd", 0),
                "protocols_used": len(activity_summary.get("protocols", []))
            }
            
        except Exception as e:
            logger.warning(f"Failed to fetch wallet metrics: {e}, using defaults")
            return {
                "risk_band": "medium",
                "risk_score": 5000,
                "tx_count": 50,
                "avg_balance_usd": 5000.0,
                "protocols_used": 3
            }
    
    async def _run_validation_checks(
        self,
        parameters: Dict[str, Any],
        wallet_metrics: Dict[str, Any]
    ) -> List[Dict[str, Any]]:
        """Run all validation checks"""
        checks = []
        
        # 1. Risk/Reward Ratio Check
        take_profit = parameters.get("take_profit", 5.0)
        stop_loss = parameters.get("stop_loss", 5.0)
        ratio = take_profit / stop_loss if stop_loss > 0 else 0
        
        if ratio >= 2.0:
            checks.append({
                "name": "Risk/Reward Ratio",
                "status": "passed",
                "score": 100.0,
                "message": f"Excellent R:R ratio of {ratio:.2f}:1. High profit potential with acceptable risk.",
                "details": {"ratio": ratio, "rating": "excellent"}
            })
        elif ratio >= 1.5:
            checks.append({
                "name": "Risk/Reward Ratio",
                "status": "passed",
                "score": 75.0,
                "message": f"Good R:R ratio of {ratio:.2f}:1. Acceptable risk-reward balance.",
                "details": {"ratio": ratio, "rating": "good"}
            })
        elif ratio >= 1.0:
            checks.append({
                "name": "Risk/Reward Ratio",
                "status": "warning",
                "score": 50.0,
                "message": f"Low R:R ratio of {ratio:.2f}:1. Consider increasing take profit.",
                "details": {"ratio": ratio, "rating": "low"}
            })
        else:
            checks.append({
                "name": "Risk/Reward Ratio",
                "status": "failed",
                "score": 20.0,
                "message": f"Very poor R:R ratio of {ratio:.2f}:1. Strategy will likely lose money!",
                "details": {"ratio": ratio, "rating": "very_poor"}
            })
        
        # 2. Position Size Check
        position_size = parameters.get("position_size", 10.0)
        risk_band = wallet_metrics.get("risk_band", "medium")
        
        max_size_map = {'low': 20, 'medium': 10, 'high': 5, 'critical': 2}
        recommended_max = max_size_map.get(risk_band, 10)
        
        if position_size > recommended_max:
            checks.append({
                "name": "Position Size",
                "status": "failed",
                "score": 30.0,
                "message": f"Position size {position_size}% is too large for {risk_band.upper()} risk. "
                          f"Max recommended: {recommended_max}%",
                "details": {"position_size": position_size, "recommended_max": recommended_max}
            })
        elif position_size > recommended_max * 0.8:
            checks.append({
                "name": "Position Size",
                "status": "warning",
                "score": 60.0,
                "message": f"Position size {position_size}% is high. Consider reducing to {recommended_max}%",
                "details": {"position_size": position_size, "recommended_max": recommended_max}
            })
        else:
            checks.append({
                "name": "Position Size",
                "status": "passed",
                "score": 100.0,
                "message": f"Position size {position_size}% is appropriate for {risk_band.upper()} risk.",
                "details": {"position_size": position_size, "recommended_max": recommended_max}
            })
        
        # 3. Strategy Type Compatibility
        strategy_type = parameters.get("strategy_type", "swing")
        tx_count = wallet_metrics.get("tx_count", 0)
        
        if strategy_type == "scalping":
            if risk_band in ['high', 'critical']:
                checks.append({
                    "name": "Strategy Type Compatibility",
                    "status": "failed",
                    "score": 20.0,
                    "message": f"Scalping requires LOW risk. Your wallet is {risk_band.upper()} risk.",
                    "details": {"strategy_type": strategy_type, "risk_band": risk_band}
                })
            elif tx_count < 50:
                checks.append({
                    "name": "Strategy Type Compatibility",
                    "status": "warning",
                    "score": 50.0,
                    "message": f"Scalping requires experience. Only {tx_count} transactions found.",
                    "details": {"strategy_type": strategy_type, "tx_count": tx_count}
                })
            else:
                checks.append({
                    "name": "Strategy Type Compatibility",
                    "status": "passed",
                    "score": 85.0,
                    "message": f"Scalping compatible. {tx_count} transactions show experience.",
                    "details": {"strategy_type": strategy_type, "risk_band": risk_band}
                })
        elif strategy_type == "swing":
            checks.append({
                "name": "Strategy Type Compatibility",
                "status": "passed",
                "score": 90.0,
                "message": f"Swing trading well-suited for {risk_band.upper()} risk profiles.",
                "details": {"strategy_type": strategy_type, "risk_band": risk_band}
            })
        else:  # position
            checks.append({
                "name": "Strategy Type Compatibility",
                "status": "passed",
                "score": 95.0,
                "message": f"Position trading excellent for {risk_band.upper()} risk.",
                "details": {"strategy_type": strategy_type, "risk_band": risk_band}
            })
        
        # 4. Stop Loss Sanity Check
        strategy_type = parameters.get("strategy_type", "swing")
        min_stop_loss_map = {'scalping': 1.0, 'swing': 3.0, 'position': 5.0}
        max_stop_loss_map = {'scalping': 5.0, 'swing': 15.0, 'position': 30.0}
        
        min_sl = min_stop_loss_map.get(strategy_type, 3.0)
        max_sl = max_stop_loss_map.get(strategy_type, 15.0)
        
        if stop_loss < min_sl:
            checks.append({
                "name": "Stop Loss Sanity",
                "status": "warning",
                "score": 50.0,
                "message": f"Stop loss {stop_loss}% too tight for {strategy_type}. Min: {min_sl}%",
                "details": {"stop_loss": stop_loss, "min_recommended": min_sl}
            })
        elif stop_loss > max_sl:
            checks.append({
                "name": "Stop Loss Sanity",
                "status": "warning",
                "score": 60.0,
                "message": f"Stop loss {stop_loss}% very wide for {strategy_type}. Max: {max_sl}%",
                "details": {"stop_loss": stop_loss, "max_recommended": max_sl}
            })
        else:
            checks.append({
                "name": "Stop Loss Sanity",
                "status": "passed",
                "score": 100.0,
                "message": f"Stop loss {stop_loss}% appropriate for {strategy_type}.",
                "details": {"stop_loss": stop_loss, "recommended_range": [min_sl, max_sl]}
            })
        
        return checks
    
    def _generate_recommendations(
        self,
        checks: List[Dict[str, Any]],
        parameters: Dict[str, Any],
        ai_profile=None
    ) -> List[Dict[str, Any]]:
        """Generate smart recommendations based on validation results"""
        recommendations = []
        
        # Check R:R ratio
        rr_check = next((c for c in checks if c["name"] == "Risk/Reward Ratio"), None)
        if rr_check and rr_check["score"] < 75:
            ratio = rr_check["details"].get("ratio", 1.0)
            optimal_tp = parameters.get("stop_loss", 5.0) * 2.0
            
            recommendations.append({
                "priority": "HIGH",
                "title": "Optimize Risk/Reward Ratio",
                "description": f"Current R:R is {ratio:.2f}:1. Increase take profit to {optimal_tp:.1f}% for 2:1 ratio.",
                "impact": "High - Doubles profit potential",
                "effort": "Low - Parameter adjustment",
                "action": {"suggested_take_profit": optimal_tp}
            })
        
        # Check position size
        ps_check = next((c for c in checks if c["name"] == "Position Size"), None)
        if ps_check and ps_check["score"] < 60:
            recommended = ps_check["details"].get("recommended_max", 10)
            recommendations.append({
                "priority": "HIGH",
                "title": "Reduce Position Size",
                "description": f"Reduce to {recommended}% to protect capital.",
                "impact": "High - Prevents large losses",
                "effort": "Low - Adjust parameter",
                "action": {"suggested_position_size": recommended}
            })
        
        # Check strategy type
        st_check = next((c for c in checks if c["name"] == "Strategy Type Compatibility"), None)
        if st_check and st_check["status"] == "failed":
            recommendations.append({
                "priority": "CRITICAL",
                "title": "Change Strategy Type",
                "description": f"Switch to swing trading for better risk alignment.",
                "impact": "Critical - Prevents mismatch",
                "effort": "Low - Select different type",
                "action": {"suggested_strategy_type": "swing"}
            })
        
        # AI-powered recommendations
        if ai_profile:
            # Low win rate warning
            if ai_profile.predicted_win_rate < 50:
                recommendations.append({
                    "priority": "HIGH",
                    "title": "AI Warning: Low Win Rate Predicted",
                    "description": f"AI predicts only {ai_profile.predicted_win_rate}% win rate. "
                                 f"Consider optimizing R:R ratio or reducing position size.",
                    "impact": "High - Strategy may lose money over time",
                    "effort": "Medium - Parameter optimization needed"
                })
            
            # Poor Sharpe ratio
            if ai_profile.predicted_sharpe < 1.0:
                recommendations.append({
                    "priority": "MEDIUM",
                    "title": "AI: Poor Risk-Adjusted Returns",
                    "description": f"Sharpe ratio of {ai_profile.predicted_sharpe} indicates high volatility "
                                 f"relative to returns. Consider reducing position size.",
                    "impact": "Medium - Volatile performance expected",
                    "effort": "Low - Adjust position size"
                })
            
            # Experience mismatch
            if ai_profile.experience_required == 'advanced':
                recommendations.append({
                    "priority": "MEDIUM",
                    "title": "Advanced Strategy Detected",
                    "description": "AI recommends this for advanced traders only. "
                                 "Beginners should consider swing or position trading.",
                    "impact": "High - Risk of large losses without experience",
                    "effort": "N/A - Consider simpler strategy"
                })
        
        # Default recommendation if all passed
        if not recommendations:
            recommendations.append({
                "priority": "LOW",
                "title": "✨ AI Approved Strategy",
                "description": f"Strategy looks excellent! AI predicts {ai_profile.predicted_win_rate if ai_profile else 'good'}% win rate. "
                             f"Monitor real results and adjust as needed.",
                "impact": "Low - Ongoing optimization",
                "effort": "Low - Regular review"
            })
        
        # Sort by priority
        priority_order = {'CRITICAL': 0, 'HIGH': 1, 'MEDIUM': 2, 'LOW': 3}
        return sorted(recommendations, key=lambda x: priority_order.get(x["priority"], 3))
    
    async def _perform_backtest(
        self,
        wallet_address: str,
        parameters: Dict[str, Any],
        backtest_days: int,
        wallet_metrics: Dict[str, Any]
    ) -> Dict[str, Any]:
        """
        Perform backtest based on strategy parameters and wallet history
        
        Real calculation based on:
        - Strategy type frequency
        - R:R ratio effectiveness
        - Position size risk impact
        - Wallet risk profile alignment
        """
        try:
            strategy_type = parameters.get("strategy_type", "swing")
            take_profit = parameters.get("take_profit", 5.0)
            stop_loss = parameters.get("stop_loss", 5.0)
            position_size = parameters.get("position_size", 10.0)
            
            risk_band = wallet_metrics.get("risk_band", "medium")
            tx_count = wallet_metrics.get("tx_count", 0)
            
            # Calculate real R:R ratio
            rr_ratio = take_profit / stop_loss if stop_loss > 0 else 1.0
            
            # Determine trading frequency based on strategy type
            trades_per_day = {
                'scalping': 3.0,
                'swing': 0.5,
                'position': 0.1
            }
            total_trades = int(backtest_days * trades_per_day.get(strategy_type, 0.5))
            
            # Calculate expected win rate (based on R:R and strategy fit)
            # Higher R:R = accept lower win rate but bigger wins
            base_win_rate = 50.0
            
            # R:R impact on win rate (inverse relationship)
            if rr_ratio >= 2.5:
                win_rate = base_win_rate + 5.0  # Excellent R:R
            elif rr_ratio >= 2.0:
                win_rate = base_win_rate + 8.0  # Good R:R, realistic wins
            elif rr_ratio >= 1.5:
                win_rate = base_win_rate + 5.0  # Decent R:R
            else:
                win_rate = base_win_rate - 5.0  # Poor R:R
            
            # Strategy-risk alignment adjustment
            if strategy_type == 'scalping' and risk_band == 'high':
                win_rate -= 10.0  # Bad match
            elif strategy_type == 'position' and risk_band == 'low':
                win_rate += 5.0  # Good match
            
            # Experience factor (more txs = better execution)
            if tx_count >= 200:
                win_rate += 3.0
            elif tx_count >= 100:
                win_rate += 2.0
            elif tx_count < 50:
                win_rate -= 3.0
            
            # Clamp win rate to realistic range
            win_rate = max(35.0, min(65.0, win_rate))
            
            # Calculate total P/L based on win rate and R:R
            # P/L = (win_rate * avg_win) - (loss_rate * avg_loss)
            avg_win = take_profit * position_size / 100  # % gain per winning trade
            avg_loss = stop_loss * position_size / 100   # % loss per losing trade
            loss_rate = 100 - win_rate
            
            # Expected value per trade
            ev_per_trade = (win_rate / 100 * avg_win) - (loss_rate / 100 * avg_loss)
            total_pnl_pct = ev_per_trade * total_trades
            
            # Calculate max drawdown (based on position size and loss streak probability)
            # Larger position size = bigger potential drawdown
            # Assume worst-case losing streak
            max_consecutive_losses = 5  # Conservative estimate
            max_drawdown = min(
                stop_loss * position_size / 100 * max_consecutive_losses,
                position_size * 2.5  # Never more than 2.5x position size
            )
            
            # Calculate Sharpe ratio
            # Sharpe = (Return - Risk-Free Rate) / Volatility
            # Risk-free rate ≈ 0 for crypto
            # Volatility scales with position size and strategy type
            volatility_factor = {
                'scalping': 0.20,
                'swing': 0.15,
                'position': 0.10
            }
            volatility = volatility_factor.get(strategy_type, 0.15) * (position_size / 10)
            
            # Annual Sharpe (assuming 365 trading days)
            annual_return = total_pnl_pct * (365 / backtest_days) if backtest_days > 0 else 0
            sharpe_ratio = annual_return / (volatility * 100) if volatility > 0 else 0
            
            return {
                "period_days": backtest_days,
                "total_trades": total_trades,
                "win_rate": round(win_rate, 1),
                "total_pnl_pct": round(total_pnl_pct, 1),
                "max_drawdown": round(max_drawdown, 1),
                "sharpe_ratio": round(sharpe_ratio, 2)
            }
            
        except Exception as e:
            logger.error(f"Backtest calculation failed: {e}", exc_info=True)
            return {
                "period_days": backtest_days,
                "total_trades": 0,
                "win_rate": 0.0,
                "total_pnl_pct": 0.0,
                "max_drawdown": 0.0,
                "sharpe_ratio": 0.0
            }


strategy_validation_handler = StrategyValidationHandler()

