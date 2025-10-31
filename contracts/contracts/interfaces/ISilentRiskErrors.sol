// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

/**
 * @title ISilentRiskErrors
 * @notice Common error definitions for Silent Risk system
 * @dev Shared errors for all Silent Risk contracts
 * @author 0xSyncroot - Silent Risk Team
 */
interface ISilentRiskErrors {
    /**
     * @notice Thrown when caller is not authorized
     */
    error NotAuthorized(address caller, string role);
    
    /**
     * @notice Thrown when contract is paused
     */
    error ContractPaused();
    
    /**
     * @notice Thrown when risk score not found
     */
    error RiskScoreNotFound(address wallet);
    
    /**
     * @notice Thrown when commitment not found
     */
    error CommitmentNotFound(bytes32 commitment);
    
    /**
     * @notice Thrown when nullifier already used
     */
    error NullifierAlreadyUsed(bytes32 nullifierHash);
    
    /**
     * @notice Thrown when strategy type is invalid
     */
    error InvalidStrategyType(uint8 strategyType);
    
    /**
     * @notice Thrown when validation has expired
     */
    error ValidationExpired(bytes32 commitment);
    
    /**
     * @notice Thrown when proof is invalid
     */
    error InvalidProof();
    
    /**
     * @notice Thrown when value exceeds maximum allowed
     */
    error ValueExceedsMaximum(uint256 value, uint256 maximum);
    
    /**
     * @notice Thrown when range is invalid
     */
    error InvalidRange(uint256 min, uint256 max);
    
    /**
     * @notice Thrown when address is zero
     */
    error ZeroAddress();
    
    /**
     * @notice Thrown when commitment is invalid
     */
    error InvalidCommitment();
    
    /**
     * @notice Thrown when block height is invalid
     */
    error InvalidBlockHeight();
    
    /**
     * @notice Thrown when rate limited
     */
    error RateLimited();
    
    /**
     * @notice Thrown when interval is too long
     */
    error IntervalTooLong();
    
    /**
     * @notice Thrown when request already processed
     */
    error RequestAlreadyProcessed();
    
    /**
     * @notice Thrown when invalid request ID
     */
    error InvalidRequestId();
}
