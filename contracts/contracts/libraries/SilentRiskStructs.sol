// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";

/**
 * @title SilentRiskStructs
 * @notice Common data structures for Silent Risk system
 * @dev Shared structs for RiskScoreVault and StrategySanity
 * @author 0xSyncroot - Silent Risk Team
 */
library SilentRiskStructs {
    using FHE for euint32;
    using FHE for euint16;
    
    // ============ COMMON ENUMS ============
    
    /**
     * @notice Risk band classifications
     */
    enum RiskBand {
        UNKNOWN,    // 0 - No score available
        LOW,        // 1 - Low risk (0-30%)
        MEDIUM,     // 2 - Medium risk (30-70%)
        HIGH        // 3 - High risk (70-100%)
    }
    
    /**
     * @notice Comparison types for threshold operations
     */
    enum ComparisonType {
        BELOW,      // 0 - Check if value is below threshold
        ABOVE       // 1 - Check if value is above threshold
    }
    
    /**
     * @notice Validation results
     */
    enum ValidationResult {
        PENDING,    // 0 - Validation pending
        PASSED,     // 1 - All checks passed
        FAILED,     // 2 - One or more checks failed
        EXPIRED     // 3 - Validation expired
    }
    
    /**
     * @notice Strategy types
     */
    enum StrategyType {
        UNKNOWN,    // 0 - Unknown strategy
        SCALPING,   // 1 - Short-term scalping
        SWING,      // 2 - Swing trading
        POSITION,   // 3 - Position trading
        ARBITRAGE,  // 4 - Arbitrage strategy
        GRID,       // 5 - Grid trading
        DCA         // 6 - Dollar Cost Averaging
    }
    
    // ============ RISK SCORE STRUCTS ============
    
    /**
     * @notice Risk score data with privacy protection
     */
    struct RiskScore {
        euint32 encryptedScore;     // Encrypted risk score (0-10000)
        uint256 timestamp;          // When score was set
        uint256 blockHeight;        // Block height when analysis performed
        RiskBand band;              // Public risk band classification
        address analyzer;           // Address that performed analysis
        bytes32 commitment;         // Commitment hash for privacy
        bytes32 nullifierHash;      // Nullifier to prevent double-use
        bool exists;                // Whether score exists
    }
    
    /**
     * @notice Decryption request information
     */
    struct DecryptionRequest {
        address requester;          // Who requested decryption
        address wallet;             // Wallet being decrypted (address(0) for privacy)
        uint256 timestamp;          // When request was made
        bool completed;             // Whether request fulfilled
    }
    
    // ============ STRATEGY STRUCTS ============
    
    /**
     * @notice Strategy parameters with privacy protection
     */
    struct StrategyParams {
        euint16 takeProfitPercent;      // Take profit % (0-10000)
        euint16 stopLossPercent;        // Stop loss % (0-10000)
        euint16 positionSizePercent;    // Position size % (0-10000)
        euint32 cooldownMinutes;        // Cooldown between trades
        euint16 maxDrawdownPercent;     // Max drawdown % (0-10000)
        StrategyType strategyType;      // Strategy type
        bytes32 commitment;             // Privacy commitment
        bytes32 nullifierHash;          // Nullifier for privacy
        uint256 timestamp;              // Submission timestamp
        bool exists;                    // Whether exists
    }
    
    /**
     * @notice Strategy validation record
     */
    struct StrategyValidation {
        bytes32 commitment;             // Strategy commitment
        ValidationResult result;        // Validation result
        uint256 timestamp;              // Validation timestamp
        uint256 validUntil;             // Expiry timestamp
        StrategyType strategyType;      // Strategy type
        bool exists;                    // Whether exists
    }
    
    /**
     * @notice Validation constraints per strategy type
     */
    struct ValidationConstraints {
        uint16 minTakeProfit;           // Min take profit %
        uint16 maxTakeProfit;           // Max take profit %
        uint16 minStopLoss;             // Min stop loss %
        uint16 maxStopLoss;             // Max stop loss %
        uint16 maxPositionSize;         // Max position size %
        uint32 minCooldown;             // Min cooldown minutes
        uint32 maxCooldown;             // Max cooldown minutes
        uint16 maxDrawdown;             // Max drawdown %
    }
    
    // ============ COMMON STRUCTS ============
    
    /**
     * @notice Contract configuration and statistics
     */
    struct ContractInfo {
        uint32 scorePrecision;          // Score precision (100 for 2 decimals)
        uint32 maxRiskScore;            // Maximum risk score value (10000)
        uint256 scoreValidityPeriod;    // How long scores remain valid
        uint256 totalScoredAddresses;   // Total commitments with scores
        address owner;                  // Contract owner
        uint256 totalDecryptionRequests; // Total decryption requests
    }
}
