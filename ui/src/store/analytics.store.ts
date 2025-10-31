/**
 * Analytics Store
 * 
 * Manages dashboard analytics state:
 * - Total analyses, attestations, strategies
 * - Risk band distribution
 * - Recent attestations
 * - ML model statistics
 * 
 * @author Silent Risk Team
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';

// ============ TYPE DEFINITIONS ============

export interface RiskBandDistribution {
  band: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
  count: number;
  percentage: number;
  color: string;
}

export interface RecentAttestation {
  id: string;
  riskBand: string;
  timestamp: string;
  verified: boolean;
}

export interface MLModelStats {
  accuracy: number;
  totalInferences: number;
  encryptedComputations: number;
  averageLatency?: number;
  modelVersion?: string;
  lastUpdated?: string;
}

export interface AnalyticsOverview {
  totalAnalyses: number;
  attestationsIssued: number;
  strategiesValidated: number;
  privacyScore: number;
  riskBandDistribution: RiskBandDistribution[];
  recentAttestations: RecentAttestation[];
  mlModelStats: MLModelStats;
}

export interface AnalyticsState {
  // Data
  overview: AnalyticsOverview | null;
  
  // Loading states
  loading: boolean;
  
  // Error state
  error: string | null;
  
  // Last fetch timestamp
  lastFetched: number | null;
}

export interface AnalyticsActions {
  // Set overview data
  setOverview: (overview: AnalyticsOverview) => void;
  
  // Set loading state
  setLoading: (loading: boolean) => void;
  
  // Set error
  setError: (error: string | null) => void;
  
  // Reset state
  reset: () => void;
}

export type AnalyticsStore = AnalyticsState & AnalyticsActions;

// ============ INITIAL STATE ============

const initialState: AnalyticsState = {
  overview: null,
  loading: false,
  error: null,
  lastFetched: null,
};

// ============ STORE ============

export const useAnalyticsStore = create<AnalyticsStore>()(
  devtools(
    immer((set) => ({
      ...initialState,
      
      setOverview: (overview) => set((state) => {
        state.overview = overview;
        state.lastFetched = Date.now();
        state.error = null;
      }),
      
      setLoading: (loading) => set((state) => {
        state.loading = loading;
      }),
      
      setError: (error) => set((state) => {
        state.error = error;
        state.loading = false;
      }),
      
      reset: () => set(initialState),
    })),
    { name: 'AnalyticsStore' }
  )
);

// ============ SELECTORS ============

export const analyticsSelectors = {
  overview: (state: AnalyticsStore) => state.overview,
  loading: (state: AnalyticsStore) => state.loading,
  error: (state: AnalyticsStore) => state.error,
  isStale: (state: AnalyticsStore) => {
    if (!state.lastFetched) return true;
    // Stale after 30 seconds
    return Date.now() - state.lastFetched > 30000;
  },
};

