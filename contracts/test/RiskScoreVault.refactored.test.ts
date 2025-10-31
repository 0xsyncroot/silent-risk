import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RiskScoreVault, PassportNFT } from "../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * RiskScoreVault Tests - Refactored Architecture
 * 
 * Tests the new architecture where:
 * - submitRiskAnalysis() stores score + auto-mints passport
 * - verifyRiskThreshold() for DAO verification
 * - No more setRiskScoreFromPlaintext()
 */
describe("RiskScoreVault - Refactored", function () {
  let vault: RiskScoreVault;
  let passport: PassportNFT;
  let owner: SignerWithAddress;
  let updater: SignerWithAddress;
  let recipient: SignerWithAddress;
  let dao: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // Test constants
  const SCORE_PRECISION = 100;
  const MAX_RISK_SCORE = 10000;
  const SCORE_VALIDITY_PERIOD = 30 * 24 * 60 * 60; // 30 days

  // Test data
  const TEST_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("test_commitment"));
  const TEST_NULLIFIER = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier"));
  const TEST_BLOCK_HEIGHT = 12345;
  const TEST_PROOF = ethers.hexlify(ethers.randomBytes(64)); // Mock ZK proof

  async function deployFixture() {
    const [owner, updater, recipient, dao, unauthorized] = await ethers.getSigners();

    // Deploy RiskScoreVault
    const VaultFactory = await ethers.getContractFactory("RiskScoreVault");
    const vault = await VaultFactory.deploy(owner.address);
    await vault.waitForDeployment();

    // Deploy PassportNFT
    const PassportFactory = await ethers.getContractFactory("PassportNFT");
    const passport = await PassportFactory.deploy(await vault.getAddress());
    await passport.waitForDeployment();

    // Link PassportNFT to Vault
    await vault.connect(owner).setPassportNFT(await passport.getAddress());

    // Authorize updater
    await vault.connect(owner).setAuthorizedUpdater(updater.address, true);

    return { vault, passport, owner, updater, recipient, dao, unauthorized };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    vault = fixture.vault;
    passport = fixture.passport;
    owner = fixture.owner;
    updater = fixture.updater;
    recipient = fixture.recipient;
    dao = fixture.dao;
    unauthorized = fixture.unauthorized;
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await vault.SCORE_PRECISION()).to.equal(SCORE_PRECISION);
      expect(await vault.MAX_RISK_SCORE()).to.equal(MAX_RISK_SCORE);
      expect(await vault.SCORE_VALIDITY_PERIOD()).to.equal(SCORE_VALIDITY_PERIOD);
    });

    it("Should initialize with zero scored addresses", async function () {
      expect(await vault.totalScoredAddresses()).to.equal(0);
    });

    it("Should not be paused initially", async function () {
      expect(await vault.paused()).to.equal(false);
    });

    it("Should have PassportNFT linked", async function () {
      expect(await vault.passportNFT()).to.equal(await passport.getAddress());
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to set PassportNFT address", async function () {
      const newPassport = await (await ethers.getContractFactory("PassportNFT")).deploy(await vault.getAddress());
      await vault.connect(owner).setPassportNFT(await newPassport.getAddress());
      expect(await vault.passportNFT()).to.equal(await newPassport.getAddress());
    });

    it("Should not allow non-owner to set PassportNFT", async function () {
      const newPassport = await (await ethers.getContractFactory("PassportNFT")).deploy(await vault.getAddress());
      await expect(
        vault.connect(unauthorized).setPassportNFT(await newPassport.getAddress())
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should allow owner to authorize updaters", async function () {
      await expect(vault.connect(owner).setAuthorizedUpdater(dao.address, true))
        .to.emit(vault, "UpdaterAuthorized")
        .withArgs(dao.address, true, await time.latest() + 1);

      expect(await vault.isAuthorizedUpdater(dao.address)).to.equal(true);
    });

    it("Should recognize owner as authorized updater", async function () {
      expect(await vault.isAuthorizedUpdater(owner.address)).to.equal(true);
    });
  });

  describe("submitRiskAnalysis - Core Function", function () {
    it("Should submit analysis and auto-mint passport", async function () {
      // Mock encrypted score (in real scenario, this would be FHE encrypted)
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      const tx = await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Check RiskAnalysisSubmitted event
      await expect(tx).to.emit(vault, "RiskAnalysisSubmitted");

      // Check PassportMinted event from PassportNFT
      await expect(tx).to.emit(passport, "PassportMinted");

      // Verify commitment exists
      const metadata = await vault.getCommitmentMetadata(TEST_COMMITMENT);
      expect(metadata.exists).to.equal(true);
      expect(metadata.analyzer).to.equal(updater.address);
      expect(metadata.blockHeight).to.equal(TEST_BLOCK_HEIGHT);

      // Verify passport was minted
      expect(await passport.totalSupply()).to.equal(1);
      expect(await passport.ownerOf(0)).to.equal(recipient.address);
      expect(await passport.passportCommitments(0)).to.equal(TEST_COMMITMENT);
    });

    it("Should not allow unauthorized updater", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await expect(
        vault.connect(unauthorized).submitRiskAnalysis(
          TEST_COMMITMENT,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should reject if PassportNFT not set", async function () {
      // Deploy new vault without passport
      const VaultFactory = await ethers.getContractFactory("RiskScoreVault");
      const newVault = await VaultFactory.deploy(owner.address);
      await newVault.connect(owner).setAuthorizedUpdater(updater.address, true);

      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await expect(
        newVault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(newVault, "PassportNFTNotSet");
    });

    it("Should reject zero recipient address", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER,
          TEST_PROOF,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("Should reject invalid block height", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          mockEncryptedScore,
          mockScoreProof,
          0, // Invalid block height
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidBlockHeight");
    });

    it("Should reject reused nullifier", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Try to reuse nullifier
      const TEST_COMMITMENT_2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
      
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT_2,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER, // Same nullifier
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "NullifierAlreadyUsed");
    });

    it("Should increment totalScoredAddresses", async function () {
      expect(await vault.totalScoredAddresses()).to.equal(0);

      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.totalScoredAddresses()).to.equal(1);
    });
  });

  describe("DAO Verification Functions", function () {
    beforeEach(async function () {
      // Submit a risk analysis first
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );
    });

    it("Should allow DAO to verify risk threshold", async function () {
      const mockThreshold = ethers.ZeroHash;
      const mockThresholdProof = "0x";

      // This will use FHE comparison in real implementation
      const tx = await vault.connect(dao).verifyRiskThreshold(
        TEST_COMMITMENT,
        mockThreshold,
        mockThresholdProof
      );

      await expect(tx).to.emit(vault, "DAOVerificationPerformed");
    });

    it("Should allow verification via PassportNFT", async function () {
      const mockThreshold = ethers.ZeroHash;
      const mockThresholdProof = "0x";
      const tokenId = 0;

      // Verify via passport (delegates to vault)
      await passport.connect(dao).verifyRiskThreshold(
        tokenId,
        mockThreshold,
        mockThresholdProof
      );
    });

    it("Should get commitment risk band", async function () {
      const band = await vault.getCommitmentRiskBand(TEST_COMMITMENT);
      expect(band).to.be.oneOf([1, 2, 3]); // LOW, MEDIUM, or HIGH
    });

    it("Should return UNKNOWN for non-existent commitment", async function () {
      const FAKE_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      const band = await vault.getCommitmentRiskBand(FAKE_COMMITMENT);
      expect(band).to.equal(0); // UNKNOWN
    });
  });

  describe("View Functions", function () {
    beforeEach(async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );
    });

    it("Should get commitment metadata", async function () {
      const metadata = await vault.getCommitmentMetadata(TEST_COMMITMENT);
      
      expect(metadata.exists).to.equal(true);
      expect(metadata.blockHeight).to.equal(TEST_BLOCK_HEIGHT);
      expect(metadata.analyzer).to.equal(updater.address);
      expect(metadata.timestamp).to.be.gt(0);
    });

    it("Should check if nullifier is used", async function () {
      expect(await vault.isNullifierUsed(TEST_NULLIFIER)).to.equal(true);
      
      const UNUSED_NULLIFIER = ethers.keccak256(ethers.toUtf8Bytes("unused"));
      expect(await vault.isNullifierUsed(UNUSED_NULLIFIER)).to.equal(false);
    });

    it("Should get contract info", async function () {
      const info = await vault.getContractInfo();
      
      expect(info.scorePrecision).to.equal(SCORE_PRECISION);
      expect(info.maxRiskScore).to.equal(MAX_RISK_SCORE);
      expect(info.scoreValidityPeriod).to.equal(SCORE_VALIDITY_PERIOD);
      expect(info.owner).to.equal(owner.address);
      expect(info.totalScoredAddresses).to.equal(1);
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow owner to pause contract", async function () {
      await vault.connect(owner).pause();
      expect(await vault.paused()).to.equal(true);
    });

    it("Should prevent operations when paused", async function () {
      await vault.connect(owner).pause();

      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
    });

    it("Should allow owner to unpause contract", async function () {
      await vault.connect(owner).pause();
      await vault.connect(owner).unpause();
      expect(await vault.paused()).to.equal(false);
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        vault.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });
  });

  describe("Rate Limiting", function () {
    it("Should enforce rate limiting between submissions", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Try immediate second submission (should fail)
      const TEST_COMMITMENT_2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
      const TEST_NULLIFIER_2 = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier_2"));

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT_2,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER_2,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "RateLimited");
    });

    it("Should allow submission after rate limit period", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Wait for rate limit period (default 1 hour)
      await time.increase(3601);

      // Second submission should succeed
      const TEST_COMMITMENT_2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
      const TEST_NULLIFIER_2 = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier_2"));

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT_2,
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER_2,
          TEST_PROOF,
          recipient.address
        )
      ).to.not.be.reverted;
    });
  });

  describe("Admin Configuration", function () {
    it("Should allow owner to set min update interval", async function () {
      const newInterval = 7200; // 2 hours
      await vault.connect(owner).setMinUpdateInterval(newInterval);
      expect(await vault.minUpdateInterval()).to.equal(newInterval);
    });

    it("Should reject invalid min update interval", async function () {
      const invalidInterval = 25 * 60 * 60; // 25 hours
      await expect(
        vault.connect(owner).setMinUpdateInterval(invalidInterval)
      ).to.be.revertedWithCustomError(vault, "IntervalTooLong");
    });
  });
});
