// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@fhevm/solidity/lib/FHE.sol";
import "./RiskScoreVault.sol";
import "./libraries/SilentRiskStructs.sol";

/**
 * @title PassportNFT
 * @notice Privacy-preserving risk passport using Zama FHE
 * 
 * @dev Architecture Overview:
 * ┌─────────────────────────────────────────────────────────────────────────────┐
 * │ PASSPORT LIFECYCLE: Automatic Minting + DAO Verification                    │
 * │                                                                              │
 * │ 1. User submits risk analysis to RiskScoreVault                             │
 * │ 2. Vault automatically mints Passport NFT (this contract)                   │
 * │ 3. Passport links to commitment (encrypted score in vault)                  │
 * │ 4. DAOs verify passport via FHE threshold checks                            │
 * │ 5. No wallet linkage, no score decryption needed                            │
 * └─────────────────────────────────────────────────────────────────────────────┘
 * 
 * @dev Key Features:
 * - Automatic minting from RiskScoreVault (no separate mint transaction)
 * - Links passport to commitment for FHE verification
 * - Time-based expiration (default 30 days)
 * - DAO verification via vault's FHE comparison functions
 * 
 * @dev Privacy Properties:
 * - Passport holder != analyzed wallet (unlinkable)
 * - Exact score never revealed (FHE encrypted)
 * - DAOs get boolean result only (meets threshold or not)
 * - No on-chain correlation between original wallet and passport
 * 
 * @author 0xSyncroot - Silent Risk Team
 */

