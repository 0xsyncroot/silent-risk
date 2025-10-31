'use client';

import { useState } from 'react';
import { AnalysisInput } from '@/components/risk/analysis-input';
import { AnalysisResults } from '@/components/risk/analysis-results';
import { AnalysisResult } from '@/types/analysis';

export function RiskAnalysis() {
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisResult, setAnalysisResult] = useState<AnalysisResult | null>(null);

  const handleAnalyze = async () => {
    setIsAnalyzing(true);
    
    // Simulate real analysis process
    setTimeout(() => {
      setAnalysisResult({
        riskScore: 3250, // out of 10000
        riskBand: 'MEDIUM',
        confidence: 94,
        factors: [
          { name: 'Portfolio Diversification', score: 85, status: 'good' },
          { name: 'Volatility Exposure', score: 65, status: 'medium' },
          { name: 'Liquidity Risk', score: 78, status: 'good' },
          { name: 'Smart Contract Risk', score: 45, status: 'high' },
        ]
      });
      setIsAnalyzing(false);
    }, 3000);
  };

  return (
    <section id="risk-analysis" className="py-16 px-4 bg-gradient-to-br from-slate-50 to-blue-50/30">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-blue-600 to-purple-600 text-white text-xs font-semibold rounded-full mb-4 shadow-lg">
            AI ANALYSIS
          </div>
          <h2 className="heading-2 mb-6 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Risk Analysis
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Get comprehensive risk assessment of your DeFi positions without exposing your wallet address or transaction history.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <AnalysisInput 
              onAnalyze={handleAnalyze}
              isAnalyzing={isAnalyzing}
            />
            <AnalysisResults result={analysisResult} />
          </div>
        </div>
      </div>
    </section>
  );
}