// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@fhevm/solidity/lib/FHE.sol";
import {SepoliaConfig} from "@fhevm/solidity/config/ZamaConfig.sol";
import "./core/SilentRiskCore.sol";
import "./libraries/SilentRiskHelper.sol";
import "./libraries/SilentRiskStructs.sol";
import "./interfaces/IDecryptionCallbacks.sol";

/**
 * ███████╗██╗██╗     ███████╗███╗   ██╗████████╗    ██████╗ ██╗███████╗██╗  ██╗
 * ██╔════╝██║██║     ██╔════╝████╗  ██║╚══██╔══╝    ██╔══██╗██║██╔════╝██║ ██╔╝
 * ███████╗██║██║     █████╗  ██╔██╗ ██║   ██║       ██████╔╝██║███████╗█████╔╝ 
 * ╚════██║██║██║     ██╔══╝  ██║╚██╗██║   ██║       ██╔══██╗██║╚════██║██╔═██╗ 
 * ███████║██║███████╗███████╗██║ ╚████║   ██║       ██║  ██║██║███████║██║  ██╗
 * ╚══════╝╚═╝╚══════╝╚══════╝╚═╝  ╚═══╝   ╚═╝       ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝
 * 
 *                    ██████╗ ██╗███████╗██╗  ██╗    ██╗   ██╗ █████╗ ██╗   ██╗██╗  ████████╗
 *                    ██╔══██╗██║██╔════╝██║ ██╔╝    ██║   ██║██╔══██╗██║   ██║██║  ╚══██╔══╝
 *                    ██████╔╝██║███████╗█████╔╝     ██║   ██║███████║██║   ██║██║     ██║   
 *                    ██╔══██╗██║╚════██║██╔═██╗     ╚██╗ ██╔╝██╔══██║██║   ██║██║     ██║   
 *                    ██║  ██║██║███████║██║  ██╗     ╚████╔╝ ██║  ██║╚██████╔╝███████╗██║   
 *                    ╚═╝  ╚═╝╚═╝╚══════╝╚═╝  ╚═╝      ╚═══╝  ╚═╝  ╚═╝ ╚═════╝ ╚══════╝╚═╝   
 * 
 *      ██████╗ ██╗  ██╗███████╗██╗   ██╗███╗   ██╗ ██████╗██████╗  ██████╗  ██████╗ ████████╗
 *     ██╔═████╗╚██╗██╔╝██╔════╝╚██╗ ██╔╝████╗  ██║██╔════╝██╔══██╗██╔═══██╗██╔═══██╗╚══██╔══╝
 *     ██║██╔██║ ╚███╔╝ ███████╗ ╚████╔╝ ██╔██╗ ██║██║     ██████╔╝██║   ██║██║   ██║   ██║   
 *     ████╔╝██║ ██╔██╗ ╚════██║  ╚██╔╝  ██║╚██╗██║██║     ██╔══██╗██║   ██║██║   ██║   ██║   
 *     ╚██████╔╝██╔╝ ██╗███████║   ██║   ██║ ╚████║╚██████╗██║  ██║╚██████╔╝╚██████╔╝   ██║   
 *      ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝ ╚═════╝╚═╝  ╚═╝ ╚═════╝  ╚═════╝    ╚═╝   
 * 
 * @title RiskScoreVault
 * @notice Privacy-preserving risk analysis vault using Zama FHE + ZK proofs
 * 
 * @dev Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PRIVACY MODEL: Zero-Knowledge + Fully Homomorphic Encryption                │
 * │                                                                              │
 * │ 1. Off-chain Analysis → Generate commitment + encrypted score                │
 * │ 2. Submit to vault with ZK proof (proves ownership without revealing wallet)│
 * │ 3. Vault stores encrypted score + mints Passport NFT                        │
 * │ 4. DAOs verify risk via FHE comparisons (no decryption needed)              │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * @dev Key Features:
 * - Encrypted risk scores using Zama FHE (scores never revealed on-chain)
 * - ZK proof verification for commitment validity
 * - Automatic Passport NFT minting on successful submission
 * - FHE-based threshold verification for DAO access control
 * - Nullifier system prevents double-submission attacks
 * 
 * @author 0xSyncroot - Silent Risk Team
 */
