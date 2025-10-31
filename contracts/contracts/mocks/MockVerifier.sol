// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockVerifier
 * @notice Mock ZK proof verifier for testing
 * 
 * In production, this is replaced by the actual Groth16 verifier
 * generated from the ZK circuit.
 * 
 * For testing purposes, allows setting verification result manually.
 */
contract MockVerifier {
    /// @notice Verification result (can be set for testing)
    bool private _verificationResult;
    
    constructor() {
        _verificationResult = true; // Default to true for easier testing
    }
    
    /**
     * @notice Set verification result (for testing)
     * @param result True to pass verification, false to fail
     */
    function setVerificationResult(bool result) external {
        _verificationResult = result;
    }
    
    /**
     * @notice Verify ZK proof (mock implementation)
     * @param _pA Proof component A
     * @param _pB Proof component B
     * @param _pC Proof component C
     * @param _pubSignals Public signals
     * @return True if verification passes
     */
    function verifyProof(
        uint[2] calldata _pA,
        uint[2][2] calldata _pB,
        uint[2] calldata _pC,
        uint[3] calldata _pubSignals
    ) external view returns (bool) {
        // Suppress unused variable warnings
        (_pA, _pB, _pC, _pubSignals);
        
        // Return configured result
        return _verificationResult;
    }
}

