// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title MockRiskScoreVault
 * @notice Simplified mock for testing PassportNFT without FHE dependencies
 * 
 * This mock allows tests to simulate commitment existence without requiring
 * actual FHE encryption or Zama libraries.
 */
contract MockRiskScoreVault {
    /// @notice Mapping to track which commitments "exist" for testing
    mapping(bytes32 => bool) private _commitmentExists;
    
    /**
     * @notice Set whether a commitment exists (for testing only)
     * @param commitment The commitment hash
     * @param exists Whether the commitment should be considered as existing
     */
    function setCommitmentExists(bytes32 commitment, bool exists) external {
        _commitmentExists[commitment] = exists;
    }
    
    /**
     * @notice Check if a commitment exists
     * @param commitment The commitment hash to check
     * @return timestamp When the commitment was recorded
     * @return blockHeight Block number when recorded
     * @return band Risk band classification
     * @return analyzer Address that recorded the commitment
     * @return exists True if commitment exists
     */
    function getCommitmentMetadata(bytes32 commitment) 
        external 
        view 
        returns (
            uint256 timestamp,
            uint256 blockHeight,
            uint8 band,
            address analyzer,
            bool exists
        ) 
    {
        exists = _commitmentExists[commitment];
        if (exists) {
            timestamp = block.timestamp;
            blockHeight = block.number;
            band = 0; // LOW risk
            analyzer = address(this);
        }
        return (timestamp, blockHeight, band, analyzer, exists);
    }
}