contract PassportNFT is ERC721, Ownable, ReentrancyGuard {
    using FHE for ebool;
    
    // ============ STATE VARIABLES ============
    
    /// @notice RiskScoreVault contract (stores encrypted scores)
    RiskScoreVault public immutable vault;
    
    /// @notice Links passport NFT to commitment in vault
    mapping(uint256 => bytes32) public passportCommitments;
    
    /// @notice Passport expiration timestamps
    mapping(uint256 => uint256) public passportExpiry;
    
    /// @notice Token ID counter
    uint256 private _nextTokenId;
    
    /// @notice Passport validity period (30 days default)
    uint256 public passportValidityPeriod = 30 days;
    
    // ============ EVENTS ============
    
    /**
     * @notice Emitted when passport is minted from vault
     * @param tokenId Minted passport token ID
     * @param holder Address receiving the passport
     * @param commitment Commitment hash linked to this passport
     * @param expiresAt Expiration timestamp
     */
    event PassportMinted(
        uint256 indexed tokenId,
        address indexed holder,
        bytes32 indexed commitment,
        uint256 expiresAt
    );
    
    /**
     * @notice Emitted when passport is revoked by admin
     * @param tokenId Revoked passport token ID
     * @param revoker Admin address performing revocation
     * @param reason Reason for revocation
     */
    event PassportRevoked(
        uint256 indexed tokenId,
        address indexed revoker,
        string reason
    );
    
    /**
     * @notice Emitted when validity period is updated
     * @param newPeriod New validity period in seconds
     */
    event ValidityPeriodUpdated(
        uint256 newPeriod
    );
    
    // ============ ERRORS ============
    
    error InvalidVaultAddress();
    error CommitmentNotInVault();
    error PassportExpired();
    error ZeroAddress();
    error OnlyVault();
    error CommitmentAlreadyUsed();
    
    // ============ MODIFIERS ============
    
    /**
     * @notice Restrict function to vault contract only
     */
    modifier onlyVault() {
        if (msg.sender != address(vault)) revert OnlyVault();
        _;
    }
    
    // ============ CONSTRUCTOR ============
    
    /**
     * @notice Initialize PassportNFT contract
     * @param _vault RiskScoreVault contract address
     */
    constructor(
        address _vault
    ) ERC721("Silent Risk Passport", "SRP") Ownable(msg.sender) {
        if (_vault == address(0)) revert InvalidVaultAddress();
        vault = RiskScoreVault(_vault);
    }
    
    // ============ CORE MINTING FUNCTION ============
    
    /**
     * @notice Mint passport from vault (called automatically during submission)
     * 
     * @dev This function is called by RiskScoreVault during submitRiskAnalysis.
     * It creates a passport NFT linked to the commitment for DAO verification.
     * 
     * @dev Flow:
     * 1. Vault calls this function after storing encrypted score
     * 2. Passport is minted to recipient address
     * 3. Passport links to commitment for FHE verification
     * 4. Expiration timestamp is set (default 30 days)
     * 
     * @dev Privacy Properties:
     * - Recipient can be different from analyzed wallet
     * - No on-chain link between original wallet and passport holder
     * - Commitment enables FHE verification without revealing score
     * 
     * @param commitment Commitment hash from vault
     * @param recipient Address to receive passport
     * @return tokenId Minted passport token ID
     */
    function mintFromVault(
        bytes32 commitment,
        address recipient
    ) 
        external 
        onlyVault
        nonReentrant 
        returns (uint256 tokenId) 
    {
        if (recipient == address(0)) revert ZeroAddress();
        
        // Verify commitment exists in vault
        (
            ,  // timestamp
            ,  // blockHeight
            ,  // band
            ,  // analyzer
            bool exists
        ) = vault.getCommitmentMetadata(commitment);
        
        if (!exists) revert CommitmentNotInVault();
        
        // Check if commitment already has a passport
        // Note: In current design, one commitment = one passport
        // If you want multiple passports per commitment, remove this check
        for (uint256 i = 0; i < _nextTokenId; i++) {
            if (passportCommitments[i] == commitment) {
                revert CommitmentAlreadyUsed();
            }
        }
        
        // Mint passport NFT
        tokenId = _nextTokenId++;
        _safeMint(recipient, tokenId);
        
        // Link passport to commitment (enables DAO verification)
        passportCommitments[tokenId] = commitment;
        
        // Set expiration timestamp
        uint256 expiresAt = block.timestamp + passportValidityPeriod;
        passportExpiry[tokenId] = expiresAt;
        
        emit PassportMinted(tokenId, recipient, commitment, expiresAt);
        
        return tokenId;
    }
    
    // ============ DAO VERIFICATION FUNCTIONS ============
    
    /**
     * @notice Verify if passport holder meets risk threshold
     * 
     * @dev DAOs use this function to verify user risk levels WITHOUT learning exact scores.
     * Leverages vault's FHE comparison to return only boolean result.
     * 
     * @dev Use Cases:
     * - DAO membership: "Does user have LOW risk?" (threshold = 3000)
     * - Protocol access: "Is user below MEDIUM risk?" (threshold = 5000)
     * - Lending: "Can user borrow at this rate?" (threshold = 4000)
     * 
     * @dev Privacy Guarantees:
     * - DAO learns ONLY boolean result (meets threshold or not)
     * - Exact risk score remains encrypted in vault
     * - No information leakage about actual score value
     * - Passport holder's original wallet never revealed
     * 
     * @param tokenId Passport token ID to verify
     * @param threshold Encrypted threshold value for comparison
     * @param thresholdProof FHE proof for threshold validation
     * 
     * @return meetsThreshold True if passport's encrypted score < threshold
     */
    function verifyRiskThreshold(
        uint256 tokenId,
        externalEuint32 threshold,
        bytes calldata thresholdProof
    ) external returns (bool meetsThreshold) {
        _requireValidPassport(tokenId);
        
        bytes32 commitment = passportCommitments[tokenId];
        
        // Delegate to vault's FHE comparison function
        // This performs encrypted comparison without decryption
        return vault.verifyRiskThreshold(commitment, threshold, thresholdProof);
    }
    
    /**
     * @notice Get coarse-grained risk band for passport (non-encrypted)
     * 
     * @dev Risk bands provide general classification without revealing exact scores.
     * Bands: LOW (0-30%), MEDIUM (30-70%), HIGH (70-100%)
     * 
     * @param tokenId Passport token ID
     * @return band Risk band classification
     */
    function getPassportRiskBand(uint256 tokenId) 
        external 
        view 
        returns (SilentRiskStructs.RiskBand band) 
    {
        _requireValidPassport(tokenId);
        
        bytes32 commitment = passportCommitments[tokenId];
        return vault.getCommitmentRiskBand(commitment);
    }
    
    /**
     * @notice Check if passport is valid (exists and not expired)
     * 
     * @param tokenId Passport token ID
     * @return isValid True if passport exists and not expired
     * @return expiresAt Expiration timestamp
     */
    function isPassportValid(uint256 tokenId) 
        external 
        view 
        returns (bool isValid, uint256 expiresAt) 
    {
        if (!_exists(tokenId)) {
            return (false, 0);
        }
        
        expiresAt = passportExpiry[tokenId];
        isValid = block.timestamp <= expiresAt;
    }
    
    /**
     * @notice Get commitment hash associated with passport
     * 
     * @dev Useful for DAOs that want to query vault directly.
     * Commitment enables FHE verification without revealing original wallet.
     * 
     * @param tokenId Passport token ID
     * @return commitment Commitment hash in vault
     */
    function getPassportCommitment(uint256 tokenId) 
        external 
        view 
        returns (bytes32 commitment) 
    {
        require(_exists(tokenId), "Passport does not exist");
        return passportCommitments[tokenId];
    }
    
    /**
     * @notice Get passport holder address
     * 
     * @param tokenId Passport token ID
     * @return holder Current owner of passport
     */
    function getPassportHolder(uint256 tokenId) 
        external 
        view 
        returns (address holder) 
    {
        require(_exists(tokenId), "Passport does not exist");
        return _ownerOf(tokenId);
    }
    
    // ============ ADMIN FUNCTIONS ============
    
    /**
     * @notice Set passport validity period
     * 
     * @dev Controls how long passports remain valid after minting.
     * Affects all newly minted passports (not retroactive).
     * 
     * @param period Validity period in seconds (max 365 days)
     */
    function setValidityPeriod(uint256 period) external onlyOwner {
        require(period > 0 && period <= 365 days, "Invalid period");
        passportValidityPeriod = period;
        emit ValidityPeriodUpdated(period);
    }
    
    /**
     * @notice Revoke passport (emergency only)
     * 
     * @dev Should only be used in exceptional circumstances:
     * - Compromised commitment
     * - Fraudulent analysis
     * - Compliance requirements
     * 
     * @param tokenId Passport to revoke
     * @param reason Reason for revocation (for transparency)
     */
    function revokePassport(uint256 tokenId, string calldata reason) 
        external 
        onlyOwner 
    {
        require(_exists(tokenId), "Passport does not exist");
        
        // Set expiry to past (effectively invalidates passport)
        passportExpiry[tokenId] = block.timestamp - 1;
        
        emit PassportRevoked(tokenId, msg.sender, reason);
    }
    
    // ============ INTERNAL FUNCTIONS ============
    
    /**
     * @notice Require passport exists and is not expired
     * 
     * @dev Used by verification functions to ensure passport validity.
     * Reverts if passport doesn't exist or has expired.
     * 
     * @param tokenId Passport token ID to validate
     */
    function _requireValidPassport(uint256 tokenId) internal view {
        require(_exists(tokenId), "Passport does not exist");
        
        if (block.timestamp > passportExpiry[tokenId]) {
            revert PassportExpired();
        }
    }
    
    /**
     * @notice Check if token exists
     * 
     * @param tokenId Token ID to check
     * @return True if token exists
     */
    function _exists(uint256 tokenId) internal view returns (bool) {
        return _ownerOf(tokenId) != address(0);
    }
    
    // ============ VIEW FUNCTIONS ============
    
    /**
     * @notice Get total number of passports minted
     * 
     * @return Total supply of passports
     */
    function totalSupply() external view returns (uint256) {
        return _nextTokenId;
    }
    
    /**
     * @notice Get passport validity period
     * 
     * @return Validity period in seconds
     */
    function getValidityPeriod() external view returns (uint256) {
        return passportValidityPeriod;
    }
}

