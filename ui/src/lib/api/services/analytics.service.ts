/**
 * Analytics API Service
 * 
 * Handles dashboard analytics, statistics, and insights.
 * 
 * @author Silent Risk Team
 */

import { backendApi } from '../client';
import type { AxiosResponse } from 'axios';

// ============ TYPE DEFINITIONS ============

export interface AnalyticsOverview {
  total_analyses: number;
  total_users: number;
  avg_risk_score: number;
  recent_activity: number;
  risk_band_distribution?: Array<{
    band: string;
    count: number;
    percentage: number;
  }>;
  trend_data?: {
    date: string;
    analyses: number;
    avg_score: number;
  }[];
}

export interface Attestation {
  id: string;
  wallet_address: string;
  risk_band: string;
  attested_at: string;
  tx_hash?: string;
}

export interface MLStats {
  model_version: string;
  accuracy: number;
  last_trained: string;
  predictions_count: number;
  avg_latency_ms: number;
  avg_confidence: number;
}

export interface MLPerformanceData extends MLStats {
  performanceHistory?: Array<{
    timestamp: string;
    accuracy: number;
    latency: number;
  }>;
}

// ============ API SERVICE ============

export class AnalyticsService {
  /**
   * Get analytics overview
   */
  static async getOverview(): Promise<AnalyticsOverview> {
    const response: AxiosResponse<AnalyticsOverview> = await backendApi.get(
      '/analytics/overview'
    );
    return response.data;
  }

  /**
   * Get recent attestations
   */
  static async getRecentAttestations(limit = 10): Promise<Attestation[]> {
    const response: AxiosResponse<Attestation[]> = await backendApi.get(
      '/attestations/recent',
      { params: { limit } }
    );
    return response.data;
  }

  /**
   * Get ML model statistics with performance history
   */
  static async getMLStats(): Promise<MLPerformanceData> {
    const response: AxiosResponse<MLPerformanceData> = await backendApi.get('/ml/stats');
    
    // Backend returns performanceHistory from MongoDB
    // If empty, use empty array (no fake data)
    return response.data;
  }
}

export default AnalyticsService;

