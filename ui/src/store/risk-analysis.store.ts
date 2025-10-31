/**
 * Risk Analysis Store (Zustand)
 * 
 * Centralized state management for risk analysis flow:
 * - Current analysis state
 * - Task progress tracking
 * - Error handling
 * - WebSocket updates
 * 
 * @author Silent Risk Team
 */

import { create } from 'zustand';
import { devtools, persist } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { RiskAnalysisResult, TaskStatusResponse } from '@/lib/api/services';

// ============ TYPE DEFINITIONS ============

export interface RiskAnalysisState {
  // Current analysis
  currentAnalysis: RiskAnalysisResult | null;
  analysisHistory: Map<string, RiskAnalysisResult>; // wallet -> analysis
  
  // Task tracking
  currentTaskId: string | null;
  taskProgress: number;
  taskStatus: 'idle' | 'pending' | 'processing' | 'completed' | 'failed';
  statusMessage: string;
  
  // Error handling
  error: string | null;
  
  // Loading states
  isAnalyzing: boolean;
  isFetchingHistory: boolean;
}

export interface RiskAnalysisActions {
  // Analysis operations
  setCurrentAnalysis: (analysis: RiskAnalysisResult | null) => void;
  cacheAnalysis: (walletAddress: string, analysis: RiskAnalysisResult) => void;
  getCachedAnalysis: (walletAddress: string) => RiskAnalysisResult | null;
  clearCurrentAnalysis: () => void;
  
  // Task tracking
  setTaskId: (taskId: string) => void;
  updateTaskProgress: (progress: number, message?: string) => void;
  updateTaskStatus: (status: TaskStatusResponse) => void;
  clearTask: () => void;
  
  // Error handling
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Loading states
  setAnalyzing: (isAnalyzing: boolean) => void;
  setFetchingHistory: (isFetching: boolean) => void;
  
  // Reset
  reset: () => void;
}

export type RiskAnalysisStore = RiskAnalysisState & RiskAnalysisActions;

// ============ INITIAL STATE ============

const initialState: RiskAnalysisState = {
  currentAnalysis: null,
  analysisHistory: new Map(),
  currentTaskId: null,
  taskProgress: 0,
  taskStatus: 'idle',
  statusMessage: '',
  error: null,
  isAnalyzing: false,
  isFetchingHistory: false,
};

// ============ STORE CREATION ============

export const useRiskAnalysisStore = create<RiskAnalysisStore>()(
  devtools(
    persist(
      immer((set, get) => ({
        ...initialState,

        // ===== ANALYSIS OPERATIONS =====
        
        setCurrentAnalysis: (analysis) => {
          set((state) => {
            state.currentAnalysis = analysis;
            state.error = null;
          });
        },

        cacheAnalysis: (walletAddress, analysis) => {
          set((state) => {
            state.analysisHistory.set(walletAddress.toLowerCase(), analysis);
            // Also update current if it's for the same wallet
            if (state.currentAnalysis?.wallet_address.toLowerCase() === walletAddress.toLowerCase()) {
              state.currentAnalysis = analysis;
            }
          });
        },

        getCachedAnalysis: (walletAddress) => {
          return get().analysisHistory.get(walletAddress.toLowerCase()) || null;
        },

        clearCurrentAnalysis: () => {
          set((state) => {
            state.currentAnalysis = null;
          });
        },

        // ===== TASK TRACKING =====
        
        setTaskId: (taskId) => {
          set((state) => {
            state.currentTaskId = taskId;
            state.taskProgress = 0;
            state.taskStatus = 'pending';
            state.statusMessage = 'Task submitted...';
          });
        },

        updateTaskProgress: (progress, message) => {
          set((state) => {
            state.taskProgress = progress;
            if (message) {
              state.statusMessage = message;
            }
          });
        },

        updateTaskStatus: (status) => {
          set((state) => {
            state.taskStatus = status.status;
            state.taskProgress = status.progress;
            
            if (status.message) {
              state.statusMessage = status.message;
            }
            
            if (status.status === 'completed' && status.result) {
              state.currentAnalysis = status.result;
              state.analysisHistory.set(
                status.result.wallet_address.toLowerCase(),
                status.result
              );
            }
            
            if (status.status === 'failed' && status.error) {
              state.error = status.error;
            }
          });
        },

        clearTask: () => {
          set((state) => {
            state.currentTaskId = null;
            state.taskProgress = 0;
            state.taskStatus = 'idle';
            state.statusMessage = '';
          });
        },

        // ===== ERROR HANDLING =====
        
        setError: (error) => {
          set((state) => {
            state.error = error;
          });
        },

        clearError: () => {
          set((state) => {
            state.error = null;
          });
        },

        // ===== LOADING STATES =====
        
        setAnalyzing: (isAnalyzing) => {
          set((state) => {
            state.isAnalyzing = isAnalyzing;
          });
        },

        setFetchingHistory: (isFetching) => {
          set((state) => {
            state.isFetchingHistory = isFetching;
          });
        },

        // ===== RESET =====
        
        reset: () => {
          set(initialState);
        },
      })),
      {
        name: 'silent-risk-analysis',
        partialize: (state) => ({
          // Only persist analysis history
          analysisHistory: Array.from(state.analysisHistory.entries()),
        }),
        merge: (persistedState: unknown, currentState) => {
          // Restore Map from persisted array
          const state = persistedState as { analysisHistory?: [string, RiskAnalysisResult][] } | null;
          return {
            ...currentState,
            analysisHistory: new Map(state?.analysisHistory || []),
          };
        },
      }
    ),
    { name: 'RiskAnalysisStore' }
  )
);

// ============ SELECTORS ============

/**
 * Memoized selectors for optimal re-rendering
 */
export const riskAnalysisSelectors = {
  currentAnalysis: (state: RiskAnalysisStore) => state.currentAnalysis,
  isAnalyzing: (state: RiskAnalysisStore) => state.isAnalyzing,
  error: (state: RiskAnalysisStore) => state.error,
  taskProgress: (state: RiskAnalysisStore) => ({
    progress: state.taskProgress,
    status: state.taskStatus,
    message: state.statusMessage,
  }),
  hasAnalysis: (state: RiskAnalysisStore) => !!state.currentAnalysis,
  analysisCount: (state: RiskAnalysisStore) => state.analysisHistory.size,
};

