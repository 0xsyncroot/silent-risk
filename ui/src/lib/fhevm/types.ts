/**
 * Type definitions for FHEVM operations
 * 
 * @description Provides TypeScript definitions for FHEVM SDK interactions,
 * encryption parameters, and result types.
 * 
 * @author Zama Privacy Meme Battle Team
 * @version 1.0.0
 */

/**
 * Represents encrypted data with its corresponding proof
 * Used for all FHEVM encryption operations
 */
export interface EncryptedData {
  /** Base64 encoded encrypted data handle */
  encryptedData: string;
  /** Cryptographic proof for the encrypted data */
  proof: string;
}

/**
 * Network configuration for FHEVM operations
 * Contains chain-specific settings and contract addresses
 */
export interface NetworkConfig {
  /** Blockchain network chain ID */
  chainId: number;
  /** RPC endpoint URL for network communication */
  rpcUrl: string;
  /** Human-readable network name */
  name: string;
  /** Access Control List contract address */
  aclAddress?: string;
}

/**
 * Parameters required for encryption operations
 * Contains all necessary addresses and user context
 */
export interface EncryptionParams {
  /** Target smart contract address for encryption context */
  contractAddress: string;
  /** User's wallet address for access control */
  userAddress: string;
}

/**
 * SDK instance interface for FHEVM operations
 * Wraps the underlying Zama RelayerSDK functionality
 */
export interface FHEVMSDKInstance {
  /** Creates encrypted input for contract interactions */
  createEncryptedInput: (contractAddress: string, userAddress: string) => Record<string, unknown>;
  /** SDK configuration for the current network */
  config: NetworkConfig;
}

/**
 * Supported data types for FHEVM encryption
 * Maps to the underlying euint types in FHEVM
 */
export type EncryptionDataType = 'uint8' | 'uint16' | 'uint32' | 'uint64';

/**
 * Error types that can occur during FHEVM operations
 * Provides specific error categorization for better handling
 */
export enum FHEVMErrorType {
  INITIALIZATION_FAILED = 'INITIALIZATION_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  NETWORK_UNSUPPORTED = 'NETWORK_UNSUPPORTED',
  SDK_NOT_LOADED = 'SDK_NOT_LOADED',
  INVALID_ADDRESS = 'INVALID_ADDRESS',
  WALLET_NOT_CONNECTED = 'WALLET_NOT_CONNECTED',
}

/**
 * Custom error class for FHEVM-specific errors
 * Provides structured error information with context
 */
export class FHEVMError extends Error {
  public readonly type: FHEVMErrorType;
  public readonly context?: Record<string, unknown>;

  constructor(type: FHEVMErrorType, message: string, context?: Record<string, unknown>) {
    super(message);
    this.name = 'FHEVMError';
    this.type = type;
    this.context = context;
  }
}
