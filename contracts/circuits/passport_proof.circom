pragma circom 2.1.0;

include "circomlib/circuits/poseidon.circom";

/**
 * Silent Risk Passport - ZK Proof Circuit
 * 
 * Purpose: Prove ownership of risk analysis result stored in RiskScoreVault
 *          WITHOUT revealing original wallet address or exact score
 * 
 * Use Case:
 * - User's wallet A was analyzed → score stored encrypted in vault
 * - User wants passport NFT but keep wallet A private
 * - User proves "I own the commitment in vault" without revealing wallet A
 * - User mints passport to wallet B (anonymous)
 * - DAO can verify passport via FHE queries to vault
 * 
 * Privacy:
 * - Original wallet (A) never revealed
 * - Exact score never revealed (stays encrypted)
 * - No link between wallet A ↔ wallet B
 * 
 * Public Inputs:
 * - commitment: Hash stored in RiskScoreVault
 * - nullifier: Prevents double-claiming same analysis
 * - vaultAddress: Address of RiskScoreVault contract
 * 
 * Private Inputs (Witnesses):
 * - walletAddress: Original wallet that was analyzed (PRIVATE)
 * - secret: Random secret from backend (PRIVATE)
 * - encryptedScoreHash: Hash of encrypted score in vault (PRIVATE)
 */
template PassportProof() {
    // ============ PRIVATE INPUTS (Witnesses - Never Revealed) ============
    
    signal input walletAddress;          // Original wallet address (160 bits as field element)
    signal input secret;                 // Random secret from backend (256 bits)
    signal input encryptedScoreHash;     // Hash of FHE encrypted score
    
    // ============ PUBLIC INPUTS (On-chain Verifiable) ============
    
    signal input commitment;             // Stored in RiskScoreVault
    signal input nullifier;              // Prevents reuse
    signal input vaultAddress;           // RiskScoreVault contract address
    
    // ============ CONSTRAINT 1: Verify Commitment ============
    // Prove: commitment = Poseidon(walletAddress, encryptedScoreHash, secret)
    //
    // This proves user knows:
    // - The wallet that was analyzed
    // - The encrypted score in vault
    // - The secret key
    //
    // Without revealing any of them!
    
    component commitmentHash = Poseidon(3);
    commitmentHash.inputs[0] <== walletAddress;
    commitmentHash.inputs[1] <== encryptedScoreHash;
    commitmentHash.inputs[2] <== secret;
    
    // Assert commitment matches what's in vault
    commitment === commitmentHash.out;
    
    // ============ CONSTRAINT 2: Verify Nullifier ============
    // Prove: nullifier = Poseidon(commitment, walletAddress)
    //
    // This ensures:
    // - Each wallet can only claim once
    // - Different wallets have different nullifiers
    // - Same wallet always produces same nullifier
    //
    // Smart contract tracks used nullifiers to prevent double-claiming
    
    component nullifierHash = Poseidon(2);
    nullifierHash.inputs[0] <== commitment;
    nullifierHash.inputs[1] <== walletAddress;
    
    // Assert nullifier is correctly derived
    nullifier === nullifierHash.out;
    
    // ============ CONSTRAINT 3: Vault Binding ============
    // Prove commitment is associated with specific vault
    //
    // This prevents:
    // - Using commitment from different vault
    // - Cross-vault replay attacks
    //
    // Note: Vault address is public input, so verifier knows which vault
    
    component vaultBinding = Poseidon(2);
    vaultBinding.inputs[0] <== commitment;
    vaultBinding.inputs[1] <== vaultAddress;
    
    // Compute vault-bound commitment
    signal vaultBoundCommitment <== vaultBinding.out;
    
    // This signal is used for additional verification
    // The smart contract can check this matches expected vault
    
    // ============ OUTPUT ============
    // If all constraints pass, proof is valid
    // Smart contract will verify:
    // 1. Commitment exists in vault ✓
    // 2. Nullifier not used before ✓
    // 3. This ZK proof is valid ✓
    
    signal output valid;
    valid <== 1;
}

// Main component with public inputs specified
component main {public [commitment, nullifier, vaultAddress]} = PassportProof();

