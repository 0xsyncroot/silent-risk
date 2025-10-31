/**
 * Passport Store (Zustand)
 * 
 * Manages NFT passport claim state:
 * - Claim data
 * - ZK proof generation progress
 * - Mint status
 * - Embedded wallet balance
 * 
 * @author Silent Risk Team
 */

import { create } from 'zustand';
import { devtools } from 'zustand/middleware';
import { immer } from 'zustand/middleware/immer';
import type { PassportClaimData, PassportMintStatus } from '@/lib/api/services';

// ============ TYPE DEFINITIONS ============

export interface PassportState {
  // Claim data
  claimData: PassportClaimData | null;
  claimDataLoading: boolean;
  
  // ZK Proof generation
  proofGenerating: boolean;
  proofProgress: number;
  proofStage: 'idle' | 'loading' | 'generating' | 'complete' | 'error';
  proofMessage: string;
  
  // Mint status
  mintStatus: PassportMintStatus | null;
  minting: boolean;
  
  // Embedded wallet
  embeddedWalletBalance: string;
  checkingBalance: boolean;
  showFundModal: boolean;
  
  // Error
  error: string | null;
}

export interface PassportActions {
  // Claim data
  setClaimData: (data: PassportClaimData | null) => void;
  setClaimDataLoading: (loading: boolean) => void;
  clearClaimData: () => void;
  
  // ZK Proof
  setProofGenerating: (generating: boolean) => void;
  updateProofProgress: (progress: number, stage: PassportState['proofStage'], message: string) => void;
  resetProofProgress: () => void;
  
  // Mint status
  setMintStatus: (status: PassportMintStatus | null) => void;
  setMinting: (minting: boolean) => void;
  
  // Embedded wallet
  setEmbeddedWalletBalance: (balance: string) => void;
  setCheckingBalance: (checking: boolean) => void;
  setShowFundModal: (show: boolean) => void;
  
  // Error
  setError: (error: string | null) => void;
  clearError: () => void;
  
  // Reset
  reset: () => void;
}

export type PassportStore = PassportState & PassportActions;

// ============ INITIAL STATE ============

const initialState: PassportState = {
  claimData: null,
  claimDataLoading: false,
  proofGenerating: false,
  proofProgress: 0,
  proofStage: 'idle',
  proofMessage: '',
  mintStatus: null,
  minting: false,
  embeddedWalletBalance: '0',
  checkingBalance: false,
  showFundModal: false,
  error: null,
};

// ============ STORE CREATION ============

export const usePassportStore = create<PassportStore>()(
  devtools(
    immer((set) => ({
      ...initialState,

      // ===== CLAIM DATA =====
      
      setClaimData: (data) => {
        set((state) => {
          state.claimData = data;
          state.error = null;
        });
      },

      setClaimDataLoading: (loading) => {
        set((state) => {
          state.claimDataLoading = loading;
        });
      },

      clearClaimData: () => {
        set((state) => {
          state.claimData = null;
        });
      },

      // ===== ZK PROOF =====
      
      setProofGenerating: (generating) => {
        set((state) => {
          state.proofGenerating = generating;
        });
      },

      updateProofProgress: (progress, stage, message) => {
        set((state) => {
          state.proofProgress = progress;
          state.proofStage = stage;
          state.proofMessage = message;
        });
      },

      resetProofProgress: () => {
        set((state) => {
          state.proofProgress = 0;
          state.proofStage = 'idle';
          state.proofMessage = '';
          state.proofGenerating = false;
        });
      },

      // ===== MINT STATUS =====
      
      setMintStatus: (status) => {
        set((state) => {
          state.mintStatus = status;
        });
      },

      setMinting: (minting) => {
        set((state) => {
          state.minting = minting;
        });
      },

      // ===== EMBEDDED WALLET =====
      
      setEmbeddedWalletBalance: (balance) => {
        set((state) => {
          state.embeddedWalletBalance = balance;
        });
      },

      setCheckingBalance: (checking) => {
        set((state) => {
          state.checkingBalance = checking;
        });
      },

      setShowFundModal: (show) => {
        set((state) => {
          state.showFundModal = show;
        });
      },

      // ===== ERROR =====
      
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

      // ===== RESET =====
      
      reset: () => {
        set(initialState);
      },
    })),
    { name: 'PassportStore' }
  )
);

// ============ SELECTORS ============

export const passportSelectors = {
  claimData: (state: PassportStore) => state.claimData,
  hasClaimData: (state: PassportStore) => !!state.claimData,
  proofState: (state: PassportStore) => ({
    generating: state.proofGenerating,
    progress: state.proofProgress,
    stage: state.proofStage,
    message: state.proofMessage,
  }),
  embeddedWalletState: (state: PassportStore) => ({
    balance: state.embeddedWalletBalance,
    checking: state.checkingBalance,
    showFundModal: state.showFundModal,
  }),
  mintState: (state: PassportStore) => ({
    status: state.mintStatus,
    minting: state.minting,
  }),
};

