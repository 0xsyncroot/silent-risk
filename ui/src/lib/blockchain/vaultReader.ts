/**
 * RiskScoreVault Contract Reader
 * 
 * This module provides functions to read data from the RiskScoreVault smart contract.
 * Used for retrieving historical risk analysis data when Redis cache expires.
 * 
 * Architecture:
 * - Frontend generates commitment in browser
 * - Worker analyzes wallet and stores encrypted score on-chain
 * - Backend caches results in Redis (1 hour TTL)
 * - After cache expiry, frontend queries contract directly
 * 
 * Privacy Properties:
 * - Contract stores ONLY commitment + encrypted score
 * - NO wallet addresses stored on-chain
 * - User queries with commitment (unlinkable to wallet)
 * - Results are FHE encrypted (only user can decrypt with secret)
 * 
 * @module blockchain/vaultReader
 */

import { createPublicClient, http, parseAbi } from 'viem';
import { sepolia } from 'viem/chains';

/**
 * RiskScoreVault contract ABI (minimal interface for reading)
 * 
 * Only includes functions needed for querying commitment metadata.
 * Full ABI is in contracts/artifacts.
 */
const VAULT_ABI = parseAbi([
  'function getCommitmentMetadata(bytes32 commitment) view returns (uint256 timestamp, uint256 blockHeight, uint8 band, address analyzer, bool exists)',
  'function isScoreBelowThreshold(bytes32 commitment, uint32 threshold) view returns (bool)'
]);

/**
 * RiskScoreVault contract address (deployed on Sepolia testnet)
 * 
 * TODO: Update this after deployment
 * TODO: Make configurable via environment variables for multi-chain support
 */
const VAULT_CONTRACT_ADDRESS = process.env.NEXT_PUBLIC_VAULT_CONTRACT_ADDRESS as `0x${string}` || '0x0000000000000000000000000000000000000000';

/**
 * Risk band enumeration (matches Solidity enum)
 * 
 * These values correspond to the RiskBand enum in RiskScoreVault.sol:
 * - NONE = 0: No analysis performed yet
 * - LOW = 1: Score 0-2000 (low risk)
 * - MEDIUM = 2: Score 2001-5000 (medium risk)
 * - HIGH = 3: Score 5001-7500 (high risk)
 * - CRITICAL = 4: Score 7501-10000 (critical risk)
 */
export enum RiskBand {
  NONE = 0,
  LOW = 1,
  MEDIUM = 2,
  HIGH = 3,
  CRITICAL = 4
}

/**
 * Commitment metadata returned from RiskScoreVault
 */
export interface CommitmentMetadata {
  /** Timestamp when commitment was recorded (Unix timestamp) */
  timestamp: bigint;
  
  /** Block height when commitment was recorded */
  blockHeight: bigint;
  
  /** Risk band (LOW, MEDIUM, HIGH, CRITICAL) */
  band: RiskBand;
  
  /** Address of the authorized analyzer that submitted this commitment */
  analyzer: string;
  
  /** Whether this commitment exists in the vault */
  exists: boolean;
}

/**
 * Create a public Viem client for reading from RiskScoreVault
 * 
 * Uses Sepolia testnet by default.
 * For production, switch to mainnet and use a reliable RPC provider.
 * 
 * @returns Configured public client for contract reads
 */
function createVaultClient() {
  return createPublicClient({
    chain: sepolia,
    transport: http(
      process.env.NEXT_PUBLIC_SEPOLIA_RPC_URL || 'https://rpc.sepolia.org'
    )
  });
}

/**
 * Query commitment metadata from RiskScoreVault contract
 * 
 * This function retrieves on-chain data for a commitment hash.
 * Use this when Redis cache expires to get historical analysis data.
 * 
 * Flow:
 * 1. User's browser has: (wallet, secret, commitment) from localStorage
 * 2. Redis cache expired (after 1 hour)
 * 3. Frontend calls this function with commitment hash
 * 4. Contract returns metadata (timestamp, block, risk band, etc.)
 * 5. Frontend displays results (without revealing wallet address)
 * 
 * Privacy:
 * - Query uses commitment hash (NOT wallet address)
 * - Contract has no way to link commitment to wallet
 * - Only user knows the connection (via secret stored in browser)
 * 
 * @param commitment - Commitment hash (0x...) generated in browser
 * @returns Commitment metadata if exists, null if not found
 * @throws Error if contract call fails or network error
 */
export async function getCommitmentMetadata(
  commitment: string
): Promise<CommitmentMetadata | null> {
  try {
    const client = createVaultClient();
    
    // Call contract's getCommitmentMetadata function
    const result = await client.readContract({
      address: VAULT_CONTRACT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'getCommitmentMetadata',
      args: [commitment as `0x${string}`]
    });
    
    const [timestamp, blockHeight, band, analyzer, exists] = result;
    
    // If commitment doesn't exist, return null
    if (!exists) {
      return null;
    }
    
    return {
      timestamp,
      blockHeight,
      band: band as RiskBand,
      analyzer,
      exists
    };
  } catch (error) {
    console.error('Failed to query RiskScoreVault:', error);
    throw new Error(
      'Failed to retrieve commitment data from blockchain. ' +
      'Please check your network connection and try again.'
    );
  }
}

/**
 * Check if a commitment's risk score is below a threshold
 * 
 * This is a privacy-preserving query that uses FHE comparison.
 * The actual score remains encrypted, but the contract can compare it.
 * 
 * Use Case:
 * - DAOs can verify: "Is this user's risk score below X?"
 * - Without learning the exact score or wallet address
 * 
 * @param commitment - Commitment hash
 * @param threshold - Risk score threshold (0-10000)
 * @returns True if score is below threshold, false otherwise
 * @throws Error if contract call fails
 */
export async function isScoreBelowThreshold(
  commitment: string,
  threshold: number
): Promise<boolean> {
  try {
    const client = createVaultClient();
    
    const result = await client.readContract({
      address: VAULT_CONTRACT_ADDRESS,
      abi: VAULT_ABI,
      functionName: 'isScoreBelowThreshold',
      args: [commitment as `0x${string}`, threshold]
    });
    
    return result;
  } catch (error) {
    console.error('Failed to check score threshold:', error);
    throw new Error('Failed to verify risk score threshold.');
  }
}

/**
 * Convert RiskBand enum to human-readable string
 * 
 * @param band - RiskBand enum value
 * @returns Readable risk band name
 */
export function riskBandToString(band: RiskBand): string {
  switch (band) {
    case RiskBand.NONE:
      return 'Not Analyzed';
    case RiskBand.LOW:
      return 'Low';
    case RiskBand.MEDIUM:
      return 'Medium';
    case RiskBand.HIGH:
      return 'High';
    case RiskBand.CRITICAL:
      return 'Critical';
    default:
      return 'Unknown';
  }
}

/**
 * Get color class for risk band (Tailwind CSS)
 * 
 * @param band - RiskBand enum value
 * @returns Tailwind CSS class string for styling
 */
export function riskBandColor(band: RiskBand): string {
  switch (band) {
    case RiskBand.LOW:
      return 'text-green-600 bg-green-50 border-green-200';
    case RiskBand.MEDIUM:
      return 'text-yellow-600 bg-yellow-50 border-yellow-200';
    case RiskBand.HIGH:
      return 'text-orange-600 bg-orange-50 border-orange-200';
    case RiskBand.CRITICAL:
      return 'text-red-600 bg-red-50 border-red-200';
    default:
      return 'text-gray-600 bg-gray-50 border-gray-200';
  }
}

