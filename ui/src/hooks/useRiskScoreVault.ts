/**
 * useRiskScoreVault Hook
 * 
 * Interacts with RiskScoreVault smart contract for submitting risk analysis
 * and minting privacy-preserving passport NFTs
 */

import { useState, useCallback } from 'react';
import { useWalletClient, usePublicClient } from 'wagmi';
import { parseAbi, type Address } from 'viem';
import { initializeFHEVM } from '@/lib/fhevm';
import { getStoredCommitment } from '@/lib/privacy';

/**
 * RiskScoreVault ABI
 * 
 * @dev externalEuint32 is FHE encrypted uint32 type from Zama
 * Represented as struct with (bytes handles, bytes inputProof)
 */
const RISK_SCORE_VAULT_ABI = parseAbi([
  'struct EncryptedScore { bytes handles; bytes inputProof; }',
  'function submitRiskAnalysis(bytes32 commitment, EncryptedScore encryptedScore, bytes scoreProof, uint256 blockHeight, bytes32 nullifierHash, bytes addressProof) external returns (uint8 band, uint256 passportTokenId)',
  'function passportNFT() external view returns (address)',
  'function getRiskBand(bytes32 commitment) external view returns (uint8)',
  'function getCommitmentMetadata(bytes32 commitment) external view returns (uint256 timestamp, uint256 blockHeight, uint8 band, address analyzer, bool exists)'
]);

interface PassportInfo {
  commitment: string;
  nullifier_hash: string;
  vault_address: string;
  block_height: number;
  risk_score: number;  // Plaintext score to encrypt with FHEVM
}

interface SubmitResult {
  success: boolean;
  txHash?: string;
  passportTokenId?: bigint;
  riskBand?: number;
  error?: string;
}

