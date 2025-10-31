/**
 * FHEVM Network Utilities
 * 
 * @description Network-related utilities for FHEVM operations including
 * network validation, configuration, and support checks.
 * 
 * @author Zama Privacy Meme Battle Team
 * @version 1.0.0
 */

import { SUPPORTED_NETWORKS, CHAIN_ID_TO_NAME, DEFAULT_NETWORK } from './constants';
import { NetworkConfig, FHEVMError, FHEVMErrorType } from './types';

/**
 * Checks if a network is supported by FHEVM operations
 * 
 * @description Validates whether the specified chain ID is supported
 * for FHEVM encryption and contract interactions.
 * 
 * @param chainId - Blockchain network chain ID
 * @returns True if network is supported, false otherwise
 */
export function isFHEVMSupported(chainId: number): boolean {
  return Object.values(SUPPORTED_NETWORKS).some(network => network.chainId === chainId);
}

/**
 * Gets human-readable network name from chain ID
 * 
 * @description Converts numeric chain ID to user-friendly network name.
 * Returns "Unknown Network" for unsupported chains.
 * 
 * @param chainId - Blockchain network chain ID
 * @returns Human-readable network name
 */
export function getNetworkName(chainId: number): string {
  return CHAIN_ID_TO_NAME[chainId] || `Unknown Network (${chainId})`;
}

/**
 * Gets network configuration by chain ID
 * 
 * @description Retrieves complete network configuration for supported chains.
 * Includes RPC URL, name, and other network-specific settings.
 * 
 * @param chainId - Blockchain network chain ID
 * @returns Network configuration object
 * @throws {FHEVMError} When network is not supported
 */
export function getNetworkConfig(chainId: number): NetworkConfig {
  const network = Object.values(SUPPORTED_NETWORKS).find(net => net.chainId === chainId);
  
  if (!network) {
    throw new FHEVMError(
      FHEVMErrorType.NETWORK_UNSUPPORTED,
      `Network with chain ID ${chainId} is not supported`,
      { chainId, supportedNetworks: Object.values(SUPPORTED_NETWORKS) }
    );
  }

  return {
    chainId: network.chainId,
    rpcUrl: network.rpcUrl,
    name: network.name,
  };
}

/**
 * Validates network compatibility for FHEVM operations
 * 
 * @description Ensures the specified network supports FHEVM operations.
 * Throws detailed error with supported alternatives if validation fails.
 * 
 * @param chainId - Chain ID to validate
 * @throws {FHEVMError} When network is not supported
 */
export function validateNetworkSupport(chainId: number): void {
  if (!isFHEVMSupported(chainId)) {
    const supportedNames = Object.values(SUPPORTED_NETWORKS).map(n => `${n.name} (${n.chainId})`);
    
    throw new FHEVMError(
      FHEVMErrorType.NETWORK_UNSUPPORTED,
      `Network ${getNetworkName(chainId)} is not supported for FHEVM operations. Supported networks: ${supportedNames.join(', ')}`,
      { 
        chainId, 
        networkName: getNetworkName(chainId),
        supportedNetworks: supportedNames 
      }
    );
  }
}

/**
 * Gets the default network configuration
 * 
 * @description Returns the default network configuration for this application.
 * Used as fallback and primary network recommendation.
 * 
 * @returns Default network configuration
 */
export function getDefaultNetworkConfig(): NetworkConfig {
  return {
    chainId: DEFAULT_NETWORK.chainId,
    rpcUrl: DEFAULT_NETWORK.rpcUrl,
    name: DEFAULT_NETWORK.name,
  };
}

/**
 * Gets all supported networks
 * 
 * @description Returns complete list of networks that support FHEVM operations.
 * Used for network selection and validation purposes.
 * 
 * @returns Array of supported network configurations
 */
export function getSupportedNetworks(): NetworkConfig[] {
  return Object.values(SUPPORTED_NETWORKS).map(network => ({
    chainId: network.chainId,
    rpcUrl: network.rpcUrl,
    name: network.name,
  }));
}

/**
 * Checks if current network is the default/recommended network
 * 
 * @description Determines if the specified chain ID matches the
 * application's default network configuration.
 * 
 * @param chainId - Chain ID to check
 * @returns True if matches default network, false otherwise
 */
export function isDefaultNetwork(chainId: number): boolean {
  return chainId === DEFAULT_NETWORK.chainId;
}
