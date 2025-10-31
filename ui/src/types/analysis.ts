export interface RiskFactor {
  name: string;
  score: number;
  status: 'good' | 'medium' | 'high';
}

export interface AnalysisResult {
  riskScore: number;
  riskBand: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  confidence: number;
  factors: RiskFactor[];
}

export interface ValidationCheck {
  name: string;
  status: 'pass' | 'warning' | 'fail';
  message: string;
}

export interface ValidationResult {
  result: 'PASSED' | 'FAILED';
  score: number;
  checks: ValidationCheck[];
}

export interface StrategyParams {
  takeProfit: string;
  stopLoss: string;
  positionSize: string;
  cooldown: string;
  maxDrawdown: string;
  strategyType: 'SCALPING' | 'SWING' | 'POSITION';
}
