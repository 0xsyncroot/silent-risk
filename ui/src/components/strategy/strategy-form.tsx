'use client';

import { useState } from 'react';
import { useAccount } from 'wagmi';
import { Settings } from 'lucide-react';
import { InfoCard } from '@/components/ui/info-card';
import { Button } from '@/components/ui/button';
import { StrategyParams } from '@/types/analysis';

interface StrategyFormProps {
  onValidate: (params: StrategyParams) => void;
  isValidating: boolean;
}

export function StrategyForm({ onValidate, isValidating }: StrategyFormProps) {
  const { isConnected } = useAccount();
  const [strategy, setStrategy] = useState<StrategyParams>({
    takeProfit: '',
    stopLoss: '',
    positionSize: '',
    cooldown: '',
    maxDrawdown: '',
    strategyType: 'SWING'
  });

  const handleValidate = () => {
    onValidate(strategy);
  };

  const isFormValid = strategy.takeProfit && strategy.stopLoss && strategy.positionSize;

  return (
    <InfoCard>
      <div className="flex items-center space-x-3 mb-8">
        <div className="p-3 bg-gradient-to-br from-purple-100 to-pink-100 rounded-xl border border-purple-200">
          <Settings className="h-6 w-6 text-purple-600" />
        </div>
        <h3 className="text-2xl font-bold text-slate-900">Strategy Parameters</h3>
      </div>

      <div className="space-y-6">
        {/* Strategy Type */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Strategy Type
          </label>
          <select
            value={strategy.strategyType}
            onChange={(e) => setStrategy({...strategy, strategyType: e.target.value as StrategyParams['strategyType']})}
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          >
            <option value="SCALPING">Scalping (High Frequency)</option>
            <option value="SWING">Swing Trading (Medium Term)</option>
            <option value="POSITION">Position Trading (Long Term)</option>
          </select>
        </div>

        {/* Take Profit */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Take Profit (%)
          </label>
          <input
            type="number"
            value={strategy.takeProfit}
            onChange={(e) => setStrategy({...strategy, takeProfit: e.target.value})}
            placeholder="e.g., 5.0"
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          />
        </div>

        {/* Stop Loss */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Stop Loss (%)
          </label>
          <input
            type="number"
            value={strategy.stopLoss}
            onChange={(e) => setStrategy({...strategy, stopLoss: e.target.value})}
            placeholder="e.g., 2.5"
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          />
        </div>

        {/* Position Size */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Position Size (% of portfolio)
          </label>
          <input
            type="number"
            value={strategy.positionSize}
            onChange={(e) => setStrategy({...strategy, positionSize: e.target.value})}
            placeholder="e.g., 10"
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          />
        </div>

        {/* Cooldown */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Cooldown Period (hours)
          </label>
          <input
            type="number"
            value={strategy.cooldown}
            onChange={(e) => setStrategy({...strategy, cooldown: e.target.value})}
            placeholder="e.g., 24"
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          />
        </div>

        {/* Max Drawdown */}
        <div>
          <label className="block text-sm font-semibold text-slate-700 mb-3">
            Max Drawdown (%)
          </label>
          <input
            type="number"
            value={strategy.maxDrawdown}
            onChange={(e) => setStrategy({...strategy, maxDrawdown: e.target.value})}
            placeholder="e.g., 15"
            className="w-full px-4 py-3 bg-white border-2 border-slate-200 rounded-xl text-slate-700 focus:border-blue-500 focus:outline-none focus:ring-4 focus:ring-blue-100 transition-all duration-300"
          />
        </div>

        {/* Validate Button */}
        <Button
          onClick={handleValidate}
          disabled={!isConnected || !isFormValid}
          loading={isValidating}
          variant="zama-primary"
          className="w-full"
          size="lg"
          icon={!isValidating}
        >
          {isValidating ? 'Validating...' : 'Validate Strategy'}
        </Button>
      </div>
    </InfoCard>
  );
}
