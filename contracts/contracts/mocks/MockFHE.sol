// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockFHE
 * @notice Mock FHE library for unit testing
 * @dev Simulates FHE operations without actual encryption
 */
library MockFHE {
    // Mock euint32 as uint256 for testing
    type euint32 is uint256;
    
    /**
     * @notice Mock asEuint32 - just wraps the value
     */
    function asEuint32(uint32 value) internal pure returns (euint32) {
        return euint32.wrap(uint256(value));
    }
    
    /**
     * @notice Mock fromExternal - extracts value from hash
     */
    function fromExternal(
        bytes32 externalValue,
        bytes calldata /* proof */
    ) internal pure returns (euint32) {
        // Extract uint32 from bytes32 for testing
        uint32 value = uint32(uint256(externalValue));
        return euint32.wrap(uint256(value));
    }
    
    /**
     * @notice Mock allowThis - no-op for testing
     */
    function allowThis(euint32 /* value */) internal pure {
        // No-op in mock
    }
    
    /**
     * @notice Mock lt - less than comparison
     */
    function lt(euint32 a, euint32 b) internal pure returns (bool) {
        return euint32.unwrap(a) < euint32.unwrap(b);
    }
    
    /**
     * @notice Mock gt - greater than comparison
     */
    function gt(euint32 a, euint32 b) internal pure returns (bool) {
        return euint32.unwrap(a) > euint32.unwrap(b);
    }
    
    /**
     * @notice Mock le - less than or equal
     */
    function le(euint32 a, euint32 b) internal pure returns (bool) {
        return euint32.unwrap(a) <= euint32.unwrap(b);
    }
    
    /**
     * @notice Mock ge - greater than or equal
     */
    function ge(euint32 a, euint32 b) internal pure returns (bool) {
        return euint32.unwrap(a) >= euint32.unwrap(b);
    }
    
    /**
     * @notice Mock toBytes32 - converts to bytes32
     */
    function toBytes32(euint32 value) internal pure returns (bytes32) {
        return bytes32(euint32.unwrap(value));
    }
    
    /**
     * @notice Mock requestDecryption - returns mock request ID
     */
    function requestDecryption(
        bytes32[] memory /* handles */,
        bytes4 /* callbackSelector */
    ) internal pure returns (uint256) {
        return 1; // Mock request ID
    }
}
