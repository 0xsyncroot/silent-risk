'use client';

import { useState } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { Settings, CheckCircle, AlertTriangle, XCircle, ArrowLeft, TrendingUp, Sparkles, Target } from 'lucide-react';
import Link from 'next/link';
import { useWalletSignature } from '@/hooks/useWalletSignature';
import { ensureCommitment } from '@/lib/privacy/commitment';

interface ValidationCheck {
  name: string;
  status: 'passed' | 'warning' | 'failed';
  message: string;
  score?: number;
}

interface StrategyParameters {
  strategy_type: 'scalping' | 'swing' | 'position';
  take_profit: number;
  stop_loss: number;
  position_size: number;
  cooldown?: number;
  max_drawdown?: number;
}

interface AIAnalysis {
  predicted_win_rate: number;
  predicted_sharpe: number;
  risk_adjusted_score: number;
  market_suitability: string;
  experience_required: string;
  confidence: number;
  insights: string[];
}

interface Recommendation {
  priority: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  title: string;
  description: string;
  impact: string;
  effort: string;
  action?: {
    suggested_take_profit?: number;
    suggested_stop_loss?: number;
    suggested_position_size?: number;
    suggested_strategy_type?: 'scalping' | 'swing' | 'position';
  };
}

interface BacktestSummary {
  total_trades: number;
  win_rate: number;
  total_pnl_pct: number;
  max_drawdown: number;
  sharpe_ratio: number;
}

interface ValidationResult {
  wallet_address: string;
  result: 'passed' | 'warning' | 'failed';
  overall_score: number;
  checks: ValidationCheck[];
  parameters: StrategyParameters;
  validated_at: string;
  cached: boolean;
  recommendations?: Recommendation[];
  backtest_summary?: BacktestSummary;
  ai_analysis?: AIAnalysis;
}

