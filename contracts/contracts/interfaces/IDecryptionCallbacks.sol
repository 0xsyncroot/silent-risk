// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title IDecryptionCallbacks
 * @notice Interface for FHEVM oracle decryption callbacks
 * @dev Standard interface for handling decryption results from Zama oracle
 * @author 0xSyncroot - Silent Risk Team
 */
interface IDecryptionCallbacks {
    /**
     * @notice Callback for score decryption results
     * @param requestId Request identifier for replay protection
     * @param cleartexts ABI-encoded decrypted values
     * @param decryptionProof KMS signature for verification
     */
    function scoreDecryptionCallback(
        uint256 requestId,
        bytes memory cleartexts,
        bytes memory decryptionProof
    ) external;
}
