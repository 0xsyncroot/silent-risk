/**
 * PassportSubmit Component
 * 
 * Handles submission of risk analysis to RiskScoreVault smart contract
 * This mints the privacy-preserving passport NFT on-chain
 */

'use client';

import { useState } from 'react';
import { Shield, CheckCircle, AlertTriangle, Loader2, ExternalLink } from 'lucide-react';
import { useRiskScoreVault } from '@/hooks/useRiskScoreVault';
import { useAccount } from 'wagmi';
import { toast } from '@/hooks/useToast';

interface PassportInfo {
  commitment?: string;
  nullifier_hash?: string;
  vault_address?: string;
  block_height?: number;
  risk_score?: number;  // Plaintext score to encrypt
  tx_hash?: string;
  status: 'ready_to_claim' | 'generation_failed' | 'claimed';
  error?: string;
}

interface PassportSubmitProps {
  passportInfo: PassportInfo;
  analyzedWalletAddress: string;  // The wallet that was analyzed
  onSubmitSuccess?: () => void;
}

export function PassportSubmit({ passportInfo, analyzedWalletAddress, onSubmitSuccess }: PassportSubmitProps) {
  const { address } = useAccount();
  const [txHash, setTxHash] = useState<string | null>(passportInfo.tx_hash || null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  
  const vaultAddress = passportInfo.vault_address as `0x${string}` | undefined;
  const {
    submitRiskAnalysis,
    isSubmitting,
    submitProgress,
    submitStatus
  } = useRiskScoreVault(vaultAddress);

  const handleSubmit = async () => {
    if (!address) {
      setSubmitError('Please connect your wallet');
      return;
    }

    if (!passportInfo.commitment || !passportInfo.vault_address || !passportInfo.risk_score) {
      setSubmitError('Missing passport data. Please refresh your analysis.');
      return;
    }

    if (!passportInfo.nullifier_hash || !passportInfo.block_height) {
      setSubmitError('Incomplete proof data. Please contact support.');
      return;
    }

    setSubmitError(null);

    const result = await submitRiskAnalysis(
      {
        commitment: passportInfo.commitment,
        nullifier_hash: passportInfo.nullifier_hash,
        vault_address: passportInfo.vault_address,
        block_height: passportInfo.block_height,
        risk_score: passportInfo.risk_score
      },
      analyzedWalletAddress  // Pass the analyzed wallet address
    );

    if (result.success && result.txHash) {
      setTxHash(result.txHash);
      toast({
        variant: 'success',
        title: '✅ Passport Minted Successfully!',
        description: 'Your privacy-preserving NFT passport has been minted on-chain.',
      });
      onSubmitSuccess?.();
    } else if (result.error) {
      setSubmitError(result.error);
      toast({
        variant: 'error',
        title: '❌ Submission Failed',
        description: result.error,
      });
    }
  };

  // Already submitted
  if (passportInfo.status === 'claimed' || txHash) {
    return (
      <div className="card p-6 bg-gradient-to-br from-green-50 to-emerald-50 border-green-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-green-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <CheckCircle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              ✅ Passport Minted Successfully!
            </h3>
            <p className="text-sm text-slate-700 mb-4">
              Your privacy-preserving risk passport has been minted on-chain. You can now use it to access DAOs and protocols.
            </p>
            {txHash && (
              <a
                href={`https://sepolia.etherscan.io/tx/${txHash}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center text-sm font-semibold text-green-700 hover:text-green-800 transition-colors"
              >
                View on Etherscan
                <ExternalLink className="h-4 w-4 ml-1" />
              </a>
            )}
          </div>
        </div>
      </div>
    );
  }

  // Generation failed
  if (passportInfo.status === 'generation_failed') {
    return (
      <div className="card p-6 bg-gradient-to-br from-red-50 to-orange-50 border-red-200">
        <div className="flex items-start gap-4">
          <div className="w-12 h-12 bg-red-500 rounded-xl flex items-center justify-center flex-shrink-0">
            <AlertTriangle className="h-6 w-6 text-white" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-bold text-slate-900 mb-2">
              Passport Generation Failed
            </h3>
            <p className="text-sm text-slate-700 mb-2">
              {passportInfo.error || 'Unable to generate passport data. Please try refreshing your analysis.'}
            </p>
            <button
              onClick={() => window.location.reload()}
              className="btn-secondary text-sm"
            >
              Refresh Analysis
            </button>
          </div>
        </div>
      </div>
    );
  }

  // Ready to submit
  return (
    <div className="space-y-4">
      {/* Main Submit Card */}
      <div className="card p-6 bg-gradient-to-br from-yellow-50 via-amber-50 to-yellow-50 border-yellow-200">
        <div className="flex items-start gap-4 mb-6">
          <div className="w-12 h-12 bg-gradient-to-br from-yellow-400 to-amber-500 rounded-xl flex items-center justify-center flex-shrink-0 shadow-md">
            <Shield className="h-6 w-6 text-slate-900" />
          </div>
          <div className="flex-1">
            <h3 className="text-lg font-bold text-slate-900 mb-2">
              🎉 Ready to Mint Your Privacy Passport!
            </h3>
            <p className="text-sm text-slate-700">
              Your risk analysis is complete. Submit it to the blockchain to mint your privacy-preserving NFT passport.
            </p>
          </div>
        </div>

        {/* What happens section */}
        <div className="bg-white/70 backdrop-blur-sm rounded-xl p-4 mb-6 border border-yellow-200">
          <h4 className="text-sm font-bold text-slate-900 mb-3">What happens when you submit:</h4>
          <div className="space-y-2">
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-green-600 font-bold flex-shrink-0">✓</span>
              <span className="text-slate-700">Your encrypted risk score is stored on-chain using FHE</span>
            </div>
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-green-600 font-bold flex-shrink-0">✓</span>
              <span className="text-slate-700">A privacy-preserving NFT passport is minted to your wallet</span>
            </div>
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-green-600 font-bold flex-shrink-0">✓</span>
              <span className="text-slate-700">DAOs can verify your risk level without seeing your exact score</span>
            </div>
            <div className="flex items-start space-x-2 text-sm">
              <span className="text-green-600 font-bold flex-shrink-0">✓</span>
              <span className="text-slate-700">Your identity remains completely anonymous</span>
            </div>
          </div>
        </div>

        {/* Progress during submission */}
        {isSubmitting && (
          <div className="mb-6">
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-semibold text-slate-700">{submitStatus}</span>
              <span className="text-sm font-bold text-slate-900">{submitProgress}%</span>
            </div>
            <div className="relative h-3 bg-slate-200 rounded-full overflow-hidden">
              <div 
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-yellow-400 to-amber-500 rounded-full transition-all duration-500"
                style={{ width: `${submitProgress}%` }}
              />
            </div>
          </div>
        )}

        {/* Error message */}
        {submitError && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl">
            <div className="flex items-start space-x-2">
              <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <h4 className="text-sm font-bold text-red-900 mb-1">Submission Failed</h4>
                <p className="text-sm text-red-700">{submitError}</p>
              </div>
            </div>
          </div>
        )}

        {/* Submit button */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting || !address}
          className="btn-primary w-full inline-flex items-center justify-center cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSubmitting ? (
            <>
              <Loader2 className="h-5 w-5 mr-2 animate-spin" />
              <span>Submitting to Blockchain...</span>
            </>
          ) : !address ? (
            <>
              <Shield className="h-5 w-5 mr-2" />
              <span>Connect Wallet to Submit</span>
            </>
          ) : (
            <>
              <Shield className="h-5 w-5 mr-2" />
              <span>Submit & Mint Passport NFT</span>
            </>
          )}
        </button>

        <p className="text-xs text-slate-600 text-center mt-3">
          This will require a blockchain transaction. Gas fees apply.
        </p>
      </div>

      {/* Technical details (collapsible) */}
      <details className="card p-4">
        <summary className="text-sm font-bold text-slate-900 cursor-pointer hover:text-slate-700">
          Technical Details
        </summary>
        <div className="mt-4 space-y-2 text-xs text-slate-600 font-mono">
          <div className="flex justify-between">
            <span>Commitment:</span>
            <span className="text-slate-900">{passportInfo.commitment?.substring(0, 10)}...</span>
          </div>
          <div className="flex justify-between">
            <span>Vault:</span>
            <span className="text-slate-900">{passportInfo.vault_address?.substring(0, 10)}...</span>
          </div>
          <div className="flex justify-between">
            <span>Block Height:</span>
            <span className="text-slate-900">{passportInfo.block_height}</span>
          </div>
        </div>
      </details>
    </div>
  );
}
