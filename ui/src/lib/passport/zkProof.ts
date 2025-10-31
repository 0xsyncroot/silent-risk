/**
 * Zero-Knowledge Proof Generation for Passport Minting
 * 
 * Uses snarkjs to generate Groth16 proofs in the browser.
 * Proves ownership of risk analysis commitment without revealing wallet.
 * 
 * Privacy Properties:
 * - Private inputs (wallet, secret, score) never leave browser
 * - Public inputs (commitment, nullifier) verifiable on-chain
 * - ZK proof convinces verifier without revealing secrets
 * 
 * @author Silent Risk Team
 */

// @ts-expect-error - snarkjs doesn't have TypeScript definitions
import { groth16 } from 'snarkjs';

/**
 * ZK proof structure (Groth16)
 */
export interface ZKProof {
  proof_a: [string, string];
  proof_b: [[string, string], [string, string]];
  proof_c: [string, string];
  publicSignals: string[];
}

/**
 * Passport claim data from backend
 */
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

/**
 * Circuit input structure
 */
interface CircuitInputs {
  walletAddress: string;
  secret: string;
  encryptedScore: string;
  commitment: string;
  nullifier: string;
  vaultAddress: string;
}

/**
 * Proof generation status
 */
export interface ProofGenerationStatus {
  stage: 'loading' | 'generating' | 'complete' | 'error';
  message: string;
  progress: number; // 0-100
  error?: string;
}

/**
 * Load ZK circuit files (WASM + proving key)
 * 
 * @param onProgress - Progress callback
 * @returns Promise that resolves when files loaded
 */
export async function loadCircuitFiles(
  onProgress?: (status: ProofGenerationStatus) => void
): Promise<void> {
  try {
    onProgress?.({
      stage: 'loading',
      message: 'Loading circuit files...',
      progress: 0
    });

    // Check if files exist
    const wasmPath = '/circuits/passport_proof.wasm';
    const zkeyPath = '/circuits/passport_proof_final.zkey';

    // Preload WASM (smaller, loads faster)
    onProgress?.({
      stage: 'loading',
      message: 'Loading circuit WASM...',
      progress: 25
    });

    const wasmResponse = await fetch(wasmPath);
    if (!wasmResponse.ok) {
      throw new Error('Circuit WASM not found. Please compile circuit first.');
    }

    // Preload zkey (larger, takes time)
    onProgress?.({
      stage: 'loading',
      message: 'Loading proving key (this may take a moment)...',
      progress: 50
    });

    const zkeyResponse = await fetch(zkeyPath);
    if (!zkeyResponse.ok) {
      throw new Error('Proving key not found. Please run trusted setup first.');
    }

    onProgress?.({
      stage: 'loading',
      message: 'Circuit files loaded successfully',
      progress: 100
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    onProgress?.({
      stage: 'error',
      message: 'Failed to load circuit files',
      progress: 0,
      error: errorMessage
    });
    throw error;
  }
}

/**
 * Generate zero-knowledge proof for passport minting
 * 
 * Steps:
 * 1. Prepare circuit inputs (private + public)
 * 2. Generate witness
 * 3. Generate Groth16 proof
 * 4. Format for smart contract
 * 
 * @param claimData - Passport claim data from backend
 * @param onProgress - Progress callback
 * @returns ZK proof ready for PassportNFT.mintPassport()
 */
export async function generatePassportProof(
  claimData: PassportClaimData,
  onProgress?: (status: ProofGenerationStatus) => void
): Promise<ZKProof> {
  try {
    // Step 1: Prepare circuit inputs
    onProgress?.({
      stage: 'generating',
      message: 'Preparing circuit inputs...',
      progress: 10
    });

    const inputs: CircuitInputs = {
      walletAddress: addressToBigInt(claimData.wallet_address),
      secret: hexToBigInt(claimData.secret),
      encryptedScore: hexToBigInt(claimData.encrypted_score),
      commitment: hexToBigInt(claimData.commitment),
      nullifier: hexToBigInt(claimData.nullifier),
      vaultAddress: addressToBigInt(claimData.vault_address)
    };

    console.log('Circuit inputs prepared:', {
      commitment: inputs.commitment.substring(0, 20) + '...',
      nullifier: inputs.nullifier.substring(0, 20) + '...'
    });

    // Step 2: Generate proof
    onProgress?.({
      stage: 'generating',
      message: 'Generating zero-knowledge proof (this may take 30-60 seconds)...',
      progress: 30
    });

    const { proof, publicSignals } = await groth16.fullProve(
      inputs,
      '/circuits/passport_proof.wasm',
      '/circuits/passport_proof_final.zkey'
    );

    onProgress?.({
      stage: 'generating',
      message: 'Proof generated, formatting for blockchain...',
      progress: 80
    });

    // Step 3: Format proof for smart contract
    const formattedProof = formatProofForContract(proof, publicSignals);

    onProgress?.({
      stage: 'complete',
      message: 'Proof generation complete!',
      progress: 100
    });

    console.log('ZK proof generated successfully');
    console.log('Public signals:', publicSignals);

    return formattedProof;
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    console.error('Proof generation failed:', error);
    
    onProgress?.({
      stage: 'error',
      message: 'Proof generation failed',
      progress: 0,
      error: errorMessage
    });

    throw new Error(`Failed to generate proof: ${errorMessage}`);
  }
}

/**
 * Verify proof locally before submitting to blockchain
 * 
 * @param proof - Generated ZK proof
 * @returns true if proof is valid
 */
export async function verifyProofLocally(proof: ZKProof): Promise<boolean> {
  try {
    const verificationKey = await fetch('/circuits/verification_key.json').then(r => r.json());
    
    const isValid = await groth16.verify(
      verificationKey,
      proof.publicSignals,
      {
        pi_a: proof.proof_a,
        pi_b: proof.proof_b,
        pi_c: proof.proof_c
      }
    );

    console.log('Local proof verification:', isValid ? 'PASSED ✓' : 'FAILED ✗');
    return isValid;
  } catch (error) {
    console.error('Local verification failed:', error);
    return false;
  }
}

// ============ HELPER FUNCTIONS ============

/**
 * Convert Ethereum address to BigInt string for circuit
 */
function addressToBigInt(address: string): string {
  // Remove 0x prefix and convert to BigInt
  const hex = address.startsWith('0x') ? address.slice(2) : address;
  return BigInt('0x' + hex).toString();
}

/**
 * Convert hex string to BigInt string for circuit
 */
function hexToBigInt(hex: string): string {
  // Remove 0x prefix
  const cleanHex = hex.startsWith('0x') ? hex.slice(2) : hex;
  return BigInt('0x' + cleanHex).toString();
}

/**
 * Format snarkjs proof for smart contract
 */
function formatProofForContract(
  proof: { pi_a: string[]; pi_b: string[][]; pi_c: string[] },
  publicSignals: string[]
): ZKProof {
  return {
    proof_a: [proof.pi_a[0], proof.pi_a[1]],
    proof_b: [
      [proof.pi_b[0][1], proof.pi_b[0][0]], // Note: reversed for Solidity
      [proof.pi_b[1][1], proof.pi_b[1][0]]
    ],
    proof_c: [proof.pi_c[0], proof.pi_c[1]],
    publicSignals
  };
}

/**
 * Estimate proof generation time based on device
 */
export function estimateProofTime(): string {
  // Check device performance (rough heuristic)
  const cpuCores = navigator.hardwareConcurrency || 4;
  
  if (cpuCores >= 8) {
    return '30-45 seconds';
  } else if (cpuCores >= 4) {
    return '45-60 seconds';
  } else {
    return '60-90 seconds';
  }
}

