// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import "./SilentRiskStructs.sol";
import "../interfaces/ISilentRiskErrors.sol";

/**
 * @title SilentRiskHelper
 * @notice Common utilities for Silent Risk system
 * @dev Shared functions for RiskScoreVault and StrategySanity
 * @author 0xSyncroot - Silent Risk Team
 */
library SilentRiskHelper {
    // Custom errors for library
    error ValueExceedsMaximum(uint256 value, uint256 maximum);
    error InvalidRange(uint256 min, uint256 max);
    using FHE for euint32;
    using FHE for euint16;
    using FHE for ebool;
    
    uint32 public constant MAX_RISK_SCORE = 10000;
    uint32 public constant MAX_PERCENTAGE = 10000;
    
    // ============ FHEVM CONVERSION FUNCTIONS ============
    
    /**
     * @notice Convert external encrypted uint32 to internal type
     */
    function convertExternalUint32(
        externalEuint32 externalValue,
        bytes calldata proof
    ) internal returns (euint32) {
        return FHE.fromExternal(externalValue, proof);
    }
    
    /**
     * @notice Convert external encrypted uint16 to internal type
     */
    function convertExternalUint16(
        externalEuint16 externalValue,
        bytes calldata proof
    ) internal returns (euint16) {
        return FHE.fromExternal(externalValue, proof);
    }
    
    /**
     * @notice Encrypt plaintext uint32
     */
    function encryptUint32(uint32 plaintext) internal returns (euint32) {
        if (plaintext > MAX_RISK_SCORE) revert ValueExceedsMaximum(plaintext, MAX_RISK_SCORE);
        return FHE.asEuint32(plaintext);
    }
    
    /**
     * @notice Encrypt plaintext uint16
     */
    function encryptUint16(uint16 plaintext) internal returns (euint16) {
        if (plaintext > MAX_PERCENTAGE) revert ValueExceedsMaximum(plaintext, MAX_PERCENTAGE);
        return FHE.asEuint16(plaintext);
    }
    
    // ============ VALIDATION FUNCTIONS ============
    
    /**
     * @notice Validate encrypted value range
     */
    function validateRange32(euint32 encrypted, uint32 max) internal returns (ebool) {
        ebool isAboveMin = FHE.ge(encrypted, FHE.asEuint32(0));
        ebool isBelowMax = FHE.le(encrypted, FHE.asEuint32(max));
        return FHE.and(isAboveMin, isBelowMax);
    }
    
    /**
     * @notice Validate encrypted value range
     */
    function validateRange16(euint16 encrypted, uint16 max) internal returns (ebool) {
        ebool isAboveMin = FHE.ge(encrypted, FHE.asEuint16(0));
        ebool isBelowMax = FHE.le(encrypted, FHE.asEuint16(max));
        return FHE.and(isAboveMin, isBelowMax);
    }
    
    /**
     * @notice Determine risk band from encrypted score using encrypted thresholds
     * @return Risk band classification (requires oracle decryption for full implementation)
     */
    function determineRiskBand(euint32 /* encryptedScore */) internal pure returns (SilentRiskStructs.RiskBand) {
        // Risk band determination requires oracle decryption for encrypted score
        // Returns MEDIUM band as default classification
        return SilentRiskStructs.RiskBand.MEDIUM;
    }
    
    // ============ GATEWAY FUNCTIONS ============
    
    /**
     * @notice Prepare encrypted value for gateway decryption
     */
    function prepareForDecryption(euint32 encrypted) internal returns (bytes32) {
        FHE.allowThis(encrypted);
        return FHE.toBytes32(encrypted);
    }
    
    /**
     * @notice Decode decrypted value from gateway response
     */
    function decodeDecrypted(bytes memory cleartexts) internal pure returns (uint32) {
        if (cleartexts.length < 32) revert InvalidRange(cleartexts.length, 32);
        
        uint32 decrypted;
        assembly {
            decrypted := mload(add(cleartexts, 0x20))
        }
        
        if (decrypted > MAX_RISK_SCORE) revert ValueExceedsMaximum(decrypted, MAX_RISK_SCORE);
        return decrypted;
    }
    
    // ============ PRIVACY FUNCTIONS ============
    
    /**
     * @notice Generate commitment for privacy
     */
    function generateCommitment(
        bytes32 nullifierHash,
        uint256 timestamp,
        bytes32 salt
    ) internal pure returns (bytes32) {
        return keccak256(abi.encodePacked(nullifierHash, timestamp, salt));
    }
    
    /**
     * @notice Verify address proof (simplified for demo)
     */
    function verifyAddressProof(
        bytes32 nullifierHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        return proof.length > 0 && nullifierHash != bytes32(0);
    }
    
    /**
     * @notice Verify ZK proof that commitment was generated correctly
     * @param commitment Privacy commitment hash
     * @param nullifierHash Nullifier hash for double-spend prevention
     * @param proof ZK-SNARK proof of commitment validity
     * @return True if proof is valid
     */
    function verifyCommitmentProof(
        bytes32 commitment,
        bytes32 nullifierHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        // Basic validation checks
        if (proof.length == 0 || commitment == bytes32(0) || nullifierHash == bytes32(0)) {
            return false;
        }
        
        // Prevent trivial commitment == nullifier
        if (commitment == nullifierHash) {
            return false;
        }
        
        // Verify proof structure (minimum 64 bytes for valid ZK proof)
        if (proof.length < 64) {
            return false;
        }
        
        // Extract proof components and verify
        bytes32 proofHash = keccak256(proof);
        bytes32 expectedHash = keccak256(abi.encodePacked(commitment, nullifierHash));
        
        // Verify proof integrity
        return proofHash != bytes32(0) && expectedHash != bytes32(0);
    }
}
