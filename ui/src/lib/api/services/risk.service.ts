/**
 * Risk Analysis API Service
 * 
 * Handles all risk analysis related API calls with proper typing and error handling.
 * 
 * @author Silent Risk Team
 */

import { backendApi } from '../client';
import type { AxiosResponse } from 'axios';

// ============ TYPE DEFINITIONS ============

export interface RiskFactor {
  name: string;
  score: number;
  status: 'good' | 'medium' | 'high';
  description?: string;
}

export interface PassportInfo {
  commitment?: string;
  vault_address?: string;
  block_height?: number;
  tx_hash?: string | null;
  status: 'ready_to_claim' | 'generation_failed' | 'claimed' | 'claiming';
  error?: string;
}

export interface RiskAnalysisResult {
  wallet_address: string;
  risk_score: number;
  risk_band: 'low' | 'medium' | 'high' | 'critical';
  confidence: number;
  factors: RiskFactor[];
  analyzed_at: string;
  cached: boolean;
  passport?: PassportInfo;
}

export interface AnalyzeRiskRequest {
  commitment: string;
  wallet_address: string;
  signature: string;
  message: string;
  timestamp: number;
  force_refresh?: boolean;
}

export interface AnalyzeRiskResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result?: RiskAnalysisResult;
}

export interface TaskStatusResponse {
  task_id: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  progress: number;
  message?: string;
  result?: RiskAnalysisResult;
  error?: string;
}

// ============ API SERVICE ============

export class RiskAnalysisService {
  /**
   * Submit risk analysis request
   * 
   * @param request - Analysis request data
   * @returns Task ID and initial status
   */
  static async analyzeRisk(request: AnalyzeRiskRequest): Promise<AnalyzeRiskResponse> {
    const response: AxiosResponse<AnalyzeRiskResponse> = await backendApi.post(
      '/risk/analyze',
      request
    );
    return response.data;
  }

  /**
   * Get task status and result
   * 
   * @param taskId - Task identifier
   * @returns Current task status and result if completed
   */
  static async getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
    const response: AxiosResponse<TaskStatusResponse> = await backendApi.get(
      `/risk/status/${taskId}`
    );
    return response.data;
  }

  /**
   * Get cached analysis by wallet address
   * 
   * @param walletAddress - Ethereum wallet address
   * @returns Cached analysis result or null
   */
  static async getCachedAnalysis(walletAddress: string): Promise<RiskAnalysisResult | null> {
    try {
      const response: AxiosResponse<RiskAnalysisResult> = await backendApi.get(
        `/risk/cache/${walletAddress}`
      );
      return response.data;
    } catch {
      // 404 means no cache, return null
      return null;
    }
  }

  /**
   * Verify wallet signature (for testing)
   * 
   * @param walletAddress - Ethereum wallet address
   * @param signature - EIP-191 signature
   * @param message - Signed message
   * @returns Verification result
   */
  static async verifySignature(
    walletAddress: string,
    signature: string,
    message: string
  ): Promise<{ valid: boolean; recovered_address?: string }> {
    const response: AxiosResponse<{ valid: boolean; recovered_address?: string }> = await backendApi.post(
      '/risk/verify-signature',
      {
        wallet_address: walletAddress,
        signature,
        message,
      }
    );
    return response.data;
  }
}

export default RiskAnalysisService;

