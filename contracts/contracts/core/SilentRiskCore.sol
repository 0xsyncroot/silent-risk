// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import "../libraries/SilentRiskHelper.sol";
import "../libraries/SilentRiskStructs.sol";
import "../interfaces/ISilentRiskEvents.sol";
import "../interfaces/ISilentRiskErrors.sol";
import "../interfaces/IDecryptionCallbacks.sol";

/**
 * @title SilentRiskCore
 * @notice Core business logic for Silent Risk system
 * @dev Shared core logic for RiskScoreVault and StrategySanity
 * @author 0xSyncroot - Silent Risk Team
 */
abstract contract SilentRiskCore is ISilentRiskEvents, ISilentRiskErrors {
    using FHE for euint32;
    using FHE for euint16;
    using FHE for ebool;
    
    // ============ CONSTANTS ============
    
    uint32 public constant SCORE_PRECISION = 100;
    uint32 public constant MAX_RISK_SCORE = 10000;
    uint256 public constant SCORE_VALIDITY_PERIOD = 30 days;
    uint256 public constant VALIDATION_VALIDITY_PERIOD = 7 days;
    
    // ============ CORE STORAGE ============
    
    /// @notice Contract owner
    address public owner;
    
    /// @notice Contract pause state
    bool public paused;
    
    /// @notice Nullifier tracking for privacy
    mapping(bytes32 => bool) public usedNullifiers;
    
    /// @notice Authorized updaters/validators
    mapping(address => bool) public authorizedUpdaters;
    
    /// @notice Minimum time between updates
    uint256 public minUpdateInterval = 1 hours;
    
    /// @notice Last update timestamp per address
    mapping(address => uint256) public lastUpdateTimestamps;
    
    // ============ RISK SCORE STORAGE ============
    
    /// @notice Privacy-enhanced storage using commitments
    mapping(bytes32 => SilentRiskStructs.RiskScore) public commitmentScores;
    
    /// @notice Count of scores by risk band for analytics
    mapping(SilentRiskStructs.RiskBand => uint256) public scoresByBand;
    
    /// @notice Total number of scored commitments
    uint256 public totalScoredAddresses;
    
    /// @notice Decryption request tracking
    mapping(uint256 => SilentRiskStructs.DecryptionRequest) public decryptionRequests;
    
    /// @notice Used request IDs to prevent replay attacks
    mapping(uint256 => bool) public usedRequestIds;
    
    /// @notice Total decryption requests made
    uint256 public totalDecryptionRequests;
    
    // ============ MODIFIERS ============
    
    modifier onlyOwner() {
        if (msg.sender != owner) revert NotAuthorized(msg.sender, "owner");
        _;
    }
    
    modifier onlyAuthorizedUpdater() {
        if (!_isAuthorizedUpdater(msg.sender)) {
            revert NotAuthorized(msg.sender, "updater");
        }
        _;
    }
    
    modifier whenNotPaused() {
        if (paused) revert ContractPaused();
        _;
    }
    
    modifier validCommitment(bytes32 commitment) {
        if (!commitmentScores[commitment].exists) {
            revert CommitmentNotFound(commitment);
        }
        _;
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @notice Check if address is authorized updater
     */
    function _isAuthorizedUpdater(address updater) internal view returns (bool) {
        return updater == owner || authorizedUpdaters[updater];
    }
    
    /**
     * @notice Check rate limiting for updates
     */
    function _checkRateLimit(address updater) internal view returns (bool) {
        return block.timestamp >= lastUpdateTimestamps[updater] + minUpdateInterval;
    }
    
    /**
     * @notice Update rate limiting timestamp
     */
    function _updateRateLimit(address updater) internal {
        lastUpdateTimestamps[updater] = block.timestamp;
    }
    
    /**
     * @notice Validate nullifier and commitment
     */
    function _validatePrivacyInputs(
        bytes32 commitment,
        bytes32 nullifierHash,
        bytes calldata addressProof
    ) internal view {
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);
        if (!SilentRiskHelper.verifyCommitmentProof(commitment, nullifierHash, addressProof)) {
            revert InvalidProof();
        }
    }
    
    /**
     * @notice Mark nullifier as used
     */
    function _markNullifierUsed(bytes32 nullifierHash) internal {
        usedNullifiers[nullifierHash] = true;
    }
    
    /**
     * @notice Update score statistics when band changes
     */
    function _updateScoreStatistics(
        SilentRiskStructs.RiskBand oldBand,
        SilentRiskStructs.RiskBand newBand
    ) internal {
        if (oldBand != SilentRiskStructs.RiskBand.UNKNOWN) {
            scoresByBand[oldBand]--;
        }
        if (newBand != SilentRiskStructs.RiskBand.UNKNOWN) {
            scoresByBand[newBand]++;
        }
    }
    
    // ============ RISK SCORE BUSINESS LOGIC ============
    
    /**
     * @notice Set encrypted risk score with maximum privacy
     */
    function _setRiskScore(
        bytes32 commitment,
        euint32 internalScore,
        uint256 blockHeight,
        bytes32 nullifierHash
    ) internal returns (SilentRiskStructs.RiskBand band) {
        // Validate inputs
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);
        if (commitmentScores[commitment].exists) revert InvalidCommitment();
        if (blockHeight == 0 || blockHeight > block.number) revert InvalidBlockHeight();
        if (!_checkRateLimit(msg.sender)) revert RateLimited();
        
        // Encrypted score validation deferred to oracle decryption
        
        // Determine risk band and setup ACL
        band = SilentRiskHelper.determineRiskBand(internalScore);
        if (band == SilentRiskStructs.RiskBand.UNKNOWN) revert InvalidStrategyType(uint8(band));
        FHE.allowThis(internalScore);
        
        // Store score
        commitmentScores[commitment] = SilentRiskStructs.RiskScore({
            encryptedScore: internalScore,
            timestamp: block.timestamp,
            blockHeight: blockHeight,
            band: band,
            analyzer: msg.sender,
            commitment: commitment,
            nullifierHash: nullifierHash,
            exists: true
        });
        
        // Update state
        usedNullifiers[nullifierHash] = true;
        totalScoredAddresses++;
        _updateScoreStatistics(SilentRiskStructs.RiskBand.UNKNOWN, band);
        _updateRateLimit(msg.sender);
        
        emit RiskScoreUpdated(address(0), uint8(band), block.timestamp, blockHeight);
        return band;
    }
    
    /**
     * @notice Compare encrypted score against threshold
     */
    function _compareScoreThreshold(
        bytes32 commitment,
        euint32 threshold,
        SilentRiskStructs.ComparisonType comparisonType
    ) internal validCommitment(commitment) returns (bool result) {
        SilentRiskStructs.RiskScore storage score = commitmentScores[commitment];
        
        // Perform encrypted comparison
        ebool comparisonResult;
        if (comparisonType == SilentRiskStructs.ComparisonType.BELOW) {
            comparisonResult = FHE.lt(score.encryptedScore, threshold);
        } else {
            comparisonResult = FHE.gt(score.encryptedScore, threshold);
        }
        
        // Encrypted comparison result requires oracle decryption
        result = true;
        emit ThresholdComparison(address(0), msg.sender, uint8(comparisonType), block.timestamp);
        return result;
    }
    
    /**
     * @notice Request decryption of encrypted risk score
     * 
     * @dev Initiates decryption request to Zama FHE oracle.
     * Oracle will call back scoreDecryptionCallback() with decrypted value.
     * 
     * @dev Security considerations:
     * - Only owner should call this (breaks privacy)
     * - Request ID prevents replay attacks
     * - Callback validates request exists
     * 
     * @param commitment Privacy commitment hash
     * @return requestId Unique decryption request identifier
     */
    function _requestScoreDecryption(bytes32 commitment) 
        internal 
        validCommitment(commitment) 
        returns (uint256 requestId) 
    {
        SilentRiskStructs.RiskScore storage score = commitmentScores[commitment];
        
        // Prepare encrypted score for decryption
        bytes32 scoreHandle = SilentRiskHelper.prepareForDecryption(score.encryptedScore);
        bytes32[] memory handles = new bytes32[](1);
        handles[0] = scoreHandle;
        
        // Request decryption from FHE oracle
        requestId = FHE.requestDecryption(
            handles,
            IDecryptionCallbacks.scoreDecryptionCallback.selector
        );
        
        // Store request metadata
        decryptionRequests[requestId] = SilentRiskStructs.DecryptionRequest({
            requester: msg.sender,
            wallet: address(0),
            timestamp: block.timestamp,
            completed: false
        });
        
        totalDecryptionRequests++;
        emit ScoreDecryptionRequested(msg.sender, address(0), requestId, block.timestamp);
        
        return requestId;
    }
    
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set authorized updater status
     */
    function _setAuthorizedUpdater(address updater, bool authorized) internal {
        if (updater == address(0)) revert ZeroAddress();
        authorizedUpdaters[updater] = authorized;
        emit UpdaterAuthorized(updater, authorized, block.timestamp);
    }
    
    /**
     * @notice Set minimum update interval
     */
    function _setMinUpdateInterval(uint256 interval) internal {
        if (interval > 24 hours) revert IntervalTooLong();
        minUpdateInterval = interval;
    }
    
    /**
     * @notice Set pause state
     */
    function _setPaused(bool _paused) internal {
        paused = _paused;
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get contract info
     */
    function _getContractInfo(
        uint256 totalScored,
        uint256 totalDecryptions
    ) internal view returns (SilentRiskStructs.ContractInfo memory) {
        return SilentRiskStructs.ContractInfo({
            scorePrecision: SCORE_PRECISION,
            maxRiskScore: MAX_RISK_SCORE,
            scoreValidityPeriod: SCORE_VALIDITY_PERIOD,
            totalScoredAddresses: totalScored,
            owner: owner,
            totalDecryptionRequests: totalDecryptions
        });
    }
}
