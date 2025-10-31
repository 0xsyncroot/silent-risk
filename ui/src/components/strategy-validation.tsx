'use client';

import { useState } from 'react';
import { StrategyForm } from '@/components/strategy/strategy-form';
import { ValidationResults } from '@/components/strategy/validation-results';
import { ValidationResult } from '@/types/analysis';

export function StrategyValidation() {
  const [isValidating, setIsValidating] = useState(false);
  const [validationResult, setValidationResult] = useState<ValidationResult | null>(null);

  const handleValidate = async () => {
    setIsValidating(true);
    
    // Simulate real validation process
    setTimeout(() => {
      const isValid = Math.random() > 0.3; // 70% chance of passing
      setValidationResult({
        result: isValid ? 'PASSED' : 'FAILED',
        score: Math.floor(Math.random() * 40) + 60, // 60-100
        checks: [
          { 
            name: 'Take Profit Range', 
            status: isValid ? 'pass' : 'fail', 
            message: isValid ? 'Within acceptable range (2-20%)' : 'Too aggressive for swing trading' 
          },
          { 
            name: 'Stop Loss Ratio', 
            status: 'pass', 
            message: 'Good risk/reward ratio maintained' 
          },
          { 
            name: 'Position Sizing', 
            status: isValid ? 'pass' : 'warning', 
            message: isValid ? 'Conservative position sizing' : 'Consider reducing position size' 
          },
          { 
            name: 'Cooldown Period', 
            status: 'pass', 
            message: 'Appropriate for strategy type' 
          },
          { 
            name: 'Max Drawdown', 
            status: isValid ? 'pass' : 'fail', 
            message: isValid ? 'Within risk tolerance' : 'Exceeds recommended limits' 
          },
        ]
      });
      setIsValidating(false);
    }, 2500);
  };

  return (
    <section id="strategy" className="py-16 px-4 bg-white">
      <div className="container mx-auto max-w-6xl">
        <div className="text-center mb-16">
          <div className="inline-flex items-center px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 text-white text-xs font-semibold rounded-full mb-4 shadow-lg">
            STRATEGY VALIDATION
          </div>
          <h2 className="heading-2 mb-6 bg-gradient-to-r from-slate-900 to-slate-700 bg-clip-text text-transparent">
            Strategy Validation
          </h2>
          <p className="text-lg text-slate-600 max-w-3xl mx-auto leading-relaxed">
            Validate your trading strategies against proven risk management principles using encrypted parameter analysis.
          </p>
        </div>

        <div className="max-w-5xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <StrategyForm 
              onValidate={handleValidate}
              isValidating={isValidating}
            />
            <ValidationResults result={validationResult} />
          </div>
        </div>
      </div>
    </section>
  );
}