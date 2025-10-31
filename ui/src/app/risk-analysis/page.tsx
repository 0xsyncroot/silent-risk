'use client';

import { useState, useEffect } from 'react';
import { 
  Shield, TrendingUp, AlertTriangle, CheckCircle, RefreshCw, ArrowLeft, 
  Zap, Wallet, Sparkles
} from 'lucide-react';
import Link from 'next/link';
import { useWebSocket } from '@/hooks/useWebSocket';
import { useWalletSignature } from '@/hooks/useWalletSignature';
import { ensureCommitment } from '@/lib/privacy';
import { PassportSubmit } from '@/components/PassportSubmit';
import { ShimmerCard, ShimmerList, ShimmerPassport } from '@/components/ui/shimmer';
import { useNotifications } from '@/contexts/NotificationContext';
import { usePrivy } from '@privy-io/react-auth';
import { WalletConnectPrompt } from '@/components/wallet-connect-prompt';

interface RiskFactor {
  name: string;
  score: number;
  status: 'good' | 'medium' | 'high';
  description?: string;
  detail?: string;
}

interface PassportInfo {
  commitment?: string;
  vault_address?: string;
  block_height?: number;
  tx_hash?: string;
  status: 'ready_to_claim' | 'generation_failed' | 'claimed';
  error?: string;
}

interface RiskAnalysis {
  wallet_address: string;
  risk_score: number;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  factors: RiskFactor[];
  analyzed_at: string;
  cached: boolean;
  passport?: PassportInfo;
}

