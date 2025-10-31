/**
 * FHEVM SDK Loader
 * 
 * @description Handles loading and initialization of the Zama RelayerSDK
 * from CDN with proper error handling and caching.
 * 
 * @author Zama Privacy Meme Battle Team
 * @version 1.0.0
 */

import { 
  ZAMA_SDK_CDN_URL, 
  SDK_LOAD_TIMEOUT, 
  RELAYER_SDK_GLOBAL_KEY 
} from './constants';
import { FHEVMError, FHEVMErrorType } from './types';

/**
 * SDK loading state management
 */
let isSDKLoaded = false;
let isSDKInitialized = false;
let loadingPromise: Promise<void> | null = null;

/**
 * Loads the Zama RelayerSDK from CDN
 * 
 * @description Dynamically loads the SDK script and makes it available
 * on the global window object. Implements caching to prevent multiple loads.
 * 
 * @returns Promise that resolves when SDK is loaded
 * @throws {FHEVMError} When running in non-browser environment or load fails
 */
export async function loadRelayerSDK(): Promise<void> {
  // Server-side rendering check
  if (typeof window === 'undefined') {
    throw new FHEVMError(
      FHEVMErrorType.SDK_NOT_LOADED,
      'SDK can only be loaded in browser environment',
      { environment: 'server' }
    );
  }

  // Return existing promise if already loading
  if (loadingPromise) {
    return loadingPromise;
  }

  // Return immediately if already loaded
  if (isSDKLoaded && (window as unknown as Record<string, unknown>)[RELAYER_SDK_GLOBAL_KEY]) {
    return Promise.resolve();
  }

  // Create new loading promise
  loadingPromise = new Promise((resolve, reject) => {
    // Check for existing script to prevent duplicate loads
    const existingScript = document.querySelector(`script[src="${ZAMA_SDK_CDN_URL}"]`);
    if (existingScript && (window as unknown as Record<string, unknown>)[RELAYER_SDK_GLOBAL_KEY]) {
      isSDKLoaded = true;
      resolve();
      return;
    }

    // Create and configure script element
    const script = document.createElement('script');
    script.src = ZAMA_SDK_CDN_URL;
    script.type = 'text/javascript';
    script.async = true;

    // Set up loading timeout
    const timeoutId = setTimeout(() => {
      reject(new FHEVMError(
        FHEVMErrorType.SDK_NOT_LOADED,
        `SDK loading timeout after ${SDK_LOAD_TIMEOUT}ms`,
        { url: ZAMA_SDK_CDN_URL, timeout: SDK_LOAD_TIMEOUT }
      ));
    }, SDK_LOAD_TIMEOUT);

    // Handle successful load
    script.onload = () => {
      clearTimeout(timeoutId);
      
      if ((window as unknown as Record<string, unknown>)[RELAYER_SDK_GLOBAL_KEY]) {
        isSDKLoaded = true;
        resolve();
      } else {
        reject(new FHEVMError(
          FHEVMErrorType.SDK_NOT_LOADED,
          'SDK loaded but not available on window object',
          { globalKey: RELAYER_SDK_GLOBAL_KEY }
        ));
      }
    };

    // Handle load errors
    script.onerror = () => {
      clearTimeout(timeoutId);
      reject(new FHEVMError(
        FHEVMErrorType.SDK_NOT_LOADED,
        'Failed to load RelayerSDK from CDN',
        { url: ZAMA_SDK_CDN_URL }
      ));
    };

    // Append script to document head
    document.head.appendChild(script);
  });

  return loadingPromise;
}

/**
 * Initializes the loaded RelayerSDK
 * 
 * @description Calls the SDK initialization method and caches the result.
 * Must be called after successful SDK loading.
 * 
 * @returns Promise that resolves when SDK is initialized
 * @throws {FHEVMError} When SDK is not loaded or initialization fails
 */
export async function initializeRelayerSDK(): Promise<void> {
  // Check if SDK is loaded
  const relayerSDK = (window as unknown as Record<string, unknown>)[RELAYER_SDK_GLOBAL_KEY];
  if (!relayerSDK) {
    throw new FHEVMError(
      FHEVMErrorType.SDK_NOT_LOADED,
      'RelayerSDK not loaded. Call loadRelayerSDK() first.',
      { globalKey: RELAYER_SDK_GLOBAL_KEY }
    );
  }

  // Return if already initialized
  if (isSDKInitialized || (relayerSDK as Record<string, unknown> & { __initialized__?: boolean }).__initialized__) {
    return;
  }

  try {
    // Initialize SDK
    const initResult = await (relayerSDK as Record<string, unknown> & { initSDK: () => Promise<boolean> }).initSDK();
    
    if (!initResult) {
      throw new FHEVMError(
        FHEVMErrorType.INITIALIZATION_FAILED,
        'RelayerSDK initialization returned false'
      );
    }

    // Cache initialization state
    (relayerSDK as Record<string, unknown>).__initialized__ = true;
    isSDKInitialized = true;
  } catch (error) {
    throw new FHEVMError(
      FHEVMErrorType.INITIALIZATION_FAILED,
      `RelayerSDK initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      { originalError: error }
    );
  }
}

/**
 * Gets the loaded and initialized RelayerSDK instance
 * 
 * @description Provides access to the global SDK instance with type safety.
 * Ensures SDK is properly loaded before returning.
 * 
 * @returns The RelayerSDK instance
 * @throws {FHEVMError} When SDK is not loaded or initialized
 */
export function getRelayerSDK(): Record<string, unknown> {
  const relayerSDK = (window as unknown as Record<string, unknown>)[RELAYER_SDK_GLOBAL_KEY];
  
  if (!relayerSDK) {
    throw new FHEVMError(
      FHEVMErrorType.SDK_NOT_LOADED,
      'RelayerSDK not available. Ensure loadRelayerSDK() was called successfully.',
      { globalKey: RELAYER_SDK_GLOBAL_KEY }
    );
  }

  if (!isSDKInitialized && !(relayerSDK as Record<string, unknown> & { __initialized__?: boolean }).__initialized__) {
    throw new FHEVMError(
      FHEVMErrorType.INITIALIZATION_FAILED,
      'RelayerSDK not initialized. Call initializeRelayerSDK() first.'
    );
  }

  return relayerSDK as Record<string, unknown>;
}

/**
 * Resets SDK loading state
 * 
 * @description Used for testing and development to reset the SDK state.
 * Should not be used in production code.
 */
export function resetSDKState(): void {
  isSDKLoaded = false;
  isSDKInitialized = false;
  loadingPromise = null;
}
