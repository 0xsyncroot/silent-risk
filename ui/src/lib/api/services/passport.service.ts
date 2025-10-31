/**
 * Passport API Service
 * 
 * Handles NFT passport claim data and zero-knowledge proof minting.
 * 
 * @author Silent Risk Team
 */

import { backendApi } from '../client';
import type { AxiosResponse } from 'axios';

// ============ TYPE DEFINITIONS ============

export interface PassportClaimData {
  commitment: string;
  secret: string;
  nullifier: string;
  wallet_address: string;
  encrypted_score: string;
  vault_address: string;
  block_height: number;
  tx_hash: string | null;
}

export interface PassportMintStatus {
  wallet_address: string;
  token_id?: number;
  minted_at?: string;
  tx_hash?: string;
  status: 'not_minted' | 'pending' | 'minted' | 'failed';
}

// ============ API SERVICE ============

export class PassportService {
  /**
   * Get passport claim data for wallet
   * 
   * @param walletAddress - Ethereum wallet address
   * @returns Claim data for ZK proof generation
   */
  static async getClaimData(walletAddress: string): Promise<PassportClaimData> {
    const response: AxiosResponse<PassportClaimData> = await backendApi.get(
      `/passport/claim-data/${walletAddress}`
    );
    return response.data;
  }

  /**
   * Get passport mint status
   * 
   * @param walletAddress - Ethereum wallet address
   * @returns Current mint status
   */
  static async getMintStatus(walletAddress: string): Promise<PassportMintStatus> {
    const response: AxiosResponse<PassportMintStatus> = await backendApi.get(
      `/passport/status/${walletAddress}`
    );
    return response.data;
  }

  /**
   * Record successful passport mint (for tracking)
   * 
   * @param walletAddress - Ethereum wallet address
   * @param tokenId - NFT token ID
   * @param txHash - Mint transaction hash
   */
  static async recordMint(
    walletAddress: string,
    tokenId: number,
    txHash: string
  ): Promise<void> {
    await backendApi.post('/passport/record-mint', {
      wallet_address: walletAddress,
      token_id: tokenId,
      tx_hash: txHash,
    });
  }

  /**
   * Verify passport ownership (for future features)
   * 
   * @param walletAddress - Ethereum wallet address
   * @param tokenId - NFT token ID
   * @returns Verification result
   */
  static async verifyOwnership(
    walletAddress: string,
    tokenId: number
  ): Promise<{ valid: boolean; owner?: string }> {
    const response: AxiosResponse<{ valid: boolean; owner?: string }> = await backendApi.get(
      `/passport/verify/${walletAddress}/${tokenId}`
    );
    return response.data;
  }
}

export default PassportService;