export default function RiskAnalysisPage() {
  const { authenticated } = usePrivy();
  const { 
    signMessage, 
    hasExternalWallet, 
    getExternalWallet,
    getEmbeddedWallet
  } = useWalletSignature();
  const { addNotification } = useNotifications();
  
  // Get embedded wallet (for display)
  const embeddedWallet = getEmbeddedWallet();
  
  const [analysis, setAnalysis] = useState<RiskAnalysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showWalletPrompt, setShowWalletPrompt] = useState(false);
  const [activeTab, setActiveTab] = useState<'overview' | 'factors' | 'recommendations'>('overview');
  const [initialLoadComplete, setInitialLoadComplete] = useState(false);
  
  // Real-time updates via WebSocket
  const [taskId, setTaskId] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [statusMessage, setStatusMessage] = useState('');
  
  const { isConnected: wsConnected, subscribe, unsubscribe } = useWebSocket({
    url: 'ws://localhost:8001/ws',
    onMessage: (message) => {
      if (message.type === 'status_update' && message.data) {
        const data = message.data as { status?: string; progress?: number; message?: string };
        const { status, progress: prog, message: msg } = data;
        
        setProgress(prog || 0);
        setStatusMessage(msg || '');
        
        if (status === 'completed') {
          fetchResult(message.task_id!);
          
          // Notification for completion
          addNotification({
            type: 'success',
            title: 'Analysis Complete',
            message: 'Your wallet risk analysis has been completed successfully.',
            actionUrl: '/risk-analysis',
            taskId: message.task_id
          });
        } else if (status === 'failed') {
          setError(msg || 'Analysis failed');
          setLoading(false);
          
          // Notification for failure
          addNotification({
            type: 'error',
            title: 'Analysis Failed',
            message: msg || 'Unable to complete the analysis. Please try again.',
            actionUrl: '/risk-analysis',
            taskId: message.task_id
          });
        } else if (status === 'processing' && prog === 10) {
          // Notification for start (only once at 10%)
          addNotification({
            type: 'info',
            title: 'Analysis Started',
            message: 'Your wallet is being analyzed with privacy-preserving AI.',
            actionUrl: '/risk-analysis',
            taskId: message.task_id
          });
        }
      }
    },
    onConnect: () => {
      console.log('WebSocket connected');
      if (taskId) {
        subscribe(taskId);
      }
    }
  });

  const fetchResult = async (taskId: string) => {
    try {
      const response = await fetch(`http://localhost:8000/api/v1/risk/status/${taskId}`);
      if (!response.ok) throw new Error('Failed to fetch result');
      
      const data = await response.json();
      if (data.result) {
        setAnalysis(data.result);
        // Save to localStorage with analyzed wallet address
        const analyzedAddress = data.result.wallet_address;
        if (analyzedAddress) {
          localStorage.setItem(`analysis_${analyzedAddress.toLowerCase()}`, JSON.stringify(data.result));
          console.log('💾 Saved analysis to localStorage');
        }
        setLoading(false);
      }
    } catch (err) {
      console.error('Error fetching result:', err);
    }
  };

  const analyzeRisk = async (forceRefresh = false) => {
    // Check authentication first
    if (!authenticated) {
      setError('Please login first');
      return;
    }

    // Check if user has EXTERNAL wallet for analysis (wallet with history)
    if (!hasExternalWallet()) {
      setShowWalletPrompt(true);
      return;
    }

    const externalWallet = getExternalWallet();
    if (!externalWallet) {
      setError('External wallet not found');
      return;
    }

    const analyzeAddress = externalWallet.address;

    // Check cache first (unless force refresh)
    if (!forceRefresh) {
      const cached = localStorage.getItem(`analysis_${analyzeAddress.toLowerCase()}`);
      if (cached) {
        try {
          const parsedAnalysis = JSON.parse(cached) as RiskAnalysis;
          setAnalysis(parsedAnalysis);
          console.log('✅ Using cached analysis for external wallet');
          
          // Show notification for cached result
          addNotification({
            type: 'info',
            title: 'Cached Analysis Loaded',
            message: 'Using your previous analysis. Click "Refresh" for updated results.',
            actionUrl: '/risk-analysis'
          });
          
          return;
        } catch (err) {
          console.error('Failed to parse cached analysis:', err);
        }
      }
    }

    setLoading(true);
    setError(null);
    setProgress(0);
    setStatusMessage('Requesting wallet signature...');

    try {
      // Step 1: Sign with EXTERNAL wallet (wallet with transaction history)
      // EIP-191 signature doesn't reveal identity, only proves ownership
      const signatureResult = await signMessage(analyzeAddress);
      
      if (!signatureResult) {
        // User cancelled signature
        setError('Signature required to verify wallet ownership');
        setLoading(false);
        return;
      }

      setStatusMessage('Generating privacy commitment...');
      
      // Step 2: Generate commitment for privacy
      const commitmentData = ensureCommitment(analyzeAddress);
      
      setStatusMessage('Submitting analysis request...');

      // Step 3: Submit request with signature and commitment
      const response = await fetch('http://localhost:8000/api/v1/risk/analyze', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          commitment: commitmentData.commitment,
          wallet_address: analyzeAddress,
          signature: signatureResult.signature,
          message: signatureResult.message,
          timestamp: signatureResult.timestamp,
          force_refresh: forceRefresh
        })
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.detail || 'Analysis failed');
      }

      const data = await response.json();
      
      // Check if cached result from backend
      if (data.status === 'completed' && data.result) {
        setAnalysis(data.result);
        // Save to localStorage with EXTERNAL wallet address
        localStorage.setItem(`analysis_${analyzeAddress.toLowerCase()}`, JSON.stringify(data.result));
        console.log('💾 Saved analysis to localStorage');
        
        // Show notification for backend cached result
        addNotification({
          type: 'success',
          title: 'Analysis Retrieved',
          message: 'Your previous analysis was found in our secure cache.',
          actionUrl: '/risk-analysis'
        });
        
        setLoading(false);
      } else {
        // New analysis - subscribe to WebSocket updates
        setTaskId(data.task_id);
        if (wsConnected) {
          subscribe(data.task_id);
        }
      }
    } catch (err: unknown) {
      // Friendly error messages
      let errorMessage = 'Unable to analyze wallet. Please try again.';
      
      if (err instanceof Error) {
        if (err.message.includes('Signature required') || err.message.includes('cancelled')) {
          errorMessage = 'Wallet signature is required to verify ownership. Please sign the message in your wallet.';
        } else if (err.message.includes('fetch') || err.message.includes('network')) {
          errorMessage = 'Network connection issue. Please check your connection and try again.';
        } else if (err.message.includes('Invalid')) {
          errorMessage = 'Invalid wallet address or signature. Please check and try again.';
        }
      }
      
      setError(errorMessage);
      console.error('Analysis error:', err);
      setLoading(false);
    }
  };

  // Auto-load cached analysis on mount
  useEffect(() => {
    if (!authenticated || initialLoadComplete) return;

    const externalWallet = getExternalWallet();
    if (!externalWallet) {
      setInitialLoadComplete(true);
      return;
    }

    const analyzeAddress = externalWallet.address;
    
    // Try to load from localStorage cache
    const cached = localStorage.getItem(`analysis_${analyzeAddress.toLowerCase()}`);
    if (cached) {
      try {
        const parsedAnalysis = JSON.parse(cached) as RiskAnalysis;
        setAnalysis(parsedAnalysis);
        console.log('✅ Loaded cached analysis for external wallet');
      } catch (err) {
        console.error('Failed to parse cached analysis:', err);
      }
    }
    
    setInitialLoadComplete(true);
  }, [authenticated, initialLoadComplete, getExternalWallet]);

  // Subscribe to task updates when WebSocket connects
  useEffect(() => {
    if (wsConnected && taskId) {
      subscribe(taskId);
      return () => {
        unsubscribe(taskId);
      };
    }
  }, [wsConnected, taskId, subscribe, unsubscribe]);

  const getPersonalizedInsight = (analysis: RiskAnalysis) => {
    const riskLevel = analysis.risk_band;
    
    if (riskLevel === 'low') {
      return {
        title: "🎉 Excellent Risk Management!",
        message: "Your portfolio shows strong diversification and low-risk positioning. You're well-protected against market volatility.",
        action: "Consider exploring yield farming opportunities to maximize returns while maintaining your conservative approach."
      };
    } else if (riskLevel === 'medium') {
      return {
        title: "⚖️ Balanced Risk Profile",
        message: "Your portfolio has a moderate risk level with good potential for returns. Some areas could benefit from optimization.",
        action: "Review your largest positions and consider rebalancing to reduce concentration risk."
      };
    } else if (riskLevel === 'high') {
      return {
        title: "⚠️ High Risk Detected",
        message: "Your portfolio shows elevated risk levels that could lead to significant losses during market downturns.",
        action: "Immediate action recommended: diversify your holdings and reduce exposure to high-risk protocols."
      };
    } else {
      return {
        title: "🚨 Critical Risk Alert",
        message: "Your portfolio is in a critical risk zone. Immediate action is required to protect your assets.",
        action: "Emergency rebalancing needed: liquidate high-risk positions and move to stable assets immediately."
      };
    }
  };

  return (
    <>
      <section className="relative pt-20 pb-12 px-4 overflow-hidden min-h-screen bg-gradient-to-br from-slate-50 via-white to-slate-50">
        <div className="container mx-auto relative z-10 max-w-5xl">
          {/* Header - Aligned with Design System */}
          <div className="mb-8">
            <Link 
              href="/" 
              className="inline-flex items-center text-sm font-medium text-slate-600 hover:text-slate-900 mb-6 transition-colors group"
            >
              <ArrowLeft className="h-4 w-4 mr-2 group-hover:-translate-x-0.5 transition-transform" />
              Back to Home
            </Link>
            
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 mb-6 w-full">
              <div className="flex items-center space-x-4 min-w-0 flex-1">
                <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-xl flex items-center justify-center shadow-lg flex-shrink-0">
                  <Shield className="h-6 w-6 text-slate-900" />
                </div>
                <div className="min-w-0">
                  <h1 className="heading-2 truncate">Risk Analysis</h1>
                  <p className="text-body mt-1">
                    {wsConnected ? (
                      <span className="flex items-center text-green-600">
                        <span className="w-2 h-2 bg-green-500 rounded-full mr-2 animate-pulse flex-shrink-0"></span>
                        <span className="truncate">Real-time connected</span>
                      </span>
                    ) : (
                      <span className="text-slate-600 truncate">Privacy-preserving portfolio assessment</span>
                    )}
                  </p>
                </div>
              </div>
              
              {analysis && (
                <button
                  onClick={() => analyzeRisk(true)}
                  disabled={loading}
                  className="btn-secondary inline-flex items-center justify-center whitespace-nowrap cursor-pointer flex-shrink-0 w-full sm:w-auto"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 flex-shrink-0 ${loading ? 'animate-spin' : ''}`} />
                  <span>Refresh</span>
                </button>
              )}
            </div>

            {/* Navigation Tabs - Modern & Subtle */}
            {analysis && (
              <div className="border-b border-slate-200">
                <nav className="flex space-x-8">
                  {[
                    { id: 'overview', label: 'Overview' },
                    { id: 'factors', label: 'Risk Factors' },
                    { id: 'recommendations', label: 'Recommendations' }
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id as 'overview' | 'factors' | 'recommendations')}
                      className={`relative py-3 text-sm font-semibold cursor-pointer transition-all ${
                        activeTab === tab.id
                          ? 'text-slate-900'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                      {activeTab === tab.id && (
                        <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"></span>
                      )}
                    </button>
                  ))}
                </nav>
              </div>
            )}
          </div>

          {showWalletPrompt ? (
            <WalletConnectPrompt 
              onConnected={() => {
                setShowWalletPrompt(false);
                setTimeout(() => analyzeRisk(), 500);
              }}
              onCancel={() => setShowWalletPrompt(false)}
            />
          ) : !authenticated ? (
            <div className="card p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg">
                  <Wallet className="h-8 w-8 text-slate-900" />
                </div>
                <h2 className="heading-3 mb-3">Welcome to Risk Analysis</h2>
                <p className="text-body mb-6">
                  Get started by logging in with X or Farcaster
                </p>
                <div className="p-4 bg-blue-50 rounded-xl mb-8">
                  <h3 className="text-sm font-bold text-blue-900 mb-2">How it works:</h3>
                  <ol className="text-xs text-blue-800 text-left space-y-2">
                    <li className="flex items-start">
                      <span className="font-bold mr-2">1.</span>
                      <span>Login with X or Farcaster (top right)</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">2.</span>
                      <span>We&apos;ll create a secure embedded wallet for you</span>
                    </li>
                    <li className="flex items-start">
                      <span className="font-bold mr-2">3.</span>
                      <span>Click &quot;Analyze Portfolio&quot; to start</span>
                    </li>
                  </ol>
                </div>
                <div className="flex items-center justify-center gap-6 text-sm text-slate-600">
                  <div className="flex items-center gap-2">
                    <Shield className="h-4 w-4 text-green-600" />
                    <span>Privacy First</span>
                  </div>
                  <div className="w-1 h-1 bg-slate-300 rounded-full"></div>
                  <div className="flex items-center gap-2">
                    <Zap className="h-4 w-4 text-blue-600" />
                    <span>Real-time Analysis</span>
                  </div>
                </div>
              </div>
            </div>
          ) : !analysis && !loading && !error ? (
            // Fully setup but no analysis yet - show CTA
            <div className="space-y-6">
              <div className="card p-12 text-center">
                <div className="max-w-lg mx-auto">
                  <div className="w-20 h-20 bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-2xl flex items-center justify-center mx-auto mb-6 shadow-lg animate-pulse">
                    <Sparkles className="h-10 w-10 text-slate-900" />
                  </div>
                  <h2 className="heading-2 mb-3">Let&apos;s Get Started! 🚀</h2>
                  <p className="text-body mb-4">
                    To analyze your portfolio, please connect your main wallet (MetaMask, Coinbase, etc.)
                  </p>
                  
                  {embeddedWallet && (
                    <div className="mb-6 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
                      <div className="flex items-start space-x-3">
                        <div className="w-8 h-8 bg-blue-500 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5">
                          <span className="text-white text-sm">ℹ️</span>
                        </div>
                        <div className="flex-1">
                          <h3 className="text-sm font-bold text-blue-900 mb-1">Why do I need to connect a wallet?</h3>
                          <p className="text-xs text-blue-800 leading-relaxed">
                            We&apos;ll analyze your wallet&apos;s transaction history to give you personalized risk insights. 
                            Don&apos;t worry - your privacy is protected! We use EIP-191 signatures that prove ownership without revealing your identity.
                          </p>
                          <p className="text-xs text-blue-700 mt-2 font-medium">
                            💡 Later, you&apos;ll use your new anonymous wallet (<code className="bg-blue-100 px-1 rounded">{embeddedWallet.address.substring(0, 6)}...{embeddedWallet.address.substring(38)}</code>) to mint a privacy-preserving NFT passport.
                          </p>
                        </div>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
                    <div className="p-4 bg-green-50 rounded-xl">
                      <CheckCircle className="h-6 w-6 text-green-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-green-900">Privacy Protected</p>
                      <p className="text-xs text-green-700 mt-1">Zero-knowledge proofs</p>
                    </div>
                    <div className="p-4 bg-blue-50 rounded-xl">
                      <Zap className="h-6 w-6 text-blue-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-blue-900">Real-time Data</p>
                      <p className="text-xs text-blue-700 mt-1">Live blockchain analysis</p>
                    </div>
                    <div className="p-4 bg-purple-50 rounded-xl">
                      <Sparkles className="h-6 w-6 text-purple-600 mx-auto mb-2" />
                      <p className="text-xs font-semibold text-purple-900">AI-Powered</p>
                      <p className="text-xs text-purple-700 mt-1">Smart recommendations</p>
                    </div>
                  </div>

                  <button
                    onClick={() => analyzeRisk()}
                    className="btn-primary inline-flex items-center cursor-pointer justify-center text-lg font-bold px-8 py-4 whitespace-nowrap"
                  >
                    <Shield className="h-5 w-5 mr-2 flex-shrink-0" />
                    <span>Analyze Portfolio</span>
                  </button>
                  
                  <p className="text-xs text-slate-500 mt-4">
                    You&apos;ll be asked to sign a message to verify wallet ownership
                  </p>
                </div>
              </div>

              {/* Preview cards with shimmer */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 opacity-50">
                <ShimmerCard />
                <ShimmerCard />
              </div>
            </div>
          ) : loading ? (
            <div className="space-y-6">
              {/* Main Loading Card */}
              <div className="card p-12">
                <div className="max-w-md mx-auto text-center">
                  {/* Progress Circle - Refined */}
                  <div className="mb-8">
                    <div className="relative w-36 h-36 mx-auto">
                      <svg className="w-36 h-36 transform -rotate-90" viewBox="0 0 100 100">
                        <circle cx="50" cy="50" r="42" stroke="currentColor" strokeWidth="4" fill="transparent" className="text-slate-100" />
                        <circle 
                          cx="50" cy="50" r="42" 
                          stroke="url(#gradient)" 
                          strokeWidth="4" 
                          fill="transparent" 
                          strokeDasharray={`${2 * Math.PI * 42}`} 
                          strokeDashoffset={`${2 * Math.PI * 42 * (1 - progress / 100)}`} 
                          className="transition-all duration-700 ease-out" 
                          strokeLinecap="round" 
                        />
                        <defs>
                          <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                            <stop offset="0%" stopColor="#FFCB05" />
                            <stop offset="100%" stopColor="#FDB827" />
                          </linearGradient>
                        </defs>
                      </svg>
                      <div className="absolute inset-0 flex items-center justify-center">
                        <span className="text-3xl font-bold text-slate-900">{progress}%</span>
                      </div>
                    </div>
                  </div>
                  
                  <h2 className="heading-3 mb-3">Analyzing Portfolio</h2>
                  <p className="text-body mb-8 text-slate-600">
                    {statusMessage || 'Processing encrypted data...'}
                  </p>
                  
                  {/* Progress Steps - Refined */}
                  <div className="space-y-3 text-left">
                    {[
                      { threshold: 10, label: 'Request submitted' },
                      { threshold: 40, label: 'Fetching blockchain data' },
                      { threshold: 60, label: 'Calculating risk score' },
                      { threshold: 80, label: 'Generating passport' },
                      { threshold: 100, label: 'Finalizing results' }
                    ].map(({ threshold, label }) => (
                      <div key={threshold} className={`flex items-center gap-3 transition-all ${progress >= threshold ? 'text-green-600' : 'text-slate-400'}`}>
                        {progress >= threshold ? (
                          <CheckCircle className="h-5 w-5 flex-shrink-0 animate-pulse" />
                        ) : (
                          <div className="w-5 h-5 border-2 border-current rounded-full flex-shrink-0"></div>
                        )}
                        <span className="text-sm font-medium">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* Shimmer preview cards */}
              <ShimmerPassport />
              <ShimmerList />
            </div>
          ) : error ? (
            <div className="card p-12 text-center">
              <div className="max-w-md mx-auto">
                <div className="w-16 h-16 bg-red-50 border-2 border-red-100 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <AlertTriangle className="h-8 w-8 text-red-600" />
                </div>
                <h2 className="heading-3 mb-3 text-slate-900">Oops! Something went wrong</h2>
                <p className="text-sm text-slate-600 mb-6 leading-relaxed">
                  We couldn&apos;t complete the analysis right now. This can happen for a few reasons.
                </p>
                
                {/* Helpful suggestions */}
                <div className="p-5 bg-gradient-to-br from-blue-50 to-indigo-50 rounded-xl mb-6 text-left border border-blue-100">
                  <h3 className="text-sm font-bold text-slate-900 mb-3 flex items-center">
                    <span className="w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center text-white text-xs mr-2">?</span>
                    What to try:
                  </h3>
                  <ul className="space-y-3">
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold flex-shrink-0">1.</span>
                      <span className="text-sm text-slate-700">
                        <strong className="text-slate-900">Check your wallet:</strong> Make sure you signed the message when prompted
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold flex-shrink-0">2.</span>
                      <span className="text-sm text-slate-700">
                        <strong className="text-slate-900">Verify your connection:</strong> Ensure your wallet is connected properly
                      </span>
                    </li>
                    <li className="flex items-start space-x-2">
                      <span className="text-blue-600 font-bold flex-shrink-0">3.</span>
                      <span className="text-sm text-slate-700">
                        <strong className="text-slate-900">Check wallet activity:</strong> Your wallet should have some transaction history
                      </span>
                    </li>
                  </ul>
                </div>

                <div className="flex gap-3 justify-center">
                  <button
                    onClick={() => setError(null)}
                    className="btn-secondary cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
                  >
                    Go Back
                  </button>
                  <button
                    onClick={() => analyzeRisk()}
                    className="btn-primary cursor-pointer inline-flex items-center justify-center whitespace-nowrap"
                  >
                    <RefreshCw className="h-4 w-4 mr-2 flex-shrink-0" />
                    <span>Try Again</span>
                  </button>
                </div>
                
                <p className="text-xs text-slate-500 mt-6">
                  Still having trouble? Try refreshing the page or reconnecting your wallet.
                </p>
              </div>
            </div>
          ) : analysis ? (
            <div className="space-y-6">
              {/* AI Insight Card - Refined */}
              {(() => {
                const insight = getPersonalizedInsight(analysis);
                const riskLevel = analysis.risk_band;
                const gradientClass = riskLevel === 'low' ? 'from-green-50 to-emerald-50' : 
                                     riskLevel === 'medium' ? 'from-blue-50 to-indigo-50' : 
                                     'from-orange-50 to-red-50';
                const iconColor = riskLevel === 'low' ? 'bg-green-500' : 
                                riskLevel === 'medium' ? 'bg-blue-500' : 
                                'bg-orange-500';
                
                return (
                  <div className={`card bg-gradient-to-br ${gradientClass} border-none p-6`}>
                    <div className="flex items-start gap-4">
                      <div className={`w-10 h-10 ${iconColor} rounded-xl flex items-center justify-center flex-shrink-0 shadow-md`}>
                        <Sparkles className="h-5 w-5 text-white" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <h3 className="text-base font-bold text-slate-900 mb-2">{insight.title.replace(/[🎉⚖️⚠️🚨]/g, '').trim()}</h3>
                        <p className="text-sm text-slate-700 mb-4">{insight.message}</p>
                        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 border border-white/50 shadow-sm">
                          <p className="text-sm text-slate-800">
                            <span className="font-semibold text-slate-900">Recommended Action: </span>
                            {insight.action}
                          </p>
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Tab Content */}
              {activeTab === 'overview' && (
                <div className="space-y-4">
                  {/* Risk Passport Card - Zama Style */}
                  <div className="bg-gradient-to-br from-yellow-400 via-yellow-500 to-amber-500 rounded-xl p-6 text-slate-900 relative overflow-hidden shadow-xl">
                    {/* Decorative squares pattern like Zama */}
                    <div className="absolute top-4 right-4 grid grid-cols-4 gap-1 opacity-10">
                      {[...Array(16)].map((_, i) => (
                        <div key={i} className="w-3 h-3 bg-slate-900 rounded-sm"></div>
                      ))}
                    </div>
                    
                    <div className="relative z-10">
                      <div className="flex items-center justify-between mb-6">
                        <div className="flex items-center space-x-3">
                          <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center shadow-md">
                            <Shield className="h-5 w-5 text-yellow-400" />
                          </div>
                          <div>
                            <div className="text-xs font-medium text-slate-800">RISK PASSPORT</div>
                            <div className="text-sm font-bold text-slate-900">Portfolio Analysis</div>
                          </div>
                        </div>
                        {analysis.cached && (
                          <span className="text-xs font-medium text-slate-700 bg-slate-900/10 px-2 py-1 rounded">Cached</span>
                        )}
                      </div>
                      
                      <div className="grid grid-cols-3 gap-6">
                        {/* Risk Score with Chart */}
                        <div className="text-center">
                          <div className="mb-3">
                            <div className="relative w-20 h-20 mx-auto">
                              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-slate-900/20" />
                                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="7" fill="transparent" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - (analysis.risk_score / 10000))}`} className={`${
                                  analysis.risk_score <= 2000 ? 'text-slate-900' :
                                  analysis.risk_score <= 5000 ? 'text-slate-900' :
                                  analysis.risk_score <= 7500 ? 'text-slate-900' : 'text-slate-900'
                                }`} strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold text-slate-900">{analysis.risk_score}</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-bold text-slate-900 mb-1">Risk Score</div>
                          <div className="text-xs text-slate-800">/ 10000</div>
                        </div>
                        
                        {/* Risk Level */}
                        <div className="text-center">
                          <div className="mb-3 flex items-center justify-center h-20">
                            <div className="inline-flex items-center px-4 py-2 rounded-lg text-sm font-bold bg-slate-900 text-yellow-400 shadow-md">
                              {analysis.risk_band === 'low' && <CheckCircle className="h-4 w-4 mr-1.5" />}
                              {analysis.risk_band === 'medium' && <AlertTriangle className="h-4 w-4 mr-1.5" />}
                              {(analysis.risk_band === 'high' || analysis.risk_band === 'critical') && <AlertTriangle className="h-4 w-4 mr-1.5" />}
                              {analysis.risk_band.toUpperCase()}
                            </div>
                          </div>
                          <div className="text-xs font-bold text-slate-900 mb-1">Risk Level</div>
                          <div className="text-xs text-slate-800">Current Status</div>
                        </div>
                        
                        {/* Confidence */}
                        <div className="text-center">
                          <div className="mb-3">
                            <div className="relative w-20 h-20 mx-auto">
                              <svg className="w-20 h-20 transform -rotate-90" viewBox="0 0 100 100">
                                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="7" fill="transparent" className="text-slate-900/20" />
                                <circle cx="50" cy="50" r="40" stroke="currentColor" strokeWidth="7" fill="transparent" strokeDasharray={`${2 * Math.PI * 40}`} strokeDashoffset={`${2 * Math.PI * 40 * (1 - analysis.confidence / 100)}`} className="text-slate-900" strokeLinecap="round" />
                              </svg>
                              <div className="absolute inset-0 flex items-center justify-center">
                                <span className="text-xl font-bold text-slate-900">{analysis.confidence}%</span>
                              </div>
                            </div>
                          </div>
                          <div className="text-xs font-bold text-slate-900 mb-1">Confidence</div>
                          <div className="text-xs text-slate-800">Analysis Quality</div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Passport Submit - Mint NFT on-chain */}
                  {analysis.passport && (
                    <PassportSubmit
                      passportInfo={analysis.passport}
                      analyzedWalletAddress={analysis.wallet_address}
                      onSubmitSuccess={() => {
                        addNotification({
                          type: 'success',
                          title: 'Passport Minted!',
                          message: 'Your privacy-preserving passport NFT has been minted on-chain.',
                          actionUrl: '/risk-analysis'
                        });
                        analyzeRisk(true);
                      }}
                    />
                  )}

                  {/* Risk Factors Summary */}
                  <div className="card p-6">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="text-base font-bold text-slate-900">Risk Factors</h3>
                      <span className="text-xs text-slate-500">Lower score = Lower risk</span>
                    </div>
                    <div className="space-y-4">
                      {analysis.factors.map((factor, index) => {
                        // Lower score = lower risk = good
                        const isGood = factor.score < 2500;
                        const isMedium = factor.score >= 2500 && factor.score < 5000;
                        
                        return (
                          <div key={index}>
                            <div className="flex items-center justify-between mb-2">
                              <div className="flex items-center gap-2">
                                {isGood ? (
                                  <CheckCircle className="h-4 w-4 text-green-600" />
                                ) : isMedium ? (
                                  <AlertTriangle className="h-4 w-4 text-yellow-600" />
                                ) : (
                                  <AlertTriangle className="h-4 w-4 text-orange-600" />
                                )}
                                <span className="text-sm font-semibold text-slate-900">{factor.name}</span>
                              </div>
                              <div className="flex items-center gap-2">
                                <span className={`text-xs font-bold px-2 py-0.5 rounded ${
                                  isGood ? 'bg-green-100 text-green-700' : 
                                  isMedium ? 'bg-yellow-100 text-yellow-700' : 
                                  'bg-orange-100 text-orange-700'
                                }`}>
                                  {isGood ? 'Low Risk' : isMedium ? 'Medium Risk' : 'High Risk'}
                                </span>
                                <span className="text-sm font-bold text-slate-900">{factor.score}</span>
                              </div>
                            </div>
                            <p className="text-xs text-slate-600 ml-6">{factor.description}</p>
                            <div className="relative h-2 bg-slate-100 rounded-full overflow-hidden mt-2">
                              <div 
                                className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                                  isGood ? 'bg-green-500' : isMedium ? 'bg-yellow-500' : 'bg-orange-500'
                                }`}
                                style={{ width: `${Math.min((factor.score / 10000) * 100, 100)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Factors Tab - Detailed */}
              {activeTab === 'factors' && (
                <div className="space-y-4">
                  {analysis.factors.map((factor, index) => {
                    // Lower score = lower risk = good
                    const isGood = factor.score < 2500;
                    const isMedium = factor.score >= 2500 && factor.score < 5000;
                    
                    const statusText = isGood ? 'Low Risk' : isMedium ? 'Medium Risk' : 'High Risk';
                    const statusColor = isGood ? 'text-green-600' : isMedium ? 'text-yellow-600' : 'text-orange-600';
                    const bgColor = isGood ? 'bg-green-50' : isMedium ? 'bg-yellow-50' : 'bg-orange-50';
                    const iconBg = isGood ? 'bg-green-500' : isMedium ? 'bg-yellow-500' : 'bg-orange-500';
                    
                    return (
                      <div key={index} className={`card p-6 ${bgColor} border-none`}>
                        <div className="flex items-start gap-4">
                          <div className={`w-12 h-12 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md ${iconBg}`}>
                            {isGood ? (
                              <CheckCircle className="h-6 w-6 text-white" />
                            ) : (
                              <AlertTriangle className="h-6 w-6 text-white" />
                            )}
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between mb-2">
                              <h3 className="text-base font-bold text-slate-900">{factor.name}</h3>
                              <div className="flex items-center gap-2">
                                <span className={`text-sm font-bold ${statusColor}`}>{statusText}</span>
                                <span className="text-lg font-bold text-slate-900">{factor.score}</span>
                              </div>
                            </div>
                            <p className="text-sm text-slate-700 mb-3">{factor.description}</p>
                            
                            {/* Progress bar */}
                            <div className="mb-3">
                              <div className="flex items-center justify-between text-xs text-slate-600 mb-1">
                                <span>Risk Level</span>
                                <span>{Math.round((factor.score / 10000) * 100)}%</span>
                              </div>
                              <div className="relative h-2 bg-white/60 rounded-full overflow-hidden">
                                <div 
                                  className={`absolute inset-y-0 left-0 rounded-full transition-all duration-700 ${
                                    isGood ? 'bg-green-500' : isMedium ? 'bg-yellow-500' : 'bg-orange-500'
                                  }`}
                                  style={{ width: `${Math.min((factor.score / 10000) * 100, 100)}%` }}
                                />
                              </div>
                            </div>
                            
                            {factor.detail && (
                              <p className="text-xs text-slate-600 bg-white/60 rounded-lg p-3">
                                💡 {factor.detail}
                              </p>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Recommendations Tab - Modern & Clean */}
              {activeTab === 'recommendations' && (
                <div className="space-y-4">
                  {[
                    {
                      icon: TrendingUp,
                      title: 'Diversify Portfolio',
                      priority: 'HIGH',
                      priorityColor: 'bg-orange-500',
                      description: 'Spread investments across protocols and assets to reduce concentration risk',
                      impact: 'High',
                      effort: 'Medium'
                    },
                    {
                      icon: Shield,
                      title: 'Monitor Security',
                      priority: 'MEDIUM',
                      priorityColor: 'bg-blue-500',
                      description: 'Review audit reports and set alerts for security incidents',
                      impact: 'Medium',
                      effort: 'Low'
                    },
                    {
                      icon: AlertTriangle,
                      title: 'Risk Management',
                      priority: 'HIGH',
                      priorityColor: 'bg-red-500',
                      description: 'Set up stop-loss mechanisms and position limits for protection',
                      impact: 'High',
                      effort: 'High'
                    }
                  ].map((rec, idx) => (
                    <div key={idx} className="card p-6 hover:border-yellow-200 transition-all">
                      <div className="flex items-start gap-4">
                        <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
                          <rec.icon className="h-6 w-6 text-slate-900" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-3 mb-3">
                            <h3 className="text-base font-bold text-slate-900">{rec.title}</h3>
                            <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-bold ${rec.priorityColor} text-white`}>
                              {rec.priority}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600 mb-4">
                            {rec.description}
                          </p>
                          <div className="flex items-center gap-4 text-sm">
                            <div className="flex items-center gap-2 font-semibold text-slate-700">
                              <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"></div>
                              <span>Impact: <span className="text-slate-900">{rec.impact}</span></span>
                            </div>
                            <div className="flex items-center gap-2 font-semibold text-slate-700">
                              <div className="w-2 h-2 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full"></div>
                              <span>Effort: <span className="text-slate-900">{rec.effort}</span></span>
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

            </div>
          ) : null}
        </div>
      </section>
    </>
  );
}
