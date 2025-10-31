/**
 * Wallet Signature Hook - Privy Edition
 * 
 * Handles EIP-191 message signing for wallet ownership verification.
 * 
 * IMPORTANT: 
 * - Privy embedded wallets CANNOT sign arbitrary messages
 * - Must use EXTERNAL wallet (MetaMask, Coinbase, etc) for signing
 * - User flow: Login X/Farcaster → Link external wallet → Sign with external wallet
 */

import { useState } from 'react';
import { useWallets, usePrivy } from '@privy-io/react-auth';

export interface SignatureResult {
  signature: string;
  message: string;
  timestamp: number;
  walletAddress: string;
}

export function useWalletSignature() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { wallets, ready } = useWallets();
  const { linkWallet } = usePrivy();

  /**
   * Generate EIP-191 message for signing
   * 
   * IMPORTANT: Format must match backend exactly!
   * Backend expects: "Silent Risk Analysis: {wallet} at {timestamp}"
   */
  const generateSignatureMessage = (walletAddress: string, timestamp: number): string => {
    return `Silent Risk Analysis: ${walletAddress} at ${timestamp}`;
  };

  /**
   * Get external wallet for signing
   * External wallets = wallets that are NOT embedded (MetaMask, Coinbase, etc)
   */
  const getExternalWallet = () => {
    if (!ready || wallets.length === 0) return null;
    
    // Find first external wallet (not embedded)
    // Privy embedded wallets have walletClientType === 'privy'
    const externalWallet = wallets.find(w => 
      w.walletClientType !== 'privy' && 
      w.walletClientType !== 'privy_embedded'
    );
    
    return externalWallet;
  };

  /**
   * Get embedded wallet (created by Privy on social login)
   */
  const getEmbeddedWallet = () => {
    if (!ready || wallets.length === 0) return null;
    
    return wallets.find(w => 
      w.walletClientType === 'privy' || 
      w.walletClientType === 'privy_embedded'
    );
  };

  /**
   * Check if user has linked an external wallet
   */
  const hasExternalWallet = (): boolean => {
    return !!getExternalWallet();
  };

  /**
   * Prompt user to link an external wallet
   */
  const connectExternalWallet = async (): Promise<boolean> => {
    try {
      setIsLoading(true);
      setError(null);

      // Privy's linkWallet() opens modal for user to connect MetaMask, Coinbase, etc
      await linkWallet();
      
      // Wait a bit for wallet to be added to wallets array
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      const externalWallet = getExternalWallet();
      if (!externalWallet) {
        throw new Error('Failed to connect external wallet');
      }

      setIsLoading(false);
      return true;

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to connect wallet';
      setError(errorMessage);
      setIsLoading(false);
      return false;
    }
  };

  /**
   * Sign message with external wallet
   * 
   * @param targetAddress - The wallet address to verify (can be different from signing wallet)
   * @returns Signature result or null if failed
   */
  const signMessage = async (targetAddress?: string): Promise<SignatureResult | null> => {
    try {
      setIsLoading(true);
      setError(null);

      // Wait for wallets to be ready
      if (!ready) {
        throw new Error('Wallets not ready');
      }

      // Check if user has external wallet
      const externalWallet = getExternalWallet();
      
      if (!externalWallet) {
        // No external wallet - need to connect one
        setError('Please connect an external wallet (MetaMask, Coinbase, etc) to sign');
        setIsLoading(false);
        return null;
      }

      // Use external wallet address if no target specified
      const addressToVerify = targetAddress || externalWallet.address;

      // Generate message to sign
      // Backend expects Unix timestamp in SECONDS, not milliseconds
      const timestamp = Math.floor(Date.now() / 1000);
      const message = generateSignatureMessage(addressToVerify, timestamp);

      console.log('Signing with external wallet:', {
        walletType: externalWallet.walletClientType,
        address: externalWallet.address
      });

      // Sign using Privy's wallet methods
      // Different wallet types have different signing methods
      let signature: string;

      // Type for wallet with sign method
      type WalletWithSign = { sign: (msg: string) => Promise<string> };
      type WalletWithSignMessage = { signMessage: (msg: string) => Promise<string> };

      if ('sign' in externalWallet) {
        // Standard Privy wallet interface
        signature = await (externalWallet as unknown as WalletWithSign).sign(message);
      } else if ('signMessage' in externalWallet) {
        // Some wallets use signMessage
        signature = await (externalWallet as unknown as WalletWithSignMessage).signMessage(message);
      } else {
        // Fallback: use ethers provider
        throw new Error('Wallet does not support message signing');
      }

      setIsLoading(false);

      return {
        signature,
        message,
        timestamp,
        walletAddress: addressToVerify.toLowerCase()
      };

    } catch (err: unknown) {
      const errorMessage = err instanceof Error ? err.message : 'Failed to sign message';
      setError(errorMessage);
      setIsLoading(false);
      
      console.error('Signature error:', err);
      return null;
    }
  };

  return {
    signMessage,
    connectExternalWallet,
    hasExternalWallet,
    getExternalWallet,
    getEmbeddedWallet,
    isLoading,
    error
  };
}
