'use client';

import { Settings, CheckCircle, XCircle, AlertTriangle } from 'lucide-react';
import { InfoCard } from '@/components/ui/info-card';
import { Button } from '@/components/ui/button';
import { ValidationResult } from '@/types/analysis';

interface ValidationResultsProps {
  result: ValidationResult | null;
}

export function ValidationResults({ result }: ValidationResultsProps) {
  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass': return <CheckCircle className="h-5 w-5 text-green-600" />;
      case 'warning': return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case 'fail': return <XCircle className="h-5 w-5 text-red-600" />;
      default: return <AlertTriangle className="h-5 w-5 text-gray-600" />;
    }
  };

  const getResultColor = (result: string) => {
    switch (result) {
      case 'PASSED': return 'text-green-600 bg-green-100 border-green-200';
      case 'FAILED': return 'text-red-600 bg-red-100 border-red-200';
      default: return 'text-gray-600 bg-gray-100 border-gray-200';
    }
  };

  return (
    <InfoCard>
      <h3 className="text-2xl font-semibold text-black mb-6">Validation Results</h3>

      {!result ? (
        <div className="flex flex-col items-center justify-center h-64 text-[#444]">
          <Settings className="h-12 w-12 mb-4 opacity-50" />
          <p>Enter strategy parameters and validate to see results</p>
        </div>
      ) : (
        <div className="space-y-6">
          {/* Overall Result */}
          <div className="text-center p-6 bg-[#f5f5f5] rounded-lg border border-gray-200">
            <div className={`inline-flex px-4 py-2 rounded-full text-lg font-bold mb-3 border ${getResultColor(result.result)}`}>
              {result.result}
            </div>
            <div className="text-3xl font-bold text-black mb-2">
              {result.score}%
            </div>
            <div className="text-sm text-[#444]">
              Strategy Validation Score
            </div>
          </div>

          {/* Validation Checks */}
          <div className="space-y-3">
            <h4 className="text-lg font-semibold text-black">Validation Checks</h4>
            {result.checks.map((check, index) => (
              <div key={index} className="p-4 bg-[#f5f5f5] rounded-lg border border-gray-200">
                <div className="flex items-center space-x-3 mb-2">
                  {getStatusIcon(check.status)}
                  <span className="text-black font-medium">{check.name}</span>
                </div>
                <p className="text-sm text-[#2c2c2c] ml-8">{check.message}</p>
              </div>
            ))}
          </div>

          {/* Actions */}
          <div className="flex space-x-3">
            <Button variant="zama-secondary" className="flex-1">
              Save Strategy
            </Button>
            <Button variant="zama-secondary" className="flex-1">
              Export Config
            </Button>
          </div>
        </div>
      )}
    </InfoCard>
  );
}
