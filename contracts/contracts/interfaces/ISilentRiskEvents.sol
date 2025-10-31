// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../libraries/SilentRiskStructs.sol";

/**
 * @title ISilentRiskEvents
 * @notice Common event definitions for Silent Risk system
 * @dev Shared events for all Silent Risk contracts
 * @author 0xSyncroot - Silent Risk Team
 */
interface ISilentRiskEvents {
    // ============ RISK SCORE EVENTS ============
    
    /**
     * @notice Emitted when risk score is updated
     */
    event RiskScoreUpdated(
        address indexed wallet,
        uint8 indexed riskBand,
        uint256 timestamp,
        uint256 blockHeight
    );
    
    /**
     * @notice Emitted when threshold comparison is performed
     */
    event ThresholdComparison(
        address indexed wallet,
        address indexed requester,
        uint8 indexed comparisonType,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when score decryption is requested
     */
    event ScoreDecryptionRequested(
        address indexed requester,
        address indexed wallet,
        uint256 indexed requestId,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when score decryption is completed
     */
    event ScoreDecryptionCompleted(
        address indexed wallet,
        uint256 indexed requestId,
        uint256 timestamp
    );
    
    // ============ STRATEGY EVENTS ============
    
    /**
     * @notice Emitted when strategy is submitted
     */
    event StrategySubmitted(
        bytes32 indexed commitment,
        SilentRiskStructs.StrategyType indexed strategyType,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when strategy is validated
     */
    event StrategyValidated(
        bytes32 indexed commitment,
        SilentRiskStructs.ValidationResult indexed result,
        SilentRiskStructs.StrategyType strategyType,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when validation constraints are updated
     */
    event ValidationConstraintsUpdated(
        SilentRiskStructs.StrategyType indexed strategyType,
        uint256 timestamp
    );
    
    // ============ COMMON EVENTS ============
    
    /**
     * @notice Emitted when updater authorization changes
     */
    event UpdaterAuthorized(
        address indexed updater,
        bool authorized,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when validator authorization changes
     */
    event ValidatorAuthorized(
        address indexed validator,
        bool authorized,
        uint256 timestamp
    );
}