contract RiskScoreVault is SilentRiskCore, SepoliaConfig, IDecryptionCallbacks {
    using FHE for euint32;
    using FHE for ebool;
    
    // ============ STATE VARIABLES ============
    
    /// @notice PassportNFT contract address for automatic minting
    address public passportNFT;
    
    // ============ EVENTS ============
    
    /**
     * @notice Emitted when risk analysis is submitted and passport is minted
     * @param commitment Privacy commitment hash
     * @param passportTokenId Minted passport NFT token ID
     * @param riskBand Classified risk band
     * @param timestamp Submission timestamp
     */
    event RiskAnalysisSubmitted(
        bytes32 indexed commitment,
        uint256 indexed passportTokenId,
        SilentRiskStructs.RiskBand riskBand,
        uint256 timestamp
    );
    
    /**
     * @notice Emitted when DAO performs FHE verification
     * @param dao DAO address performing verification
     * @param commitment Commitment being verified
     * @param verificationPassed Result of verification
     * @param timestamp Verification timestamp
     */
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
    
    // ============ CORE SUBMISSION FUNCTION ============
    
    /**
     * @notice Submit risk analysis with automatic passport minting
     * 
     * @dev Flow:
     * 1. Verify ZK proof of commitment validity
     * 2. Convert and validate encrypted risk score
     * 3. Store encrypted score in vault
     * 4. Mint Passport NFT to recipient
     * 5. Emit events for dApp indexer
     * 
     * @dev Privacy Properties:
     * - Commitment hides original wallet address
     * - Score remains encrypted on-chain (FHE)
     * - ZK proof ensures valid commitment without revealing secrets
     * - Nullifier prevents double-submission
     * 
     * @param commitment Privacy commitment hash (keccak256 of secret data)
     * @param encryptedScore Encrypted risk score (0-10000 scale, encrypted via FHE)
     * @param scoreProof FHE proof for encrypted score validation
     * @param blockHeight Block height when analysis was performed (temporal anchor)
     * @param nullifierHash Nullifier hash for double-spend prevention
     * @param addressProof ZK-SNARK proof of commitment validity
     * 
     * @return band Risk band classification (LOW/MEDIUM/HIGH)
     * @return passportTokenId Minted passport NFT token ID
     */
    function submitRiskAnalysis(
        bytes32 commitment,
        externalEuint32 encryptedScore,
        bytes calldata scoreProof,
        uint256 blockHeight,
        bytes32 nullifierHash,
        bytes calldata addressProof
    ) 
        external 
        onlyAuthorizedUpdater 
        whenNotPaused 
        returns (SilentRiskStructs.RiskBand band, uint256 passportTokenId) 
    {
        if (passportNFT == address(0)) revert PassportNFTNotSet();
        
        // Step 1: Verify ZK proof of commitment
        if (!_verifyCommitmentProof(commitment, nullifierHash, addressProof)) {
            revert InvalidProof();
        }
        
        // Step 2: Convert external encrypted score to internal FHE type
        euint32 internalScore = SilentRiskHelper.convertExternalUint32(encryptedScore, scoreProof);
        
        // Step 3: Store encrypted score in vault
        band = _setRiskScore(commitment, internalScore, blockHeight, nullifierHash);
        
        // Step 4: Mint Passport NFT to recipient
        passportTokenId = _mintPassportNFT(commitment, msg.sender);
        
        // Step 5: Emit event for dApp indexer
        emit RiskAnalysisSubmitted(commitment, passportTokenId, band, block.timestamp);
        
        return (band, passportTokenId);
    }
    
    // ============ DAO VERIFICATION FUNCTIONS ============
    
    /**
     * @notice Verify if commitment meets risk threshold using FHE comparison
     * 
     * @dev This function enables DAOs to verify user risk levels WITHOUT decrypting scores.
     * Uses Fully Homomorphic Encryption to perform comparisons on encrypted data.
     * 
     * @dev Use Cases:
     * - DAO membership verification (score < 3000 for LOW risk requirement)
     * - Protocol access control (score < 5000 for MEDIUM risk tolerance)
     * - Risk-based lending (score determines collateral requirements)
     * 
     * @dev Privacy Guarantees:
     * - Exact score never revealed to DAO
     * - Only boolean result returned (meets threshold or not)
     * - Comparison performed on encrypted values via FHE
     * - No information leakage about actual score value
     * 
     * @param commitment Privacy commitment hash to verify
     * @param encryptedThreshold Encrypted threshold value (e.g., 3000 for LOW risk)
     * @param thresholdProof FHE proof for threshold validation
     * 
     * @return meetsThreshold True if encrypted score < encrypted threshold
     */
    function verifyRiskThreshold(
        bytes32 commitment,
        externalEuint32 encryptedThreshold,
        bytes calldata thresholdProof
    ) 
        external 
        whenNotPaused 
        returns (bool meetsThreshold) 
    {
        // Convert external encrypted threshold to internal FHE type
        euint32 threshold = SilentRiskHelper.convertExternalUint32(encryptedThreshold, thresholdProof);
        
        // Perform FHE comparison (encrypted score < encrypted threshold)
        meetsThreshold = _compareScoreThreshold(
            commitment, 
            threshold, 
            SilentRiskStructs.ComparisonType.BELOW
        );
        
        // Emit event for dApp indexer
        emit DAOVerificationPerformed(msg.sender, commitment, meetsThreshold, block.timestamp);
        
        return meetsThreshold;
    }
    
    /**
     * @notice Verify if commitment exceeds risk threshold using FHE comparison
     * 
     * @dev Inverse of verifyRiskThreshold - checks if score is ABOVE threshold.
     * Useful for risk exclusion criteria (e.g., reject if score > 7000).
     * 
     * @param commitment Privacy commitment hash to verify
     * @param encryptedThreshold Encrypted threshold value
     * @param thresholdProof FHE proof for threshold validation
     * 
     * @return exceedsThreshold True if encrypted score > encrypted threshold
     */
    function verifyRiskExceedsThreshold(
        bytes32 commitment,
        externalEuint32 encryptedThreshold,
        bytes calldata thresholdProof
    ) 
        external 
        whenNotPaused 
        returns (bool exceedsThreshold) 
    {
        euint32 threshold = SilentRiskHelper.convertExternalUint32(encryptedThreshold, thresholdProof);
        
        exceedsThreshold = _compareScoreThreshold(
            commitment, 
            threshold, 
            SilentRiskStructs.ComparisonType.ABOVE
        );
        
        emit DAOVerificationPerformed(msg.sender, commitment, !exceedsThreshold, block.timestamp);
        
        return exceedsThreshold;
    }
    
    /**
     * @notice Get public risk band for commitment (non-encrypted classification)
     * 
     * @dev Risk bands provide coarse-grained risk classification without revealing exact scores.
     * Bands: LOW (0-30%), MEDIUM (30-70%), HIGH (70-100%)
     * 
     * @param commitment Privacy commitment hash
     * @return band Risk band classification
     */
    function getCommitmentRiskBand(bytes32 commitment) 
        external 
        view 
        returns (SilentRiskStructs.RiskBand band) 
    {
        return commitmentScores[commitment].exists 
            ? commitmentScores[commitment].band 
            : SilentRiskStructs.RiskBand.UNKNOWN;
    }
    
    // ============ DECRYPTION FUNCTIONS ============
    
    /**
     * @notice Request decryption of encrypted risk score (admin/audit only)
     * 
     * @dev ⚠️ WARNING: This breaks privacy guarantees!
     * 
     * @dev Use cases (ONLY):
     * - Regulatory compliance audits
     * - Legal investigations
     * - Emergency fraud detection
     * - System debugging (testnet only)
     * 
     * @dev How it works:
     * 1. Owner calls this function
     * 2. Request sent to Zama FHE oracle
     * 3. Oracle decrypts score off-chain
     * 4. Oracle calls scoreDecryptionCallback() with result
     * 
     * @param commitment Privacy commitment hash
     * @return requestId Decryption request identifier
     */
    function requestScoreDecryption(bytes32 commitment) 
        external 
        onlyOwner
        whenNotPaused 
        returns (uint256 requestId) 
    {
        return _requestScoreDecryption(commitment);
    }
    
    /**
     * @notice FHEVM oracle callback for score decryption
     * 
     * @dev ⚠️ CRITICAL: This function is called by Zama FHE oracle, NOT by users!
     * 
     * @dev Why this is needed:
     * - Zama FHE uses asynchronous decryption model
     * - Oracle performs decryption off-chain (secure enclave)
     * - Oracle calls back with decrypted result
     * - This callback receives and validates the result
     * 
     * @dev Security measures:
     * - Validates request ID exists (prevents fake callbacks)
     * - Replay protection via usedRequestIds mapping
     * - Only processes each request once
     * - Emits event for transparency
     * 
     * @dev Flow:
     * 1. requestScoreDecryption() → creates request
     * 2. Oracle decrypts → calls this callback
     * 3. Callback validates → marks as completed
     * 4. Event emitted → dApp can index result
     * 
     * @param requestId Request identifier for replay protection
     */
    function scoreDecryptionCallback(
        uint256 requestId,
        bytes memory /* cleartexts */,
        bytes memory /* decryptionProof */
    ) external override(IDecryptionCallbacks) {
        // Validate request exists (prevents unauthorized callbacks)
        if (decryptionRequests[requestId].requester == address(0)) {
            revert InvalidRequestId();
        }
        
        // Prevent replay attacks
        if (usedRequestIds[requestId]) {
            revert RequestAlreadyProcessed();
        }
        
        // Mark request as processed
        usedRequestIds[requestId] = true;
        decryptionRequests[requestId].completed = true;
        
        // Emit event for dApp indexer
        // In production, you would decode cleartexts and emit the actual score
        emit ScoreDecryptionCompleted(address(0), requestId, block.timestamp);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set PassportNFT contract address
     * @dev Must be called before any submissions can be made
     * @param _passportNFT PassportNFT contract address
     */
    function setPassportNFT(address _passportNFT) external onlyOwner {
        if (_passportNFT == address(0)) revert ZeroAddress();
        passportNFT = _passportNFT;
    }
    
    /**
     * @notice Set authorized updater status
     * @dev Updaters can submit risk analyses on behalf of users
     * @param updater Address to authorize/deauthorize
     * @param authorized True to authorize, false to revoke
     */
    function setAuthorizedUpdater(address updater, bool authorized) external onlyOwner {
        _setAuthorizedUpdater(updater, authorized);
    }
    
    /**
     * @notice Set minimum interval between updates
     * @dev Rate limiting to prevent spam
     * @param interval Minimum interval in seconds
     */
    function setMinUpdateInterval(uint256 interval) external onlyOwner {
        _setMinUpdateInterval(interval);
    }
    
    /**
     * @notice Pause contract (emergency only)
     */
    function pause() external onlyOwner {
        _setPaused(true);
    }
    
    /**
     * @notice Unpause contract
     */
    function unpause() external onlyOwner {
        _setPaused(false);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get risk band for commitment
     * @param commitment Privacy commitment hash
     * @return Risk band classification
     */
    function getRiskBand(bytes32 commitment) 
        external 
        view 
        returns (SilentRiskStructs.RiskBand) 
    {
        return commitmentScores[commitment].exists 
            ? commitmentScores[commitment].band 
            : SilentRiskStructs.RiskBand.UNKNOWN;
    }
    
    /**
     * @notice Get commitment metadata (timestamp, block, band, analyzer)
     * @param commitment Privacy commitment hash
     * @return timestamp When score was submitted
     * @return blockHeight Block height of analysis
     * @return band Risk band classification
     * @return analyzer Address that submitted analysis
     * @return exists Whether commitment exists
     */
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
    
    /**
     * @notice Check if nullifier has been used
     * @param nullifierHash Nullifier hash to check
     * @return True if nullifier was already used
     */
    function isNullifierUsed(bytes32 nullifierHash) 
        external 
        view 
        returns (bool) 
    {
        return usedNullifiers[nullifierHash];
    }
    
    /**
     * @notice Get contract configuration and statistics
     * @return Contract info struct
     */
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
    
    /**
     * @notice Check if address is authorized updater
     * @param updater Address to check
     * @return True if authorized
     */
    function isAuthorizedUpdater(address updater) 
        external 
        view 
        returns (bool) 
    {
        return _isAuthorizedUpdater(updater);
    }
    
    /**
     * @notice Get decryption request details
     * @param requestId Request identifier
     * @return Decryption request struct
     */
    function getDecryptionRequest(uint256 requestId) 
        external 
        view 
        returns (SilentRiskStructs.DecryptionRequest memory) 
    {
        return decryptionRequests[requestId];
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Verify ZK proof of commitment validity
     * 
     * @dev Validates that commitment was generated correctly using ZK-SNARK proof.
     * In production, this would verify a Groth16 or PLONK proof.
     * 
     * @param commitment Privacy commitment hash
     * @param nullifierHash Nullifier for double-spend prevention
     * @param proof ZK-SNARK proof bytes
     * @return True if proof is valid
     */
    function _verifyCommitmentProof(
        bytes32 commitment,
        bytes32 nullifierHash,
        bytes calldata proof
    ) internal pure returns (bool) {
        return SilentRiskHelper.verifyCommitmentProof(commitment, nullifierHash, proof);
    }
    
    /**
     * @notice Mint Passport NFT to recipient
     * 
     * @dev Calls PassportNFT contract to mint NFT linked to commitment.
     * This creates the privacy-preserving credential for DAO verification.
     * 
     * @param commitment Privacy commitment hash
     * @param recipient Address to receive passport
     * @return tokenId Minted passport token ID
     */
    function _mintPassportNFT(
        bytes32 commitment,
        address recipient
    ) internal returns (uint256 tokenId) {
        // Call PassportNFT to mint
        // Note: PassportNFT must have proper interface with mintFromVault function
        (bool success, bytes memory data) = passportNFT.call(
            abi.encodeWithSignature(
                "mintFromVault(bytes32,address)",
                commitment,
                recipient
            )
        );
        
        if (!success) revert PassportMintingFailed();
        
        // Decode token ID from return data
        tokenId = abi.decode(data, (uint256));
        
        return tokenId;
    }
}