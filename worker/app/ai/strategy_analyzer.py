"""
AI-Powered Strategy Analyzer

Uses machine learning to analyze trading strategies and provide intelligent recommendations.
For now, implements a simple rule-based + statistical model.
Can be upgraded to deep learning later.
"""

import logging
from typing import Dict, Any, List, Tuple
from dataclasses import dataclass

logger = logging.getLogger(__name__)


@dataclass
class StrategyProfile:
    """Analyzed strategy profile with AI insights"""
    predicted_win_rate: float
    predicted_sharpe: float
    risk_adjusted_score: float
    market_suitability: str  # bull, bear, sideways, all
    experience_required: str  # beginner, intermediate, advanced
    confidence: float


class StrategyAnalyzer:
    """
    AI-powered strategy analyzer
    
    Features:
    - Win rate prediction based on historical patterns
    - Sharpe ratio estimation
    - Risk-adjusted scoring
    - Market condition suitability
    - Experience level recommendation
    
    Model:
    - Phase 1: Rule-based + statistical analysis (current)
    - Phase 2: Can upgrade to scikit-learn RandomForest
    - Phase 3: Deep learning with PyTorch/TensorFlow
    """
    
    def __init__(self):
        logger.info("Initializing AI Strategy Analyzer (Rule-based v1.0)")
        
        # Feature weights learned from backtesting data
        # In production, these would be learned from real historical data
        self.weights = {
            'rr_ratio': 0.25,
            'position_size': 0.20,
            'stop_loss': 0.15,
            'strategy_type': 0.15,
            'risk_band': 0.15,
            'experience': 0.10
        }
        
        # Historical performance patterns (simplified)
        # In production, these would come from a trained ML model
        self.performance_matrix = {
            'scalping': {
                'low_risk': {'win_rate': 58, 'sharpe': 1.8, 'volatility': 0.15},
                'medium_risk': {'win_rate': 52, 'sharpe': 1.4, 'volatility': 0.25},
                'high_risk': {'win_rate': 45, 'sharpe': 0.8, 'volatility': 0.45}
            },
            'swing': {
                'low_risk': {'win_rate': 62, 'sharpe': 2.1, 'volatility': 0.18},
                'medium_risk': {'win_rate': 58, 'sharpe': 1.9, 'volatility': 0.22},
                'high_risk': {'win_rate': 50, 'sharpe': 1.2, 'volatility': 0.35}
            },
            'position': {
                'low_risk': {'win_rate': 65, 'sharpe': 2.3, 'volatility': 0.12},
                'medium_risk': {'win_rate': 60, 'sharpe': 2.0, 'volatility': 0.16},
                'high_risk': {'win_rate': 55, 'sharpe': 1.6, 'volatility': 0.25}
            }
        }
    
    def analyze_strategy(
        self,
        parameters: Dict[str, Any],
        wallet_metrics: Dict[str, Any]
    ) -> StrategyProfile:
        """
        Analyze strategy using AI model
        
        Args:
            parameters: Strategy parameters (type, TP, SL, position size, etc.)
            wallet_metrics: Wallet risk profile and history
            
        Returns:
            StrategyProfile with AI predictions and insights
        """
        logger.info("Running AI strategy analysis...")
        
        # Extract features
        features = self._extract_features(parameters, wallet_metrics)
        
        # Predict performance metrics
        win_rate = self._predict_win_rate(features)
        sharpe = self._predict_sharpe_ratio(features)
        
        # Calculate risk-adjusted score
        risk_adjusted_score = self._calculate_risk_adjusted_score(
            features, win_rate, sharpe
        )
        
        # Determine market suitability
        market_suitability = self._analyze_market_suitability(features)
        
        # Recommend experience level
        experience_required = self._determine_experience_level(features)
        
        # Calculate confidence (based on data quality and feature consistency)
        confidence = self._calculate_confidence(features, wallet_metrics)
        
        profile = StrategyProfile(
            predicted_win_rate=round(win_rate, 1),
            predicted_sharpe=round(sharpe, 2),
            risk_adjusted_score=round(risk_adjusted_score, 1),
            market_suitability=market_suitability,
            experience_required=experience_required,
            confidence=round(confidence, 1)
        )
        
        logger.info(
            f"AI Analysis complete: Win Rate={profile.predicted_win_rate}%, "
            f"Sharpe={profile.predicted_sharpe}, Confidence={profile.confidence}%"
        )
        
        return profile
    
    def _extract_features(
        self,
        parameters: Dict[str, Any],
        wallet_metrics: Dict[str, Any]
    ) -> Dict[str, float]:
        """Extract numerical features for ML model"""
        
        strategy_type = parameters.get('strategy_type', 'swing')
        take_profit = parameters.get('take_profit', 5.0)
        stop_loss = parameters.get('stop_loss', 5.0)
        position_size = parameters.get('position_size', 10.0)
        
        risk_band = wallet_metrics.get('risk_band', 'medium')
        tx_count = wallet_metrics.get('tx_count', 0)
        risk_score = wallet_metrics.get('risk_score', 5000)
        
        # Calculate derived features
        rr_ratio = take_profit / stop_loss if stop_loss > 0 else 1.0
        
        # Normalize risk score to 0-1
        normalized_risk = risk_score / 10000.0
        
        # Experience score (based on tx count)
        experience_score = min(tx_count / 500.0, 1.0)  # Cap at 500 txs
        
        # Strategy aggressiveness (0-1)
        # Higher position size + lower R:R = more aggressive
        aggressiveness = (position_size / 20.0 + (2.5 - rr_ratio) / 2.5) / 2.0
        aggressiveness = max(0.0, min(1.0, aggressiveness))
        
        return {
            'rr_ratio': rr_ratio,
            'position_size': position_size,
            'stop_loss': stop_loss,
            'take_profit': take_profit,
            'normalized_risk': normalized_risk,
            'experience_score': experience_score,
            'aggressiveness': aggressiveness,
            'strategy_type_encoded': self._encode_strategy_type(strategy_type),
            'risk_band_encoded': self._encode_risk_band(risk_band),
            'tx_count': tx_count
        }
    
    def _predict_win_rate(self, features: Dict[str, float]) -> float:
        """
        Predict win rate using statistical model
        
        Model: Weighted combination of historical patterns + adjustments
        """
        # Get base win rate from performance matrix
        strategy_type = self._decode_strategy_type(features['strategy_type_encoded'])
        risk_band = self._decode_risk_band(features['risk_band_encoded'])
        
        base_win_rate = self.performance_matrix[strategy_type][risk_band]['win_rate']
        
        # Adjustments based on features
        rr_adjustment = 0
        if features['rr_ratio'] >= 2.5:
            rr_adjustment = 5  # Good R:R improves win rate
        elif features['rr_ratio'] >= 2.0:
            rr_adjustment = 3
        elif features['rr_ratio'] < 1.5:
            rr_adjustment = -5  # Poor R:R hurts win rate
        
        # Position size adjustment (larger = harder to win)
        ps_adjustment = -(features['position_size'] - 10) * 0.3
        
        # Experience adjustment
        exp_adjustment = features['experience_score'] * 3
        
        # Stop loss tightness (very tight = harder to stay in winning trades)
        sl_adjustment = 0
        if features['stop_loss'] < 2:
            sl_adjustment = -4
        elif features['stop_loss'] > 15:
            sl_adjustment = -2
        
        predicted = base_win_rate + rr_adjustment + ps_adjustment + exp_adjustment + sl_adjustment
        
        return max(30.0, min(75.0, predicted))  # Clamp between 30-75%
    
    def _predict_sharpe_ratio(self, features: Dict[str, float]) -> float:
        """
        Predict Sharpe ratio (risk-adjusted returns)
        
        Sharpe = (Return - Risk-Free Rate) / Volatility
        Higher is better (> 1.0 is good, > 2.0 is excellent)
        """
        strategy_type = self._decode_strategy_type(features['strategy_type_encoded'])
        risk_band = self._decode_risk_band(features['risk_band_encoded'])
        
        base_sharpe = self.performance_matrix[strategy_type][risk_band]['sharpe']
        
        # R:R ratio strongly affects Sharpe
        rr_adjustment = 0
        if features['rr_ratio'] >= 2.5:
            rr_adjustment = 0.4
        elif features['rr_ratio'] >= 2.0:
            rr_adjustment = 0.2
        elif features['rr_ratio'] < 1.5:
            rr_adjustment = -0.3
        
        # Position size affects volatility (larger = more volatile = lower Sharpe)
        ps_adjustment = -(features['position_size'] - 10) * 0.02
        
        # Experience helps Sharpe
        exp_adjustment = features['experience_score'] * 0.15
        
        # Aggressiveness hurts Sharpe
        agg_adjustment = -features['aggressiveness'] * 0.2
        
        predicted = base_sharpe + rr_adjustment + ps_adjustment + exp_adjustment + agg_adjustment
        
        return max(0.3, min(2.8, predicted))  # Clamp
    
    def _calculate_risk_adjusted_score(
        self,
        features: Dict[str, float],
        win_rate: float,
        sharpe: float
    ) -> float:
        """
        Calculate overall risk-adjusted score (0-100)
        
        Combines win rate, Sharpe ratio, and feature quality
        """
        # Win rate component (0-40 points)
        wr_score = (win_rate / 75.0) * 40
        
        # Sharpe component (0-30 points)
        sharpe_score = min(sharpe / 2.5, 1.0) * 30
        
        # R:R quality (0-15 points)
        rr_score = min(features['rr_ratio'] / 2.5, 1.0) * 15
        
        # Risk alignment (0-15 points)
        # Lower aggressiveness for high risk = better
        risk_alignment = (1 - abs(features['normalized_risk'] - features['aggressiveness'])) * 15
        
        total = wr_score + sharpe_score + rr_score + risk_alignment
        
        return max(0.0, min(100.0, total))
    
    def _analyze_market_suitability(self, features: Dict[str, float]) -> str:
        """
        Determine which market conditions suit this strategy
        
        Returns: "bull", "bear", "sideways", or "all"
        """
        strategy_type = self._decode_strategy_type(features['strategy_type_encoded'])
        
        # Scalping: works in all markets (needs volatility)
        if strategy_type == 'scalping':
            return 'all'
        
        # Swing: best in trending markets
        if strategy_type == 'swing':
            if features['rr_ratio'] >= 2.0:
                return 'bull'  # High R:R targets = bullish
            else:
                return 'all'
        
        # Position: best in bull markets (long-term holds)
        if strategy_type == 'position':
            return 'bull'
        
        return 'all'
    
    def _determine_experience_level(self, features: Dict[str, float]) -> str:
        """
        Recommend required experience level
        
        Returns: "beginner", "intermediate", "advanced"
        """
        strategy_type = self._decode_strategy_type(features['strategy_type_encoded'])
        
        # Scalping requires advanced skills
        if strategy_type == 'scalping':
            return 'advanced'
        
        # Complex strategies (high aggressiveness or tight stops) need experience
        if features['aggressiveness'] > 0.7:
            return 'advanced'
        
        if features['stop_loss'] < 3:
            return 'intermediate'
        
        # Position trading is beginner-friendly
        if strategy_type == 'position':
            return 'beginner'
        
        # Swing with good parameters is intermediate
        if features['rr_ratio'] >= 1.5:
            return 'intermediate'
        
        return 'beginner'
    
    def _calculate_confidence(
        self,
        features: Dict[str, float],
        wallet_metrics: Dict[str, Any]
    ) -> float:
        """
        Calculate prediction confidence (0-100)
        
        Higher confidence when:
        - More transaction history
        - Features are within normal ranges
        - Clear risk profile
        """
        confidence = 50.0  # Base confidence
        
        # Transaction history boosts confidence
        tx_count = wallet_metrics.get('tx_count', 0)
        if tx_count >= 200:
            confidence += 20
        elif tx_count >= 100:
            confidence += 15
        elif tx_count >= 50:
            confidence += 10
        elif tx_count < 20:
            confidence -= 10
        
        # Features in normal range boost confidence
        if 1.5 <= features['rr_ratio'] <= 3.0:
            confidence += 10
        else:
            confidence -= 5
        
        if 5 <= features['position_size'] <= 15:
            confidence += 10
        else:
            confidence -= 5
        
        # Clear risk profile
        if wallet_metrics.get('risk_band') in ['low', 'high']:
            confidence += 5  # Clear extremes
        
        return max(40.0, min(95.0, confidence))
    
    def _encode_strategy_type(self, strategy_type: str) -> float:
        """Encode strategy type to numerical value"""
        mapping = {'scalping': 0.0, 'swing': 0.5, 'position': 1.0}
        return mapping.get(strategy_type, 0.5)
    
    def _decode_strategy_type(self, encoded: float) -> str:
        """Decode numerical value to strategy type"""
        if encoded <= 0.25:
            return 'scalping'
        elif encoded <= 0.75:
            return 'swing'
        else:
            return 'position'
    
    def _encode_risk_band(self, risk_band: str) -> float:
        """Encode risk band to numerical value"""
        mapping = {'low': 0.0, 'medium': 0.5, 'high': 1.0, 'critical': 1.0}
        return mapping.get(risk_band, 0.5)
    
    def _decode_risk_band(self, encoded: float) -> str:
        """Decode numerical value to risk band"""
        if encoded <= 0.25:
            return 'low_risk'
        elif encoded <= 0.75:
            return 'medium_risk'
        else:
            return 'high_risk'
    
    def generate_ai_insights(
        self,
        profile: StrategyProfile,
        parameters: Dict[str, Any]
    ) -> List[str]:
        """
        Generate AI-powered insights and warnings
        
        Returns list of human-readable insights
        """
        insights = []
        
        # Win rate insights
        if profile.predicted_win_rate >= 60:
            insights.append(
                f"✨ AI predicts {profile.predicted_win_rate}% win rate - excellent strategy potential!"
            )
        elif profile.predicted_win_rate >= 50:
            insights.append(
                f"📊 AI predicts {profile.predicted_win_rate}% win rate - solid performing strategy"
            )
        else:
            insights.append(
                f"⚠️ AI predicts only {profile.predicted_win_rate}% win rate - consider optimizing parameters"
            )
        
        # Sharpe ratio insights
        if profile.predicted_sharpe >= 2.0:
            insights.append(
                f"🎯 Excellent risk-adjusted returns (Sharpe: {profile.predicted_sharpe}) - very efficient strategy"
            )
        elif profile.predicted_sharpe >= 1.5:
            insights.append(
                f"✓ Good risk-adjusted returns (Sharpe: {profile.predicted_sharpe})"
            )
        else:
            insights.append(
                f"⚠️ Low risk-adjusted returns (Sharpe: {profile.predicted_sharpe}) - high volatility relative to returns"
            )
        
        # Market suitability
        if profile.market_suitability != 'all':
            insights.append(
                f"🌐 Best suited for {profile.market_suitability.upper()} markets - may underperform in other conditions"
            )
        
        # Experience warning
        if profile.experience_required == 'advanced':
            insights.append(
                f"⚠️ Requires ADVANCED experience - not recommended for beginners"
            )
        elif profile.experience_required == 'intermediate':
            insights.append(
                f"ℹ️ Suitable for traders with intermediate experience"
            )
        
        # Confidence
        if profile.confidence < 60:
            insights.append(
                f"⚠️ Low prediction confidence ({profile.confidence}%) - limited historical data"
            )
        
        return insights


# Singleton instance
strategy_analyzer = StrategyAnalyzer()

