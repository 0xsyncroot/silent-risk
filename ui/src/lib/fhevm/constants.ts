/**
 * FHEVM Constants and Configuration
 * 
 * @description Centralized configuration for FHEVM operations including
 * network settings, SDK URLs, and supported chains.
 * 
 * @author Zama Privacy Meme Battle Team
 * @version 1.0.0
 */

/**
 * Zama RelayerSDK CDN URL
 * Using version 0.2.0 for stable FHEVM operations
 */
export const ZAMA_SDK_CDN_URL = "https://cdn.zama.ai/relayer-sdk-js/0.2.0/relayer-sdk-js.umd.cjs";

/**
 * Supported blockchain networks for FHEVM operations
 * Currently limited to Sepolia testnet for this application
 */
export const SUPPORTED_NETWORKS = {
  /** Sepolia Ethereum Testnet - Primary network for this DApp */
  SEPOLIA: {
    chainId: 11155111,
    name: 'Sepolia Testnet',
    rpcUrl: 'https://sepolia.infura.io/v3/',
  },
  /** Zama Development Network - For internal testing */
  ZAMA_DEVNET: {
    chainId: 8009,
    name: 'Zama Devnet',
    rpcUrl: 'https://devnet.zama.ai/',
  },
} as const;

/**
 * Default network configuration for this application
 * Set to Sepolia as the primary supported network
 */
export const DEFAULT_NETWORK = SUPPORTED_NETWORKS.SEPOLIA;

/**
 * Network chain ID to name mapping
 * Used for user-friendly network identification
 */
export const CHAIN_ID_TO_NAME: Record<number, string> = {
  [SUPPORTED_NETWORKS.SEPOLIA.chainId]: SUPPORTED_NETWORKS.SEPOLIA.name,
  [SUPPORTED_NETWORKS.ZAMA_DEVNET.chainId]: SUPPORTED_NETWORKS.ZAMA_DEVNET.name,
};

/**
 * FHEVM encryption data type specifications
 * Defines the bit size and valid ranges for each type
 */
export const FHEVM_DATA_TYPES = {
  UINT8: { bits: 8, max: 255 },
  UINT16: { bits: 16, max: 65535 },
  UINT32: { bits: 32, max: 4294967295 },
  UINT64: { bits: 64, max: BigInt('18446744073709551615') },
} as const;

/**
 * SDK loading timeout in milliseconds
 * Maximum time to wait for SDK to load from CDN
 */
export const SDK_LOAD_TIMEOUT = 30000; // 30 seconds

/**
 * Global object key for the RelayerSDK
 * Used to access the SDK instance from window object
 */
export const RELAYER_SDK_GLOBAL_KEY = 'relayerSDK' as const;