export function useRiskScoreVault(vaultAddress?: Address) {
  const { data: walletClient } = useWalletClient();
  const publicClient = usePublicClient();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitProgress, setSubmitProgress] = useState(0);
  const [submitStatus, setSubmitStatus] = useState('');

  /**
   * Submit risk analysis to vault and mint passport NFT
   * This encrypts the risk score using FHEVM and submits to blockchain
   */
  const submitRiskAnalysis = useCallback(async (
    passportInfo: PassportInfo,
    analyzedWalletAddress: string
  ): Promise<SubmitResult> => {
    if (!walletClient || !publicClient) {
      return { success: false, error: 'Wallet not connected' };
    }

    if (!vaultAddress) {
      return { success: false, error: 'Vault address not configured' };
    }

    setIsSubmitting(true);
    setSubmitProgress(0);
    setSubmitStatus('Retrieving commitment secret...');

    try {
      // Step 0: Get secret from localStorage
      const storedCommitment = getStoredCommitment(analyzedWalletAddress);
      if (!storedCommitment || !storedCommitment.secret) {
        throw new Error('Commitment secret not found. Please refresh your analysis.');
      }

      if (storedCommitment.commitment !== passportInfo.commitment) {
        throw new Error('Commitment mismatch. Please refresh your analysis.');
      }

      // Step 1: Initialize FHEVM for encryption
      setSubmitProgress(10);
      setSubmitStatus('Initializing FHEVM...');
      const chainId = await walletClient.getChainId();
      const fhevmInstance = await initializeFHEVM(chainId);
      
      setSubmitStatus('Encrypting risk score with FHE...');
      setSubmitProgress(30);

      // Step 2: Encrypt risk score using Zama FHEVM
      const userAddress = walletClient.account.address;
      const encryptedInput = fhevmInstance.createEncryptedInput(vaultAddress, userAddress);
      (encryptedInput as Record<string, unknown> & { add32: (value: number) => void }).add32(passportInfo.risk_score);  // Encrypt as uint32
      const encryptedData = await (encryptedInput as Record<string, unknown> & { encrypt: () => Promise<Record<string, unknown>> }).encrypt();
      
      // Validate encryption result
      if (!(encryptedData as Record<string, unknown> & { handles?: unknown[] }).handles?.[0] || !(encryptedData as Record<string, unknown>).inputProof) {
        throw new Error('FHE encryption failed: missing handles or proof');
      }

      setSubmitStatus('Preparing contract call...');
      setSubmitProgress(50);

      // Step 3: Prepare contract call data
      const commitment = passportInfo.commitment as `0x${string}`;
      const nullifierHash = passportInfo.nullifier_hash as `0x${string}`;
      const addressProof = storedCommitment.secret as `0x${string}`;  // Use secret from localStorage
      
      // FHE encrypted score structure
      const encryptedScore = {
        handles: ((encryptedData as Record<string, unknown> & { handles: unknown[] }).handles?.[0] || '') as `0x${string}`,
        inputProof: ((encryptedData as Record<string, unknown>).inputProof || '') as `0x${string}`
      };
      
      const scoreProof = ((encryptedData as Record<string, unknown>).inputProof || '') as `0x${string}`;
      const blockHeight = BigInt(passportInfo.block_height);

      setSubmitStatus('Submitting to blockchain...');
      setSubmitProgress(70);

      // Step 4: Call submitRiskAnalysis on RiskScoreVault
      const { request } = await publicClient.simulateContract({
        address: vaultAddress,
        abi: RISK_SCORE_VAULT_ABI,
        functionName: 'submitRiskAnalysis',
        args: [
          commitment,
          encryptedScore,
          scoreProof,
          blockHeight,
          nullifierHash,
          addressProof
        ],
        account: walletClient.account
      });

      setSubmitProgress(80);
      const hash = await walletClient.writeContract(request);

      setSubmitStatus('Waiting for confirmation...');
      setSubmitProgress(90);

      // Step 5: Wait for transaction confirmation
      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      if (receipt.status === 'success') {
        setSubmitProgress(100);
        setSubmitStatus('Success!');
        
        return {
          success: true,
          txHash: hash,
        };
      } else {
        return {
          success: false,
          error: 'Transaction failed'
        };
      }
    } catch (error: unknown) {
      console.error('Submit error:', error);
      
      let errorMessage = 'Failed to submit risk analysis';
      const err = error as Error;
      
      if (err.message?.includes('User rejected')) {
        errorMessage = 'Transaction was rejected';
      } else if (err.message?.includes('insufficient funds')) {
        errorMessage = 'Insufficient funds for gas';
      } else if (err.message?.includes('PassportNFTNotSet')) {
        errorMessage = 'Passport NFT contract not configured';
      } else if (err.message?.includes('InvalidProof')) {
        errorMessage = 'Invalid ZK proof';
      } else if (err.message?.includes('NullifierAlreadyUsed')) {
        errorMessage = 'This analysis has already been submitted';
      } else if (err.message?.includes('Commitment secret not found')) {
        errorMessage = err.message;
      } else if (err.message?.includes('Commitment mismatch')) {
        errorMessage = err.message;
      }
      
      return {
        success: false,
        error: errorMessage
      };
    } finally {
      setIsSubmitting(false);
    }
  }, [walletClient, publicClient, vaultAddress]);

  /**
   * Check if commitment exists in vault
   */
  const checkCommitmentExists = useCallback(async (
    commitment: string
  ): Promise<boolean> => {
    if (!publicClient || !vaultAddress) return false;

    try {
      const result = await publicClient.readContract({
        address: vaultAddress,
        abi: RISK_SCORE_VAULT_ABI,
        functionName: 'getCommitmentMetadata',
        args: [commitment as `0x${string}`]
      }) as readonly [bigint, bigint, number, `0x${string}`, boolean];

      // Result is [timestamp, blockHeight, band, analyzer, exists]
      return result[4]; // exists boolean
    } catch (error) {
      console.error('Check commitment error:', error);
      return false;
    }
  }, [publicClient, vaultAddress]);

  /**
   * Get passport NFT contract address
   */
  const getPassportNFTAddress = useCallback(async (): Promise<Address | null> => {
    if (!publicClient || !vaultAddress) return null;

    try {
      const address = await publicClient.readContract({
        address: vaultAddress,
        abi: RISK_SCORE_VAULT_ABI,
        functionName: 'passportNFT'
      });

      return address as Address;
    } catch (error) {
      console.error('Get passport NFT address error:', error);
      return null;
    }
  }, [publicClient, vaultAddress]);

  return {
    submitRiskAnalysis,
    checkCommitmentExists,
    getPassportNFTAddress,
    isSubmitting,
    submitProgress,
    submitStatus
  };
}