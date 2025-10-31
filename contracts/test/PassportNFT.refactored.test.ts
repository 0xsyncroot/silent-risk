import { expect } from "chai";
import { ethers } from "hardhat";
import { PassportNFT, RiskScoreVault } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { loadFixture, time } from "@nomicfoundation/hardhat-network-helpers";

/**
 * PassportNFT Tests - Refactored Architecture
 * 
 * Tests the new architecture where:
 * - Passports are minted automatically by RiskScoreVault
 * - mintFromVault() is vault-only (no public minting)
 * - DAO verification via verifyRiskThreshold()
 * - No ZK proof verification in PassportNFT (handled by Vault)
 */
describe("PassportNFT - Refactored", function () {
  let passport: PassportNFT;
  let vault: RiskScoreVault;
  let owner: SignerWithAddress;
  let updater: SignerWithAddress;
  let recipient: SignerWithAddress;
  let dao: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  const TEST_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("test_commitment"));
  const TEST_NULLIFIER = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier"));
  const TEST_BLOCK_HEIGHT = 12345;
  const TEST_PROOF = ethers.hexlify(ethers.randomBytes(64));

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

    return { passport, vault, owner, updater, recipient, dao, unauthorized };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployFixture);
    passport = fixture.passport;
    vault = fixture.vault;
    owner = fixture.owner;
    updater = fixture.updater;
    recipient = fixture.recipient;
    dao = fixture.dao;
    unauthorized = fixture.unauthorized;
  });

  describe("Deployment", function () {
    it("Should set the correct vault address", async function () {
      expect(await passport.vault()).to.equal(await vault.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await passport.owner()).to.equal(owner.address);
    });

    it("Should have default passport validity period (30 days)", async function () {
      const validityPeriod = await passport.passportValidityPeriod();
      expect(validityPeriod).to.equal(30 * 24 * 60 * 60);
    });

    it("Should revert if vault address is zero", async function () {
      const PassportFactory = await ethers.getContractFactory("PassportNFT");
      await expect(
        PassportFactory.deploy(ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(passport, "InvalidVaultAddress");
    });

    it("Should initialize with zero supply", async function () {
      expect(await passport.totalSupply()).to.equal(0);
    });
  });

  describe("Automatic Minting via Vault", function () {
    it("Should mint passport when vault submits analysis", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // Submit via vault (automatically mints passport)
      const tx = await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Check PassportMinted event
      await expect(tx)
        .to.emit(passport, "PassportMinted")
        .withArgs(0, recipient.address, TEST_COMMITMENT, await time.latest() + 1 + 30 * 24 * 60 * 60);

      // Verify passport was minted
      expect(await passport.totalSupply()).to.equal(1);
      expect(await passport.ownerOf(0)).to.equal(recipient.address);
      expect(await passport.passportCommitments(0)).to.equal(TEST_COMMITMENT);
    });

    it("Should not allow direct minting (only vault)", async function () {
      // Try to call mintFromVault directly (should fail - only vault can call)
      await expect(
        passport.connect(unauthorized).mintFromVault(TEST_COMMITMENT, recipient.address)
      ).to.be.revertedWithCustomError(passport, "OnlyVault");
    });

    it("Should set expiration correctly", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      const beforeMint = await time.latest();

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      const expiry = await passport.passportExpiry(0);
      const validityPeriod = await passport.passportValidityPeriod();
      
      expect(expiry).to.be.closeTo(
        BigInt(beforeMint) + validityPeriod + BigInt(1),
        BigInt(10)
      );
    });

    it("Should reject if commitment not in vault", async function () {
      const FAKE_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      // Try to mint with non-existent commitment (vault will call mintFromVault)
      // This should fail in vault's submitRiskAnalysis, but we test passport's check
      await expect(
        passport.connect(await vault.getAddress()).mintFromVault(FAKE_COMMITMENT, recipient.address)
      ).to.be.revertedWithCustomError(passport, "CommitmentNotInVault");
    });

    it("Should prevent duplicate passports for same commitment", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // First mint
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Try to mint again with same commitment (should fail in vault due to nullifier)
      // But passport also checks for duplicate commitments
      await time.increase(3601); // Pass rate limit

      const TEST_NULLIFIER_2 = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier_2"));

      // This will fail because commitment already exists
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT, // Same commitment
          mockEncryptedScore,
          mockScoreProof,
          TEST_BLOCK_HEIGHT,
          TEST_NULLIFIER_2,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.reverted; // Will fail at vault level (commitment exists)
    });
  });

  describe("Passport Validation", function () {
    let tokenId: number;

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

      tokenId = 0;
    });

    it("Should return valid for non-expired passport", async function () {
      const [isValid, expiresAt] = await passport.isPassportValid(tokenId);
      expect(isValid).to.be.true;
      expect(expiresAt).to.be.gt(0);
    });

    it("Should return false for expired passport", async function () {
      const validityPeriod = await passport.passportValidityPeriod();
      await time.increase(Number(validityPeriod) + 1);

      const [isValid] = await passport.isPassportValid(tokenId);
      expect(isValid).to.be.false;
    });

    it("Should return false for non-existent passport", async function () {
      const [isValid] = await passport.isPassportValid(999);
      expect(isValid).to.be.false;
    });

    it("Should get passport commitment", async function () {
      const commitment = await passport.getPassportCommitment(tokenId);
      expect(commitment).to.equal(TEST_COMMITMENT);
    });

    it("Should get passport holder", async function () {
      const holder = await passport.getPassportHolder(tokenId);
      expect(holder).to.equal(recipient.address);
    });

    it("Should revert getting commitment for non-existent passport", async function () {
      await expect(
        passport.getPassportCommitment(999)
      ).to.be.revertedWith("Passport does not exist");
    });
  });

  describe("DAO Verification", function () {
    let tokenId: number;

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

      tokenId = 0;
    });

    it("Should allow DAO to verify risk threshold via passport", async function () {
      const mockThreshold = ethers.ZeroHash;
      const mockThresholdProof = "0x";

      // DAO verifies via passport (delegates to vault)
      await expect(
        passport.connect(dao).verifyRiskThreshold(
          tokenId,
          mockThreshold,
          mockThresholdProof
        )
      ).to.not.be.reverted;
    });

    it("Should get passport risk band", async function () {
      const band = await passport.getPassportRiskBand(tokenId);
      expect(band).to.be.oneOf([1, 2, 3]); // LOW, MEDIUM, or HIGH
    });

    it("Should revert verification for expired passport", async function () {
      const validityPeriod = await passport.passportValidityPeriod();
      await time.increase(Number(validityPeriod) + 1);

      const mockThreshold = ethers.ZeroHash;
      const mockThresholdProof = "0x";

      await expect(
        passport.connect(dao).verifyRiskThreshold(
          tokenId,
          mockThreshold,
          mockThresholdProof
        )
      ).to.be.revertedWithCustomError(passport, "PassportExpired");
    });

    it("Should revert verification for non-existent passport", async function () {
      const mockThreshold = ethers.ZeroHash;
      const mockThresholdProof = "0x";

      await expect(
        passport.connect(dao).verifyRiskThreshold(
          999,
          mockThreshold,
          mockThresholdProof
        )
      ).to.be.revertedWith("Passport does not exist");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set validity period", async function () {
      const newPeriod = 60 * 24 * 60 * 60; // 60 days
      
      await expect(passport.setValidityPeriod(newPeriod))
        .to.emit(passport, "ValidityPeriodUpdated")
        .withArgs(newPeriod);
      
      expect(await passport.passportValidityPeriod()).to.equal(newPeriod);
    });

    it("Should revert if non-owner tries to set validity period", async function () {
      await expect(
        passport.connect(unauthorized).setValidityPeriod(60 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(passport, "OwnableUnauthorizedAccount");
    });

    it("Should revert if period is zero", async function () {
      await expect(
        passport.setValidityPeriod(0)
      ).to.be.revertedWith("Invalid period");
    });

    it("Should revert if period is too long", async function () {
      await expect(
        passport.setValidityPeriod(366 * 24 * 60 * 60)
      ).to.be.revertedWith("Invalid period");
    });

    it("Should allow owner to revoke passport", async function () {
      // Mint passport first
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

      const tx = await passport.revokePassport(0, "Test revocation");
      await expect(tx)
        .to.emit(passport, "PassportRevoked")
        .withArgs(0, owner.address, "Test revocation");

      const [isValid] = await passport.isPassportValid(0);
      expect(isValid).to.be.false;
    });

    it("Should revert if non-owner tries to revoke", async function () {
      await expect(
        passport.connect(unauthorized).revokePassport(0, "Test")
      ).to.be.revertedWithCustomError(passport, "OwnableUnauthorizedAccount");
    });
  });

  describe("NFT Transfer", function () {
    let tokenId: number;

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

      tokenId = 0;
    });

    it("Should allow passport transfer", async function () {
      await passport.connect(recipient).transferFrom(
        recipient.address,
        dao.address,
        tokenId
      );

      expect(await passport.ownerOf(tokenId)).to.equal(dao.address);
    });

    it("Should maintain commitment link after transfer", async function () {
      await passport.connect(recipient).transferFrom(
        recipient.address,
        dao.address,
        tokenId
      );

      expect(await passport.passportCommitments(tokenId)).to.equal(TEST_COMMITMENT);
    });

    it("Should maintain expiration after transfer", async function () {
      const expiryBefore = await passport.passportExpiry(tokenId);

      await passport.connect(recipient).transferFrom(
        recipient.address,
        dao.address,
        tokenId
      );

      const expiryAfter = await passport.passportExpiry(tokenId);
      expect(expiryAfter).to.equal(expiryBefore);
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

    it("Should get total supply", async function () {
      expect(await passport.totalSupply()).to.equal(1);
    });

    it("Should get validity period", async function () {
      const period = await passport.getValidityPeriod();
      expect(period).to.equal(30 * 24 * 60 * 60);
    });
  });

  describe("Multiple Passports", function () {
    it("Should mint multiple passports for different commitments", async function () {
      const mockEncryptedScore = ethers.ZeroHash;
      const mockScoreProof = "0x";

      // First passport
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      await time.increase(3601); // Pass rate limit

      // Second passport
      const TEST_COMMITMENT_2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
      const TEST_NULLIFIER_2 = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier_2"));

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT_2,
        mockEncryptedScore,
        mockScoreProof,
        TEST_BLOCK_HEIGHT,
        TEST_NULLIFIER_2,
        TEST_PROOF,
        dao.address
      );

      expect(await passport.totalSupply()).to.equal(2);
      expect(await passport.ownerOf(0)).to.equal(recipient.address);
      expect(await passport.ownerOf(1)).to.equal(dao.address);
    });
  });
});
