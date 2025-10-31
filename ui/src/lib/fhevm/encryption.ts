/**
 * FHEVM Encryption Operations
 * 
 * @description Core encryption functionality for FHEVM operations including
 * template ID and caption encryption with comprehensive error handling.
 * 
 * @author Zama Privacy Meme Battle Team
 * @version 1.0.0
 */

import { isAddress } from 'ethers';
import { EncryptedData, EncryptionParams, FHEVMError, FHEVMErrorType } from './types';
import { FHEVM_DATA_TYPES } from './constants';

// Forward declaration to avoid circular dependency
let getFHEVMInstance: () => Record<string, unknown>;

/**
 * Sets the FHEVM instance getter function
 * Used by the main FHEVM module to provide instance access
 * 
 * @param getter - Function that returns the FHEVM instance
 * @internal This function is for internal module use only
 */
export function setFHEVMInstanceGetter(getter: () => Record<string, unknown>): void {
  getFHEVMInstance = getter;
}

/**
 * Performs encryption with async scheduling to prevent UI blocking
 * 
 * @description Uses micro-task scheduling and yielding control back to the browser
 * to ensure the UI remains responsive during heavy encryption operations.
 * 
 * @param input - Prepared encrypted input ready for computation
 * @returns Promise resolving to encrypted result
 */
async function performAsyncEncryption(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  return new Promise((resolve, reject) => {
    // Yield control to browser to update UI
    setTimeout(async () => {
      try {
        // Use requestIdleCallback if available, otherwise setTimeout
        if (typeof requestIdleCallback !== 'undefined') {
          requestIdleCallback(async () => {
            try {
              const result = await (input as Record<string, unknown> & { encrypt: () => Promise<Record<string, unknown>> }).encrypt();
              resolve(result);
            } catch (error) {
              reject(error);
            }
          }, { timeout: 5000 });
        } else {
          // Fallback for browsers without requestIdleCallback
          const result = await (input as Record<string, unknown> & { encrypt: () => Promise<Record<string, unknown>> }).encrypt();
          resolve(result);
        }
      } catch (error) {
        reject(error);
      }
    }, 0); // Allow UI to update first
  });
}

/**
 * Validates encryption parameters
 * 
 * @description Ensures all required parameters are present and valid
 * before attempting encryption operations.
 * 
 * @param params - Encryption parameters to validate
 * @throws {FHEVMError} When parameters are invalid
 */
function validateEncryptionParams(params: EncryptionParams): void {
  const { contractAddress, userAddress } = params;

  if (!contractAddress || !userAddress) {
    throw new FHEVMError(
      FHEVMErrorType.INVALID_ADDRESS,
      'Contract address and user address are required for encryption',
      { contractAddress: !!contractAddress, userAddress: !!userAddress }
    );
  }

  if (!isAddress(contractAddress)) {
    throw new FHEVMError(
      FHEVMErrorType.INVALID_ADDRESS,
      'Invalid contract address format',
      { contractAddress }
    );
  }

  if (!isAddress(userAddress)) {
    throw new FHEVMError(
      FHEVMErrorType.INVALID_ADDRESS,
      'Invalid user address format',
      { userAddress }
    );
  }
}

/**
 * Creates an encrypted input instance for FHEVM operations
 * 
 * @description Factory function for creating encrypted inputs with proper
 * validation and error handling. Uses the FHEVM instance, not RelayerSDK.
 * 
 * @param fhevmInstance - Initialized FHEVM instance
 * @param params - Encryption parameters
 * @returns Encrypted input instance from FHEVM
 * @throws {FHEVMError} When FHEVM instance is not available or parameters are invalid
 */
