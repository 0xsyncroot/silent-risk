'use client';

import { TrendingUp, CheckCircle, AlertTriangle, TrendingDown } from 'lucide-react';
import { InfoCard } from '@/components/ui/info-card';
import { Button } from '@/components/ui/button';
import { AnalysisResult } from '@/types/analysis';

interface AnalysisResultsProps {
  result: AnalysisResult | null;
}

export function AnalysisResults({ result }: AnalysisResultsProps) {
  const getRiskColor = (band: string) => {
    switch (band) {
      case 'LOW': return 'text-green-600 bg-green-100 border-green-200';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100 border-yellow-200';
      case 'HIGH': return 'text-orange-600 bg-orange-100 border-orange-200';
      case 'CRITICAL': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  const getFactorIcon = (status: string) => {
    switch (status) {
      case 'good': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'medium': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'high': return <TrendingDown className="h-5 w-5 text-red-600" />;
      default: return <TrendingUp className="h-5 w-5 text-gray-600" />;
    }
  };

  return (
    <InfoCard>
      <h3 className="text-2xl font-semibold text-black mb-6">Analysis Results</h3>

      {!result ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#444]">
          <TrendingUp className="h-12 w-12 mb-4 opacity-50" />
          <p>Connect wallet and run analysis to see results</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Risk Score */}
          <div className="text-center p-6 bg-[#f5f5f5] rounded-lg border border-gray-200">
            <div className="text-4xl font-bold text-black mb-2">
              {(result.riskScore / 100).toFixed(1)}%
            </div>
            <div className={`inline-flex px-3 py-1 rounded-full text-sm font-semibold border ${getRiskColor(result.riskBand)}`}>
              {result.riskBand} RISK
            </div>
            <div className="text-sm text-[#444] mt-2">
              Confidence: {result.confidence}%
            </div>
          </div>

          {/* Risk Factors */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-black">Risk Factors</h4>
            {result.factors.map((factor, index) => (
              <div key={index} className="flex items-center justify-between p-3 bg-[#f5f5f5] rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3">
                  {getFactorIcon(factor.status)}
                  <span className="text-[#2c2c2c]">{factor.name}</span>
                </div>
                <span className="text-black font-semibold">{factor.score}%</span>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button variant="zama-secondary" className="flex-1">
              Get NFT Certificate
            </Button>
            <Button variant="zama-secondary" className="flex-1">
              Export Report
            </Button>
          </div>
        </div>
      )}
    </InfoCard>
  );
}
