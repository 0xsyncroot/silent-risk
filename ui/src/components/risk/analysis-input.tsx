'use client';

import { useAccount } from 'wagmi';
import { Shield } from 'lucide-react';
import { InfoCard } from '@/components/ui/info-card';
import { StatusBadge } from '@/components/ui/status-badge';
import { Button } from '@/components/ui/button';

interface AnalysisInputProps {
  onAnalyze: () => void;
  isAnalyzing: boolean;
}

export function AnalysisInput({ onAnalyze, isAnalyzing }: AnalysisInputProps) {
  const { isConnected } = useAccount();

  return (
    <InfoCard>
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-blue-100 to-purple-100 rounded-xl border border-blue-200">
          <Shield className="h-6 w-6 text-blue-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">Privacy-First Analysis</h3>
      </div>

      <div className="space-y-6">
        {/* Connection Status */}
        <div className="flex items-center justify-between p-4 bg-[#f5f5f5] rounded-lg border border-gray-200">
          <span className="text-[#2c2c2c] font-medium">Wallet Status</span>
          <StatusBadge status={isConnected ? 'connected' : 'disconnected'}>
            {isConnected ? 'Connected' : 'Disconnected'}
          </StatusBadge>
        </div>

        {/* Privacy Notice */}
        <InfoCard variant="info" className="p-4">
          <div className="flex items-start space-x-3">
            <Shield className="h-5 w-5 text-[#3b82f6] mt-0.5" />
            <div>
              <h4 className="text-[#3b82f6] font-semibold mb-1">Complete Privacy</h4>
              <p className="text-sm text-[#2c2c2c]">
                Your wallet address is encrypted using commitment schemes. 
                Only you can link the analysis results back to your wallet.
              </p>
            </div>
          </div>
        </InfoCard>

        {/* Analysis Button */}
        <Button
          onClick={onAnalyze}
          disabled={!isConnected}
          loading={isAnalyzing}
          variant="zama-primary"
          className="w-full"
          size="lg"
          icon={!isAnalyzing}
        >
          {isAnalyzing ? 'Analyzing...' : 'Analyze Risk Score'}
        </Button>
      </div>
    </InfoCard>
  );
}
