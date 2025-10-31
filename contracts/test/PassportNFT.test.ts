/**
 * PassportNFT Simplified Tests
 * 
 * Tests PassportNFT logic WITHOUT FHE dependencies
 * Uses mocked RiskScoreVault instead of real implementation
 */

import { expect } from "chai";
import { ethers } from "hardhat";
import { PassportNFT } from "../typechain-types";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";

describe("PassportNFT (Simplified)", function () {
  let passportNFT: PassportNFT;
  let mockVault: any;
  let mockVerifier: any;
  
  let owner: SignerWithAddress;
  let user: SignerWithAddress;
  let anonymousWallet: SignerWithAddress;

  const MOCK_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("test_commitment"));
  const MOCK_NULLIFIER = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier"));

  beforeEach(async function () {
    [owner, user, anonymousWallet] = await ethers.getSigners();

    // Deploy Mock RiskScoreVault (simplified version for testing)
    const MockRiskScoreVaultFactory = await ethers.getContractFactory("MockRiskScoreVault");
    mockVault = await MockRiskScoreVaultFactory.deploy();
    await mockVault.waitForDeployment();

    // Deploy Mock Verifier
    const MockVerifierFactory = await ethers.getContractFactory("MockVerifier");
    mockVerifier = await MockVerifierFactory.deploy();
    await mockVerifier.waitForDeployment();

    // Deploy PassportNFT
    const PassportNFTFactory = await ethers.getContractFactory("PassportNFT");
    passportNFT = await PassportNFTFactory.deploy(
      await mockVault.getAddress(),
      await mockVerifier.getAddress()
    );
    await passportNFT.waitForDeployment();
  });

  describe("Deployment", function () {
    it("Should set the correct vault address", async function () {
      expect(await passportNFT.vault()).to.equal(await mockVault.getAddress());
    });

    it("Should set the correct verifier address", async function () {
      expect(await passportNFT.verifier()).to.equal(await mockVerifier.getAddress());
    });

    it("Should set the correct owner", async function () {
      expect(await passportNFT.owner()).to.equal(owner.address);
    });

    it("Should have default passport validity period (30 days)", async function () {
      const validityPeriod = await passportNFT.passportValidityPeriod();
      expect(validityPeriod).to.equal(30 * 24 * 60 * 60);
    });

    it("Should revert if vault address is zero", async function () {
      const PassportNFTFactory = await ethers.getContractFactory("PassportNFT");
      await expect(
        PassportNFTFactory.deploy(ethers.ZeroAddress, await mockVerifier.getAddress())
      ).to.be.revertedWithCustomError(passportNFT, "InvalidVaultAddress");
    });

    it("Should revert if verifier address is zero", async function () {
      const PassportNFTFactory = await ethers.getContractFactory("PassportNFT");
      await expect(
        PassportNFTFactory.deploy(await mockVault.getAddress(), ethers.ZeroAddress)
      ).to.be.revertedWithCustomError(passportNFT, "InvalidVerifierAddress");
    });
  });

  describe("Passport Minting", function () {
    let mockProof: any;

    beforeEach(async function () {
      mockProof = {
        proof_a: [1, 2],
        proof_b: [[3, 4], [5, 6]],
        proof_c: [7, 8]
      };

      // Setup mock vault to have commitment
      await mockVault.setCommitmentExists(MOCK_COMMITMENT, true);
      
      // Setup mock verifier to pass
      await mockVerifier.setVerificationResult(true);
    });

    it("Should mint passport with valid ZK proof", async function () {
      const tx = await passportNFT.mintPassport(
        mockProof.proof_a,
        mockProof.proof_b,
        mockProof.proof_c,
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );

      await expect(tx)
        .to.emit(passportNFT, "PassportMinted");
      // Note: Not checking block number in event as it varies

      expect(await passportNFT.ownerOf(0)).to.equal(anonymousWallet.address);
      expect(await passportNFT.passportCommitments(0)).to.equal(MOCK_COMMITMENT);
    });

    it("Should revert if commitment not in vault", async function () {
      const FAKE_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("fake"));

      await expect(
        passportNFT.mintPassport(
          mockProof.proof_a,
          mockProof.proof_b,
          mockProof.proof_c,
          FAKE_COMMITMENT,
          MOCK_NULLIFIER,
          anonymousWallet.address
        )
      ).to.be.revertedWithCustomError(passportNFT, "CommitmentNotInVault");
    });

    it("Should revert if nullifier already used", async function () {
      // First mint
      await passportNFT.mintPassport(
        mockProof.proof_a,
        mockProof.proof_b,
        mockProof.proof_c,
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );

      // Setup another commitment
      const MOCK_COMMITMENT_2 = ethers.keccak256(ethers.toUtf8Bytes("test_commitment_2"));
      await mockVault.setCommitmentExists(MOCK_COMMITMENT_2, true);

      // Try to mint again with same nullifier
      await expect(
        passportNFT.mintPassport(
          mockProof.proof_a,
          mockProof.proof_b,
          mockProof.proof_c,
          MOCK_COMMITMENT_2,
          MOCK_NULLIFIER,
          user.address
        )
      ).to.be.revertedWithCustomError(passportNFT, "NullifierAlreadyUsed");
    });

    it("Should revert if ZK proof is invalid", async function () {
      await mockVerifier.setVerificationResult(false);

      await expect(
        passportNFT.mintPassport(
          mockProof.proof_a,
          mockProof.proof_b,
          mockProof.proof_c,
          MOCK_COMMITMENT,
          MOCK_NULLIFIER,
          anonymousWallet.address
        )
      ).to.be.revertedWithCustomError(passportNFT, "InvalidProof");
    });

    it("Should revert if recipient is zero address", async function () {
      await expect(
        passportNFT.mintPassport(
          mockProof.proof_a,
          mockProof.proof_b,
          mockProof.proof_c,
          MOCK_COMMITMENT,
          MOCK_NULLIFIER,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(passportNFT, "ZeroAddress");
    });

    it("Should set expiration correctly", async function () {
      const beforeMint = await ethers.provider.getBlock("latest");
      
      await passportNFT.mintPassport(
        mockProof.proof_a,
        mockProof.proof_b,
        mockProof.proof_c,
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );

      const expiry = await passportNFT.passportExpiry(0);
      const validityPeriod = await passportNFT.passportValidityPeriod();
      
      expect(expiry).to.be.closeTo(
        BigInt(beforeMint!.timestamp) + validityPeriod,
        BigInt(10)
      );
    });

    it("Should increment total supply", async function () {
      expect(await passportNFT.totalSupply()).to.equal(0);

      await passportNFT.mintPassport(
        mockProof.proof_a,
        mockProof.proof_b,
        mockProof.proof_c,
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );

      expect(await passportNFT.totalSupply()).to.equal(1);
    });
  });

  describe("Passport Validation", function () {
    let tokenId: number;

    beforeEach(async function () {
      await mockVault.setCommitmentExists(MOCK_COMMITMENT, true);
      await mockVerifier.setVerificationResult(true);
      
      const tx = await passportNFT.mintPassport(
        [1, 2],
        [[3, 4], [5, 6]],
        [7, 8],
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );
      
      await tx.wait();
      tokenId = 0;
    });

    it("Should return valid for non-expired passport", async function () {
      const [isValid, expiresAt] = await passportNFT.isPassportValid(tokenId);
      expect(isValid).to.be.true;
      expect(expiresAt).to.be.gt(0);
    });

    it("Should return false for expired passport", async function () {
      const validityPeriod = await passportNFT.passportValidityPeriod();
      await ethers.provider.send("evm_increaseTime", [Number(validityPeriod) + 1]);
      await ethers.provider.send("evm_mine", []);

      const [isValid] = await passportNFT.isPassportValid(tokenId);
      expect(isValid).to.be.false;
    });

    it("Should return false for non-existent passport", async function () {
      const [isValid] = await passportNFT.isPassportValid(999);
      expect(isValid).to.be.false;
    });

    it("Should get passport commitment", async function () {
      const commitment = await passportNFT.getPassportCommitment(tokenId);
      expect(commitment).to.equal(MOCK_COMMITMENT);
    });

    it("Should revert getting commitment for non-existent passport", async function () {
      await expect(
        passportNFT.getPassportCommitment(999)
      ).to.be.revertedWith("Passport does not exist");
    });
  });

  describe("Admin Functions", function () {
    it("Should allow owner to set validity period", async function () {
      const newPeriod = 60 * 24 * 60 * 60; // 60 days
      await passportNFT.setValidityPeriod(newPeriod);
      expect(await passportNFT.passportValidityPeriod()).to.equal(newPeriod);
    });

    it("Should revert if non-owner tries to set validity period", async function () {
      await expect(
        passportNFT.connect(user).setValidityPeriod(60 * 24 * 60 * 60)
      ).to.be.revertedWithCustomError(passportNFT, "OwnableUnauthorizedAccount");
    });

    it("Should revert if period is zero", async function () {
      await expect(
        passportNFT.setValidityPeriod(0)
      ).to.be.revertedWith("Invalid period");
    });

    it("Should revert if period is too long", async function () {
      await expect(
        passportNFT.setValidityPeriod(366 * 24 * 60 * 60)
      ).to.be.revertedWith("Invalid period");
    });

    it("Should allow owner to revoke passport", async function () {
      // Mint passport first
      await mockVault.setCommitmentExists(MOCK_COMMITMENT, true);
      await mockVerifier.setVerificationResult(true);
      await passportNFT.mintPassport(
        [1, 2],
        [[3, 4], [5, 6]],
        [7, 8],
        MOCK_COMMITMENT,
        MOCK_NULLIFIER,
        anonymousWallet.address
      );

      const tx = await passportNFT.revokePassport(0, "Test revocation");
      await expect(tx)
        .to.emit(passportNFT, "PassportRevoked")
        .withArgs(0, owner.address, "Test revocation");

      const [isValid] = await passportNFT.isPassportValid(0);
      expect(isValid).to.be.false;
    });

    it("Should revert if non-owner tries to revoke", async function () {
      await expect(
        passportNFT.connect(user).revokePassport(0, "Test")
      ).to.be.revertedWithCustomError(passportNFT, "OwnableUnauthorizedAccount");
    });
  });
});

