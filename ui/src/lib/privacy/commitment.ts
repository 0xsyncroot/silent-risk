/**
 * Commitment Generation for Privacy-Preserving Risk Analysis
 * 
 * This module implements the commitment scheme used to anonymize wallet addresses
 * while still allowing verifiable risk analysis.
 * 
 * Flow:
 * 1. User connects wallet (stays in browser)
 * 2. Generate random secret
 * 3. Create commitment = keccak256(wallet, secret)
 * 4. Send ONLY commitment to backend (wallet never leaves browser)
 * 5. Store (wallet, secret, commitment) in localStorage for ZK proof generation
 * 
 * Security Properties:
 * - Commitment is collision-resistant (keccak256)
 * - Secret prevents pre-image attacks
 * - Wallet address never transmitted to backend
 * - User maintains full control of their data
 * 
 * @module privacy/commitment
 */

import { keccak256, encodePacked } from 'viem';

/**
 * Commitment data structure stored in browser localStorage
 */
export interface CommitmentData {
  /** Original wallet address (never sent to backend) */
  walletAddress: string;
  
  /** Random secret used in commitment generation (keep private!) */
  secret: string;
  
  /** Commitment hash = keccak256(wallet, secret) */
  commitment: string;
  
  /** Timestamp when commitment was generated */
  generatedAt: string;
  
  /** Task ID received from backend (for polling status) */
  taskId?: string;
}

/**
 * Generate a cryptographically secure random secret
 * 
 * Uses Web Crypto API for strong randomness.
 * Secret is 32 bytes (256 bits) for security comparable to private keys.
 * 
 * @returns Hex-encoded random secret (0x...)
 */
function generateSecret(): string {
  const randomBytes = new Uint8Array(32);
  crypto.getRandomValues(randomBytes);
  return '0x' + Array.from(randomBytes)
    .map(byte => byte.toString(16).padStart(2, '0'))
    .join('');
}

/**
 * Generate commitment hash from wallet address and secret
 * 
 * Commitment Scheme:
 * - commitment = keccak256(abi.encodePacked(address, bytes32))
 * - Same format as Solidity: abi.encodePacked(address, bytes32)
 * - Ensures on-chain verification matches off-chain generation
 * 
 * Security:
 * - One-way function: cannot derive wallet from commitment
 * - Collision-resistant: extremely unlikely to find two inputs with same output
 * - Deterministic: same inputs always produce same output
 * 
 * @param walletAddress - Ethereum wallet address (0x...)
 * @param secret - Random secret (0x...)
 * @returns Commitment hash (0x...)
 */
export function generateCommitment(
  walletAddress: string,
  secret: string
): string {
  // Encode packed: same as Solidity's abi.encodePacked(address, bytes32)
  // This ensures compatibility with smart contract verification
  const encoded = encodePacked(
    ['address', 'bytes32'],
    [walletAddress as `0x${string}`, secret as `0x${string}`]
  );
  
  // Hash with keccak256 (same as Solidity's keccak256)
  const commitment = keccak256(encoded);
  
  return commitment;
}

/**
 * Create new commitment data for a wallet address
 * 
 * This function:
 * 1. Generates a random secret
 * 2. Creates commitment hash
 * 3. Returns complete commitment data structure
 * 
 * IMPORTANT: Store the returned data securely in localStorage!
 * The secret is required later for ZK proof generation.
 * 
 * @param walletAddress - Ethereum wallet address to create commitment for
 * @returns Complete commitment data including secret and commitment hash
 */
export function createCommitment(walletAddress: string): CommitmentData {
  const secret = generateSecret();
  const commitment = generateCommitment(walletAddress, secret);
  
  return {
    walletAddress,
    secret,
    commitment,
    generatedAt: new Date().toISOString()
  };
}

/**
 * Storage key for commitment data in localStorage
 * 
 * Format: commitment:{walletAddress}
 * This allows storing commitments for multiple wallets
 */
const STORAGE_KEY_PREFIX = 'silent-risk:commitment:';

/**
 * Store commitment data in browser localStorage
 * 
 * Security Considerations:
 * - localStorage is domain-specific (not shared across origins)
 * - Data persists across browser sessions
 * - Vulnerable to XSS attacks (ensure proper CSP headers)
 * - Not accessible to backend (stays in browser)
 * 
 * @param data - Commitment data to store
 */
export function storeCommitment(data: CommitmentData): void {
  const key = STORAGE_KEY_PREFIX + data.walletAddress.toLowerCase();
  localStorage.setItem(key, JSON.stringify(data));
}

/**
 * Retrieve commitment data from localStorage
 * 
 * @param walletAddress - Wallet address to retrieve commitment for
 * @returns Commitment data if found, null otherwise
 */
export function getStoredCommitment(walletAddress: string): CommitmentData | null {
  const key = STORAGE_KEY_PREFIX + walletAddress.toLowerCase();
  const stored = localStorage.getItem(key);
  
  if (!stored) {
    return null;
  }
  
  try {
    return JSON.parse(stored) as CommitmentData;
  } catch (error) {
    console.error('Failed to parse stored commitment:', error);
    return null;
  }
}

/**
 * Update task ID for an existing commitment
 * 
 * Called after backend returns task_id for tracking analysis progress.
 * 
 * @param walletAddress - Wallet address
 * @param taskId - Task ID from backend
 */
export function updateCommitmentTaskId(
  walletAddress: string,
  taskId: string
): void {
  const commitment = getStoredCommitment(walletAddress);
  
  if (commitment) {
    commitment.taskId = taskId;
    storeCommitment(commitment);
  }
}

/**
 * Clear commitment data from localStorage
 * 
 * Use this when user disconnects wallet or wants to reset their data.
 * 
 * @param walletAddress - Wallet address to clear commitment for
 */
export function clearCommitment(walletAddress: string): void {
  const key = STORAGE_KEY_PREFIX + walletAddress.toLowerCase();
  localStorage.removeItem(key);
}

/**
 * Get or create commitment for a wallet address
 * 
 * Convenience function that:
 * 1. Checks if commitment already exists
 * 2. Returns existing commitment if found
 * 3. Creates and stores new commitment if not found
 * 
 * @param walletAddress - Wallet address
 * @returns Existing or newly created commitment data
 */
export function ensureCommitment(walletAddress: string): CommitmentData {
  let commitment = getStoredCommitment(walletAddress);
  
  if (!commitment) {
    commitment = createCommitment(walletAddress);
    storeCommitment(commitment);
  }
  
  return commitment;
}