export default function StrategyValidationPage() {
  const { authenticated } = usePrivy();
  const { signMessage, getExternalWallet } = useWalletSignature();
  
  const [parameters, setParameters] = useState<StrategyParameters>({
    strategy_type: 'swing',
    take_profit: 8,
    stop_loss: 4,
    position_size: 10,
    cooldown: 24,
    max_drawdown: 15
  });
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');

  const validateStrategy = async () => {
    // Get external wallet for analysis
    const externalWallet = getExternalWallet();
    if (!externalWallet) {
      setError('Please connect an external wallet first');
      return;
    }
    
    const address = externalWallet.address;

    setLoading(true);
    setError(null);
    setProgress(0);
    setStatusMessage('Requesting wallet signature...');

    try {
      // Step 1: Request signature for ownership proof
      const signatureResult = await signMessage(address);
      
      if (!signatureResult) {
        setError('Signature required to verify wallet ownership');
        setLoading(false);
        return;
      }

      setStatusMessage('Generating privacy commitment...');
      
      // Step 2: Generate commitment
      const commitmentData = ensureCommitment(address);
      
      setStatusMessage('Submitting validation request...');

      // Step 3: Submit with signature + commitment
      const response = await fetch('http://localhost:8000/api/v1/strategy/validate', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commitment: commitmentData.commitment,
          wallet_address: address,
          signature: signatureResult.signature,
          message: signatureResult.message,
          timestamp: signatureResult.timestamp,
          parameters,
          backtest_days: 30
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Validation failed');
      }

      const data = await response.json();
      
      // Check if cached result (immediate)
      if (data.status === 'completed' && data.result) {
        setValidation(data.result);
        setLoading(false);
      } else {
        // Async task - poll for results
        pollTaskStatus(data.task_id);
      }
    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to validate strategy. Please try again.';
      setError(errorMessage);
      console.error('Validation error:', err);
      setLoading(false);
    }
  };

  const pollTaskStatus = async (taskId: string) => {
    const maxAttempts = 60; // 60 attempts × 2s = 2 minutes timeout
    let attempts = 0;

    const poll = async () => {
      try {
        const response = await fetch(`http://localhost:8000/api/v1/strategy/status/${taskId}`);
        
        if (!response.ok) {
          throw new Error('Failed to fetch status');
        }

        const data = await response.json();
        setProgress(data.progress || 0);

        if (data.status === 'completed') {
          setValidation(data.result);
          setLoading(false);
          return;
        } else if (data.status === 'failed') {
          setError(data.message || 'Validation failed');
          setLoading(false);
          return;
        } else if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000); // Poll every 2 seconds
        } else {
          setError('Validation timeout - please try again');
          setLoading(false);
        }
      } catch (err) {
        console.error('Polling error:', err);
        if (attempts < maxAttempts) {
          attempts++;
          setTimeout(poll, 2000);
        } else {
          setError('Failed to get validation status');
          setLoading(false);
        }
      }
    };

    poll();
  };

  const applyRecommendation = (recommendation: Recommendation) => {
    if (!recommendation.action) return;
    
    // Auto-apply suggested parameters
    const newParams = { ...parameters };
    
    if (recommendation.action.suggested_take_profit) {
      newParams.take_profit = recommendation.action.suggested_take_profit;
    }
    if (recommendation.action.suggested_stop_loss) {
      newParams.stop_loss = recommendation.action.suggested_stop_loss;
    }
    if (recommendation.action.suggested_position_size) {
      newParams.position_size = recommendation.action.suggested_position_size;
    }
    if (recommendation.action.suggested_strategy_type) {
      newParams.strategy_type = recommendation.action.suggested_strategy_type;
    }
    
    setParameters(newParams);
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'passed': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'failed': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'passed': return 'text-green-700 bg-green-50 border border-green-200';
      case 'warning': return 'text-yellow-700 bg-yellow-50 border border-yellow-200';
      case 'failed': return 'text-red-700 bg-red-50 border border-red-200';
      default: return 'text-slate-700 bg-slate-50 border border-slate-200';
    }
  };

  return (
    <>
      <section className="relative pt-20 pb-12 px-4 overflow-hidden min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto relative z-10 max-w-6xl">
          {/* Header - Aligned with Design System */}
          <div className="mb-8">
            <Link 
              href="/" 
              className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </Link>
            
            <div className="flex items-center space-x-4 mb-2">
              <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg">
                <Target className="h-6 w-6 text-slate-900" />
              </div>
              <div>
                <h1 className="heading-2">Strategy Validation</h1>
                <p className="text-body mt-1 text-slate-600">
                  AI-powered trading strategy analysis with privacy
                </p>
              </div>
            </div>
          </div>

        {!authenticated ? (
          <div className="card p-12 text-center">
            <div className="max-w-md mx-auto">
              <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                <Target className="h-8 w-8 text-slate-900" />
              </div>
              <h2 className="heading-3 mb-3">Connect Your Wallet</h2>
              <p className="text-body mb-8">
                Connect your wallet to validate trading strategies with AI-powered analysis
              </p>
              <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
                <div className="flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-purple-600" />
                  <span>AI Analysis</span>
                </div>
                <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                <div className="flex items-center gap-2">
                  <TrendingUp className="h-4 w-4 text-green-600" />
                  <span>Backtest Results</span>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            {/* Strategy Parameters Form */}
            <div className="card p-6">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center shadow-md">
                  <Settings className="h-5 w-5 text-slate-900" />
                </div>
                <h2 className="text-base font-bold text-slate-900">Strategy Parameters</h2>
              </div>

              <div className="space-y-6">
                {/* Strategy Type */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Strategy Type
                  </label>
                  <select
                    value={parameters.strategy_type}
                    onChange={(e) => setParameters({...parameters, strategy_type: e.target.value as 'scalping' | 'swing' | 'position'})}
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  >
                    <option value="scalping">Scalping (High Frequency)</option>
                    <option value="swing">Swing Trading (Medium Term)</option>
                    <option value="position">Position Trading (Long Term)</option>
                  </select>
                </div>

                {/* Take Profit */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Take Profit (%)
                  </label>
                  <input
                    type="number"
                    value={parameters.take_profit}
                    onChange={(e) => setParameters({...parameters, take_profit: parseFloat(e.target.value) || 0})}
                    placeholder="e.g., 8.0"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Stop Loss */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Stop Loss (%)
                  </label>
                  <input
                    type="number"
                    value={parameters.stop_loss}
                    onChange={(e) => setParameters({...parameters, stop_loss: parseFloat(e.target.value) || 0})}
                    placeholder="e.g., 4.0"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Position Size */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Position Size (% of portfolio)
                  </label>
                  <input
                    type="number"
                    value={parameters.position_size}
                    onChange={(e) => setParameters({...parameters, position_size: parseFloat(e.target.value) || 0})}
                    placeholder="e.g., 10"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Cooldown */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Cooldown Period (hours)
                  </label>
                  <input
                    type="number"
                    value={parameters.cooldown || ''}
                    onChange={(e) => setParameters({...parameters, cooldown: parseFloat(e.target.value) || undefined})}
                    placeholder="e.g., 24"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Max Drawdown */}
                <div>
                  <label className="block text-sm font-semibold text-slate-700 mb-3">
                    Max Drawdown (%)
                  </label>
                  <input
                    type="number"
                    value={parameters.max_drawdown || ''}
                    onChange={(e) => setParameters({...parameters, max_drawdown: parseFloat(e.target.value) || undefined})}
                    placeholder="e.g., 15"
                    className="w-full px-4 py-3 bg-white border border-slate-200 rounded-xl text-slate-700 focus:border-yellow-400 focus:outline-none focus:ring-4 focus:ring-yellow-100 transition-all duration-300 shadow-sm"
                  />
                </div>

                {/* Validate Button */}
                <button
                  onClick={validateStrategy}
                  disabled={loading}
                  className="btn-primary w-full font-semibold"
                >
                  {loading ? 'Validating...' : 'Validate Strategy'}
                </button>
              </div>
            </div>

            {/* Validation Results */}
            <div className="card p-6">
              {loading ? (
                <div className="text-center py-16">
                  <div className="relative w-24 h-24 mx-auto mb-6">
                    <svg className="w-24 h-24 transform -rotate-90" viewBox="0 0 100 100">
                      <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                      <circle 
                        cx="50" cy="50" r="42" 
                        stroke="url(#gradient-strategy)" 
                        strokeWidth="4" 
                        fill="transparent" 
                        strokeDasharray={`${2 * Math.PI * 42}`} 
                        strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`} 
                        className="transition-all duration-700 ease-out" 
                        strokeLinecap="round" 
                      />
                      <defs>
                        <linearGradient id="gradient-strategy" x1="0%" y1="0%" x2="100%" y2="100%">
                          <stop offset="0%" stopColor="#FFCB05" />
                          <stop offset="100%" stopColor="#FDB827" />
                        </linearGradient>
                      </defs>
                    </svg>
                    <div className="absolute inset-0 flex items-center justify-center">
                      <span className="text-2xl font-bold text-slate-900">{progress}%</span>
                    </div>
                  </div>
                  <h3 className="heading-3 mb-2">Validating Strategy</h3>
                  <p className="text-body text-slate-600">{statusMessage || 'Analyzing your parameters...'}</p>
                </div>
              ) : error ? (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <AlertTriangle className="h-8 w-8 text-red-600" />
                  </div>
                  <h3 className="heading-3 mb-3 text-red-900">Validation Failed</h3>
                  <p className="text-body text-slate-600 mb-6">{error}</p>
                  <button onClick={validateStrategy} className="btn-primary">
                    Try Again
                  </button>
                </div>
              ) : validation ? (
                <div className="space-y-6">
                  {/* Overall Result */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Validation Result</h3>
                    <div className="flex items-center justify-between p-4 bg-slate-50 rounded-xl">
                      <div className="flex items-center space-x-3">
                        {getStatusIcon(validation.result)}
                        <span className={`px-3 py-1 rounded-full text-sm font-semibold ${getResultColor(validation.result)}`}>
                          {validation.result.toUpperCase()}
                        </span>
                      </div>
                      <div className="text-right">
                        <div className="text-2xl font-bold text-slate-900">{validation.overall_score.toFixed(1)}</div>
                        <div className="text-sm text-slate-600">Overall Score</div>
                      </div>
                    </div>
                  </div>

                  {/* Validation Checks */}
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 mb-4">Validation Checks</h3>
                    <div className="space-y-3">
                      {validation.checks.map((check, index) => (
                        <div key={index} className="flex items-start space-x-3 p-4 bg-slate-50 rounded-xl">
                          {getStatusIcon(check.status)}
                          <div className="flex-1">
                            <h4 className="font-semibold text-slate-900">{check.name}</h4>
                            <p className="text-sm text-slate-600">{check.message}</p>
                          </div>
                          {check.score && (
                            <div className="text-right">
                              <div className="font-bold text-slate-900">{check.score.toFixed(1)}</div>
                              <div className="text-xs text-slate-600">Score</div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Recommendations */}
                  {validation.recommendations && validation.recommendations.length > 0 && (
                    <div>
                      <h3 className="text-xl font-bold text-slate-900 mb-4">Smart Recommendations</h3>
                      <div className="space-y-3">
                        {validation.recommendations.map((rec, index) => (
                          <div key={index} className="p-4 bg-white border border-slate-200 rounded-xl hover:shadow-md transition-shadow">
                            <div className="flex items-start justify-between mb-2">
                              <div className="flex items-center space-x-2">
                                <span className={`px-2 py-1 text-xs font-bold rounded ${
                                  rec.priority === 'CRITICAL' ? 'bg-red-100 text-red-700' :
                                  rec.priority === 'HIGH' ? 'bg-orange-100 text-orange-700' :
                                  rec.priority === 'MEDIUM' ? 'bg-yellow-100 text-yellow-700' :
                                  'bg-slate-100 text-slate-700'
                                }`}>
                                  {rec.priority}
                                </span>
                                <h4 className="font-bold text-slate-900">{rec.title}</h4>
                              </div>
                              {rec.action && (
                                <button
                                  onClick={() => applyRecommendation(rec)}
                                  className="text-xs font-semibold text-blue-600 hover:text-blue-700 hover:underline"
                                >
                                  Apply
                                </button>
                              )}
                            </div>
                            <p className="text-sm text-slate-700 mb-2">{rec.description}</p>
                            <div className="flex items-center space-x-4 text-xs text-slate-600">
                              <span>Impact: {rec.impact}</span>
                              <span>•</span>
                              <span>Effort: {rec.effort}</span>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Backtest Summary */}
                  {validation.backtest_summary && (
                    <div className="p-4 bg-gradient-to-br from-green-50 to-emerald-50 border border-green-200 rounded-xl">
                      <div className="flex items-center space-x-2 mb-3">
                        <TrendingUp className="h-5 w-5 text-green-600" />
                        <h4 className="font-semibold text-green-900">Backtest Results (30 days)</h4>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                        <div>
                          <div className="text-xs text-green-700">Total Trades</div>
                          <div className="text-lg font-bold text-green-900">{validation.backtest_summary.total_trades}</div>
                        </div>
                        <div>
                          <div className="text-xs text-green-700">Win Rate</div>
                          <div className="text-lg font-bold text-green-900">{validation.backtest_summary.win_rate}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-green-700">Total P/L</div>
                          <div className={`text-lg font-bold ${validation.backtest_summary.total_pnl_pct >= 0 ? 'text-green-900' : 'text-red-600'}`}>
                            {validation.backtest_summary.total_pnl_pct > 0 ? '+' : ''}{validation.backtest_summary.total_pnl_pct}%
                          </div>
                        </div>
                        <div>
                          <div className="text-xs text-green-700">Max Drawdown</div>
                          <div className="text-lg font-bold text-green-900">{validation.backtest_summary.max_drawdown}%</div>
                        </div>
                        <div>
                          <div className="text-xs text-green-700">Sharpe Ratio</div>
                          <div className="text-lg font-bold text-green-900">{validation.backtest_summary.sharpe_ratio}</div>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* AI Analysis */}
                  {validation.ai_analysis && (
                    <div className="p-5 bg-gradient-to-br from-purple-50 to-blue-50 border border-purple-200 rounded-xl">
                      <div className="flex items-center space-x-2 mb-4">
                        <div className="w-10 h-10 bg-gradient-to-br from-purple-500 to-blue-600 rounded-lg flex items-center justify-center">
                          <span className="text-white text-sm font-bold">AI</span>
                        </div>
                        <div>
                          <h4 className="font-bold text-purple-900">AI-Powered Analysis</h4>
                          <p className="text-xs text-purple-700">Confidence: {validation.ai_analysis.confidence}%</p>
                        </div>
                      </div>
                      
                      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
                        <div className="bg-white/80 rounded-lg p-3">
                          <div className="text-xs text-purple-700 mb-1">Win Rate</div>
                          <div className="text-xl font-bold text-purple-900">{validation.ai_analysis.predicted_win_rate}%</div>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3">
                          <div className="text-xs text-purple-700 mb-1">Sharpe Ratio</div>
                          <div className="text-xl font-bold text-purple-900">{validation.ai_analysis.predicted_sharpe}</div>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3">
                          <div className="text-xs text-purple-700 mb-1">AI Score</div>
                          <div className="text-xl font-bold text-purple-900">{validation.ai_analysis.risk_adjusted_score.toFixed(0)}</div>
                        </div>
                        <div className="bg-white/80 rounded-lg p-3">
                          <div className="text-xs text-purple-700 mb-1">Level</div>
                          <div className="text-sm font-bold text-purple-900 capitalize">{validation.ai_analysis.experience_required}</div>
                        </div>
                      </div>
                      
                      {validation.ai_analysis.insights && validation.ai_analysis.insights.length > 0 && (
                        <div className="space-y-2">
                          <h5 className="text-xs font-bold text-purple-900 mb-2">AI Insights:</h5>
                          {validation.ai_analysis.insights.map((insight, idx) => (
                            <div key={idx} className="bg-white/60 rounded-lg p-2 text-xs text-purple-800">
                              {insight}
                            </div>
                          ))}
                        </div>
                      )}
                      
                      <div className="mt-3 pt-3 border-t border-purple-200">
                        <div className="flex items-center justify-between text-xs">
                          <span className="text-purple-700">Best for:</span>
                          <span className="font-semibold text-purple-900 capitalize">{validation.ai_analysis.market_suitability} markets</span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Risk/Reward Analysis */}
                  <div className="p-4 bg-blue-50 rounded-xl">
                    <div className="flex items-center space-x-2 mb-2">
                      <TrendingUp className="h-5 w-5 text-blue-600" />
                      <h4 className="font-semibold text-blue-900">Risk/Reward Analysis</h4>
                    </div>
                    <p className="text-sm text-blue-700">
                      Risk/Reward Ratio: {(parameters.take_profit / parameters.stop_loss).toFixed(2)}:1
                      {(parameters.take_profit / parameters.stop_loss) >= 2 ? ' (Excellent)' : 
                       (parameters.take_profit / parameters.stop_loss) >= 1.5 ? ' (Good)' : ' (Needs Improvement)'}
                    </p>
                  </div>
                </div>
              ) : (
                <div className="text-center py-16">
                  <div className="w-16 h-16 bg-slate-50 border-2 border-slate-200 rounded-2xl flex items-center justify-center mx-auto mb-6">
                    <Target className="h-8 w-8 text-slate-400" />
                  </div>
                  <h3 className="heading-3 mb-3">Ready to Validate</h3>
                  <p className="text-body text-slate-600">
                    Configure your strategy parameters and click validate to get AI-powered analysis
                  </p>
                </div>
              )}
            </div>
          </div>
        )}
        </div>
      </section>
    </>
  );
}
