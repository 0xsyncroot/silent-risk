// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "../core/SilentRiskCore.sol";
import "../libraries/SilentRiskStructs.sol";
import "../interfaces/IDecryptionCallbacks.sol";

/**
 * @title TestRiskScoreVault
 * @notice Testable version of RiskScoreVault without FHE dependencies
 * @dev Used for unit testing business logic
 */
contract TestRiskScoreVault is SilentRiskCore, IDecryptionCallbacks {
    
    // ============ STATE VARIABLES ============
    
    /// @notice PassportNFT contract address
    address public passportNFT;
    
    // ============ EVENTS ============
    
    event RiskAnalysisSubmitted(
        bytes32 indexed commitment,
        uint256 indexed passportTokenId,
        SilentRiskStructs.RiskBand riskBand,
        uint256 timestamp
    );
    
    event DAOVerificationPerformed(
        address indexed dao,
        bytes32 indexed commitment,
        bool verificationPassed,
        uint256 timestamp
    );
    
    // ============ ERRORS ============
    
    error PassportNFTNotSet();
    error PassportMintingFailed();
    
    // ============ CONSTRUCTOR ============
    
    constructor(address initialOwner) {
        if (initialOwner == address(0)) revert ZeroAddress();
        owner = initialOwner;
    }
    
    // ============ CORE FUNCTIONS ============
    
    /**
     * @notice Submit risk analysis (testable version without FHE)
     */
    function submitRiskAnalysis(
        bytes32 commitment,
        uint32 plaintextScore, // Use plaintext for testing
        uint256 blockHeight,
        bytes32 nullifierHash,
        bytes calldata addressProof,
        address recipient
    ) 
        external 
        onlyAuthorizedUpdater 
        whenNotPaused 
        returns (SilentRiskStructs.RiskBand band, uint256 passportTokenId) 
    {
        if (passportNFT == address(0)) revert PassportNFTNotSet();
        if (recipient == address(0)) revert ZeroAddress();
        
        // Verify ZK proof
        if (!_verifyCommitmentProof(commitment, nullifierHash, addressProof)) {
            revert InvalidProof();
        }
        
        // Determine risk band from plaintext score
        band = _determineRiskBandFromPlaintext(plaintextScore);
        
        // Store score metadata (without actual FHE encryption)
        _storeScoreMetadata(commitment, band, blockHeight, nullifierHash);
        
        // Mint passport
        passportTokenId = _mintPassportNFT(commitment, recipient);
        
        // Emit event
        emit RiskAnalysisSubmitted(commitment, passportTokenId, band, block.timestamp);
        
        return (band, passportTokenId);
    }
    
    /**
     * @notice Verify risk threshold (testable version)
     */
    function verifyRiskThreshold(
        bytes32 commitment,
        uint32 plaintextThreshold
    ) 
        external 
        whenNotPaused 
        returns (bool meetsThreshold) 
    {
        if (!commitmentScores[commitment].exists) {
            revert CommitmentNotFound(commitment);
        }
        
        // In real implementation, this would use FHE comparison
        // For testing, we compare risk bands
        SilentRiskStructs.RiskBand band = commitmentScores[commitment].band;
        SilentRiskStructs.RiskBand thresholdBand = _determineRiskBandFromPlaintext(plaintextThreshold);
        
        meetsThreshold = uint8(band) <= uint8(thresholdBand);
        
        emit DAOVerificationPerformed(msg.sender, commitment, meetsThreshold, block.timestamp);
        
        return meetsThreshold;
    }
    
    /**
     * @notice Get commitment risk band
     */
    function getCommitmentRiskBand(bytes32 commitment) 
        external 
        view 
        returns (SilentRiskStructs.RiskBand) 
    {
        return commitmentScores[commitment].exists 
            ? commitmentScores[commitment].band 
            : SilentRiskStructs.RiskBand.UNKNOWN;
    }
    
    /**
     * @notice Decryption callback (simplified for testing)
     */
    function scoreDecryptionCallback(
        uint256 requestId,
        bytes memory /* cleartexts */,
        bytes memory /* decryptionProof */
    ) external override {
        if (decryptionRequests[requestId].requester == address(0)) {
            revert InvalidRequestId();
        }
        
        if (usedRequestIds[requestId]) {
            revert RequestAlreadyProcessed();
        }
        
        usedRequestIds[requestId] = true;
        decryptionRequests[requestId].completed = true;
        
        emit ScoreDecryptionCompleted(address(0), requestId, block.timestamp);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    function setPassportNFT(address _passportNFT) external onlyOwner {
        if (_passportNFT == address(0)) revert ZeroAddress();
        passportNFT = _passportNFT;
    }
    
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        _setAuthorizedUpdater(updater, authorized);
    }
    
    function setMinUpdateInterval(uint256 interval) external onlyOwner {
        _setMinUpdateInterval(interval);
    }
    
    function pause() external onlyOwner {
        _setPaused(true);
    }
    
    function unpause() external onlyOwner {
        _setPaused(false);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    function getRiskBand(bytes32 commitment) 
        external 
        view 
        returns (SilentRiskStructs.RiskBand) 
    {
        return commitmentScores[commitment].exists 
            ? commitmentScores[commitment].band 
            : SilentRiskStructs.RiskBand.UNKNOWN;
    }
    
    function getCommitmentMetadata(bytes32 commitment) 
        external 
        view 
        returns (
            uint256 timestamp,
            uint256 blockHeight,
            SilentRiskStructs.RiskBand band,
            address analyzer,
            bool exists
        ) 
    {
        SilentRiskStructs.RiskScore storage score = commitmentScores[commitment];
        return (
            score.timestamp, 
            score.blockHeight, 
            score.band, 
            score.analyzer, 
            score.exists
        );
    }
    
    function isNullifierUsed(bytes32 nullifierHash) 
        external 
        view 
        returns (bool) 
    {
        return usedNullifiers[nullifierHash];
    }
    
    function getContractInfo() 
        external 
        view 
        returns (SilentRiskStructs.ContractInfo memory) 
    {
        return SilentRiskStructs.ContractInfo({
            scorePrecision: SCORE_PRECISION,
            maxRiskScore: MAX_RISK_SCORE,
            scoreValidityPeriod: SCORE_VALIDITY_PERIOD,
            totalScoredAddresses: totalScoredAddresses,
            owner: owner,
            totalDecryptionRequests: totalDecryptionRequests
        });
    }
    
    function isAuthorizedUpdater(address updater) 
        external 
        view 
        returns (bool) 
    {
        return _isAuthorizedUpdater(updater);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    function _verifyCommitmentProof(
        bytes32 commitment,
        bytes32 nullifierHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        // Simplified proof verification for testing
        return proof.length >= 64 && commitment != bytes32(0) && nullifierHash != bytes32(0);
    }
    
    function _determineRiskBandFromPlaintext(uint32 score) 
        internal 
        pure 
        returns (SilentRiskStructs.RiskBand) 
    {
        if (score < 3000) return SilentRiskStructs.RiskBand.LOW;
        if (score < 7000) return SilentRiskStructs.RiskBand.MEDIUM;
        return SilentRiskStructs.RiskBand.HIGH;
    }
    
    function _storeScoreMetadata(
        bytes32 commitment,
        SilentRiskStructs.RiskBand band,
        uint256 blockHeight,
        bytes32 nullifierHash
    ) internal {
        // Validate inputs
        if (commitment == bytes32(0)) revert InvalidCommitment();
        if (usedNullifiers[nullifierHash]) revert NullifierAlreadyUsed(nullifierHash);
        if (commitmentScores[commitment].exists) revert InvalidCommitment();
        if (blockHeight == 0 || blockHeight > block.number) revert InvalidBlockHeight();
        if (!_checkRateLimit(msg.sender)) revert RateLimited();
        
        // Store metadata (no actual encrypted score for testing)
        commitmentScores[commitment] = SilentRiskStructs.RiskScore({
            encryptedScore: euint32.wrap(0), // Dummy value for testing
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
    }
    
    function _mintPassportNFT(
        bytes32 commitment,
        address recipient
    ) internal returns (uint256 tokenId) {
        (bool success, bytes memory data) = passportNFT.call(
            abi.encodeWithSignature(
                "mintFromVault(bytes32,address)",
                commitment,
                recipient
            )
        );
        
        if (!success) revert PassportMintingFailed();
        
        tokenId = abi.decode(data, (uint256));
        
        return tokenId;
    }
}