function createEncryptedInput(fhevmInstance: Record<string, unknown>, params: EncryptionParams): Record<string, unknown> {
  validateEncryptionParams(params);
  
  if (!fhevmInstance) {
    throw new FHEVMError(
      FHEVMErrorType.INITIALIZATION_FAILED,
      'FHEVM instance not available'
    );
  }
  
  try {
    // Call createEncryptedInput on the FHEVM instance, not RelayerSDK
    return (fhevmInstance as Record<string, unknown> & { createEncryptedInput: (contract: string, user: string) => Record<string, unknown> }).createEncryptedInput(params.contractAddress, params.userAddress);
  } catch (error) {
    if (error instanceof FHEVMError) {
      throw error;
    }
    
    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      `Failed to create encrypted input: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { params, originalError: error }
    );
  }
}

/**
 * Encrypts a numeric value with specified bit size
 * 
 * @description Generic encryption function that supports different FHEVM
 * data types (uint8, uint16, uint32, uint64).
 * 
 * @param value - Numeric value to encrypt
 * @param bitSize - Target bit size (8, 16, 32, or 64)
 * @param params - Encryption parameters
 * @returns Encrypted data with proof
 * @throws {FHEVMError} When encryption fails or value is out of range
 */
async function encryptNumericValue(
  value: number,
  bitSize: 8 | 16 | 32 | 64,
  params: EncryptionParams
): Promise<EncryptedData> {
  // Validate value range based on bit size
  const dataType = Object.entries(FHEVM_DATA_TYPES).find(([, config]) => config.bits === bitSize)?.[1];
  if (!dataType) {
    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      `Unsupported bit size: ${bitSize}`,
      { value, bitSize }
    );
  }

  if (value < 0 || value > dataType.max) {
    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      `Value ${value} is out of range for ${bitSize}-bit unsigned integer (max: ${dataType.max})`,
      { value, bitSize, maxValue: dataType.max }
    );
  }

  try {
    // Get FHEVM instance for encryption
    const fhevmInstance = getFHEVMInstance();
    const input = createEncryptedInput(fhevmInstance, params);
    
    // Add value to input based on bit size
    switch (bitSize) {
      case 8:
        (input as Record<string, unknown> & { add8: (value: number) => void }).add8(value);
        break;
      case 16:
        (input as Record<string, unknown> & { add16: (value: number) => void }).add16(value);
        break;
      case 32:
        (input as Record<string, unknown> & { add32: (value: number) => void }).add32(value);
        break;
      case 64:
        (input as Record<string, unknown> & { add64: (value: number) => void }).add64(value);
        break;
      default:
        throw new Error(`Unsupported bit size: ${bitSize}`);
    }

    // Perform encryption with UI yielding to prevent blocking
    const encryptedInput = await performAsyncEncryption(input);

    // Validate encryption result
    if (!(encryptedInput as Record<string, unknown> & { handles?: unknown[] }).handles?.[0] || !(encryptedInput as Record<string, unknown>).inputProof) {
      throw new FHEVMError(
        FHEVMErrorType.ENCRYPTION_FAILED,
        'Invalid encryption result: missing handles or proof',
        { encryptedInput }
      );
    }

    return {
      encryptedData: ((encryptedInput as Record<string, unknown> & { handles?: unknown[] }).handles?.[0] || '') as string,
      proof: ((encryptedInput as Record<string, unknown>).inputProof || '') as string,
    };
  } catch (error) {
    if (error instanceof FHEVMError) {
      throw error;
    }

    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      `Encryption failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { value, bitSize, params, originalError: error }
    );
  }
}

/**
 * Encrypts a meme template ID for private voting
 * 
 * @description Encrypts template selection as uint8 (supports 0-255 templates).
 * Used for private template voting in meme battles.
 * 
 * @param templateId - Template ID to encrypt (0-255)
 * @param params - Encryption parameters
 * @returns Encrypted template data with proof
 * @throws {FHEVMError} When templateId is invalid or encryption fails
 */
export async function encryptTemplateId(
  templateId: number,
  params: EncryptionParams
): Promise<EncryptedData> {
  if (!Number.isInteger(templateId) || templateId < 0) {
    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      'Template ID must be a non-negative integer',
      { templateId }
    );
  }

  return encryptNumericValue(templateId, 8, params);
}

/**
 * Encrypts a caption ID for private submission
 * 
 * @description Encrypts caption selection as uint16 (supports 0-65535 captions).
 * Used for private caption submission in meme battles.
 * 
 * @param captionId - Caption ID to encrypt (0-65535)
 * @param params - Encryption parameters
 * @returns Encrypted caption data with proof
 * @throws {FHEVMError} When captionId is invalid or encryption fails
 */
export async function encryptCaptionId(
  captionId: number,
  params: EncryptionParams
): Promise<EncryptedData> {
  if (!Number.isInteger(captionId) || captionId < 0) {
    throw new FHEVMError(
      FHEVMErrorType.ENCRYPTION_FAILED,
      'Caption ID must be a non-negative integer',
      { captionId }
    );
  }

  return encryptNumericValue(captionId, 16, params);
}

/**
 * Encrypts a generic numeric vote value
 * 
 * @description General-purpose encryption for numeric voting data.
 * Supports various bit sizes based on value range requirements.
 * 
 * @param value - Numeric value to encrypt
 * @param bitSize - Target encryption bit size (8, 16, 32, or 64)
 * @param params - Encryption parameters
 * @returns Encrypted vote data with proof
 * @throws {FHEVMError} When value or parameters are invalid
 */
export async function encryptVoteValue(
  value: number,
  bitSize: 8 | 16 | 32 | 64,
  params: EncryptionParams
): Promise<EncryptedData> {
  return encryptNumericValue(value, bitSize, params);
}
