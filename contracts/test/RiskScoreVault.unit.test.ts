import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { TestRiskScoreVault, PassportNFT } from "../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

/**
 * RiskScoreVault - REAL Unit Tests
 * 
 * Tests business logic without FHE dependencies:
 * - Access control
 * - Risk band classification
 * - Nullifier management
 * - Rate limiting
 * - Passport minting integration
 * - DAO verification logic
 */
describe("RiskScoreVault - Unit Tests", function () {
  let vault: TestRiskScoreVault;
  let passport: PassportNFT;
  let owner: SignerWithAddress;
  let updater: SignerWithAddress;
  let recipient: SignerWithAddress;
  let dao: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // Test data
  const TEST_COMMITMENT = ethers.keccak256(ethers.toUtf8Bytes("test_commitment"));
  const TEST_NULLIFIER = ethers.keccak256(ethers.toUtf8Bytes("test_nullifier"));
  const TEST_PROOF = ethers.hexlify(ethers.randomBytes(64));
  
  // Helper to get valid block height
  async function getValidBlockHeight() {
    return await ethers.provider.getBlockNumber();
  }

  async function deployFixture() {
    const [owner, updater, recipient, dao, unauthorized] = await ethers.getSigners();

    // Deploy TestRiskScoreVault (testable version)
    const VaultFactory = await ethers.getContractFactory("TestRiskScoreVault");
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

  describe("1. Deployment & Initialization", function () {
    it("Should set correct owner", async function () {
      expect(await vault.owner()).to.equal(owner.address);
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

    it("Should have correct constants", async function () {
      const info = await vault.getContractInfo();
      expect(info.scorePrecision).to.equal(100);
      expect(info.maxRiskScore).to.equal(10000);
      expect(info.scoreValidityPeriod).to.equal(30 * 24 * 60 * 60);
    });
  });

  describe("2. Access Control Logic", function () {
    it("Should allow owner to authorize updaters", async function () {
      await expect(vault.connect(owner).setAuthorizedUpdater(dao.address, true))
        .to.emit(vault, "UpdaterAuthorized")
        .withArgs(dao.address, true, await time.latest() + 1);

      expect(await vault.isAuthorizedUpdater(dao.address)).to.equal(true);
    });

    it("Should allow owner to deauthorize updaters", async function () {
      await vault.connect(owner).setAuthorizedUpdater(updater.address, false);
      expect(await vault.isAuthorizedUpdater(updater.address)).to.equal(false);
    });

    it("Should prevent non-owner from authorizing updaters", async function () {
      await expect(
        vault.connect(unauthorized).setAuthorizedUpdater(dao.address, true)
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });

    it("Should recognize owner as authorized updater", async function () {
      expect(await vault.isAuthorizedUpdater(owner.address)).to.equal(true);
    });

    it("Should prevent unauthorized submissions", async function () {
      await expect(
        vault.connect(unauthorized).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });
  });

  describe("3. Risk Band Classification Logic", function () {
    it("Should classify LOW risk correctly (score < 3000)", async function () {
      const lowScore = 2000;
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        lowScore,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.getRiskBand(TEST_COMMITMENT)).to.equal(1); // LOW
    });

    it("Should classify MEDIUM risk correctly (3000 <= score < 7000)", async function () {
      const mediumScore = 5000;
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        mediumScore,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.getRiskBand(TEST_COMMITMENT)).to.equal(2); // MEDIUM
    });

    it("Should classify HIGH risk correctly (score >= 7000)", async function () {
      const highScore = 8000;
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        highScore,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.getRiskBand(TEST_COMMITMENT)).to.equal(3); // HIGH
    });

    it("Should return UNKNOWN for non-existent commitment", async function () {
      const fakeCommitment = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      expect(await vault.getRiskBand(fakeCommitment)).to.equal(0); // UNKNOWN
    });

    it("Should handle boundary cases correctly", async function () {
      // Test boundary: 2999 should be LOW
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("test1"));
      const nullifier1 = ethers.keccak256(ethers.toUtf8Bytes("nullifier1"));
      await vault.connect(updater).submitRiskAnalysis(
        commitment1, 2999, await getValidBlockHeight(), nullifier1, TEST_PROOF, recipient.address
      );
      expect(await vault.getRiskBand(commitment1)).to.equal(1); // LOW

      await time.increase(3601);

      // Test boundary: 3000 should be MEDIUM
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));
      await vault.connect(updater).submitRiskAnalysis(
        commitment2, 3000, await getValidBlockHeight(), nullifier2, TEST_PROOF, recipient.address
      );
      expect(await vault.getRiskBand(commitment2)).to.equal(2); // MEDIUM

      await time.increase(3601);

      // Test boundary: 6999 should be MEDIUM
      const commitment3 = ethers.keccak256(ethers.toUtf8Bytes("test3"));
      const nullifier3 = ethers.keccak256(ethers.toUtf8Bytes("nullifier3"));
      await vault.connect(updater).submitRiskAnalysis(
        commitment3, 6999, await getValidBlockHeight(), nullifier3, TEST_PROOF, recipient.address
      );
      expect(await vault.getRiskBand(commitment3)).to.equal(2); // MEDIUM

      await time.increase(3601);

      // Test boundary: 7000 should be HIGH
      const commitment4 = ethers.keccak256(ethers.toUtf8Bytes("test4"));
      const nullifier4 = ethers.keccak256(ethers.toUtf8Bytes("nullifier4"));
      await vault.connect(updater).submitRiskAnalysis(
        commitment4, 7000, await getValidBlockHeight(), nullifier4, TEST_PROOF, recipient.address
      );
      expect(await vault.getRiskBand(commitment4)).to.equal(3); // HIGH
    });
  });

  describe("4. Nullifier Management Logic", function () {
    it("Should mark nullifier as used after submission", async function () {
      expect(await vault.isNullifierUsed(TEST_NULLIFIER)).to.equal(false);

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.isNullifierUsed(TEST_NULLIFIER)).to.equal(true);
    });

    it("Should prevent nullifier reuse", async function () {
      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      await time.increase(3601); // Pass rate limit

      // Try to reuse nullifier
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          commitment2,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER, // Same nullifier
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "NullifierAlreadyUsed");
    });

    it("Should allow different nullifiers", async function () {
      const nullifier1 = ethers.keccak256(ethers.toUtf8Bytes("nullifier1"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));
      const commitment1 = ethers.keccak256(ethers.toUtf8Bytes("commitment1"));
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("commitment2"));

      await vault.connect(updater).submitRiskAnalysis(
        commitment1, 5000, await getValidBlockHeight(), nullifier1, TEST_PROOF, recipient.address
      );

      await time.increase(3601);

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          commitment2, 5000, await getValidBlockHeight(), nullifier2, TEST_PROOF, recipient.address
        )
      ).to.not.be.reverted;

      expect(await vault.isNullifierUsed(nullifier1)).to.equal(true);
      expect(await vault.isNullifierUsed(nullifier2)).to.equal(true);
    });
  });

  describe("5. Rate Limiting Logic", function () {
    it("Should enforce rate limit (default 1 hour)", async function () {
      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Immediate second submission should fail
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          commitment2,
          5000,
          await getValidBlockHeight(),
          nullifier2,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "RateLimited");
    });

    it("Should allow submission after rate limit period", async function () {
      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Wait for rate limit (1 hour + 1 second)
      await time.increase(3601);

      // Second submission should succeed
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          commitment2,
          5000,
          await getValidBlockHeight(),
          nullifier2,
          TEST_PROOF,
          recipient.address
        )
      ).to.not.be.reverted;
    });

    it("Should allow owner to change rate limit", async function () {
      const newInterval = 7200; // 2 hours
      await vault.connect(owner).setMinUpdateInterval(newInterval);
      expect(await vault.minUpdateInterval()).to.equal(newInterval);
    });

    it("Should reject rate limit > 24 hours", async function () {
      const invalidInterval = 25 * 60 * 60;
      await expect(
        vault.connect(owner).setMinUpdateInterval(invalidInterval)
      ).to.be.revertedWithCustomError(vault, "IntervalTooLong");
    });

    it("Should track rate limit per updater separately", async function () {
      // Updater submits
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Owner can still submit immediately (different updater)
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));

      await expect(
        vault.connect(owner).submitRiskAnalysis(
          commitment2,
          5000,
          await getValidBlockHeight(),
          nullifier2,
          TEST_PROOF,
          recipient.address
        )
      ).to.not.be.reverted;
    });
  });

  describe("6. Passport Minting Integration", function () {
    it("Should auto-mint passport on successful submission", async function () {
      const tx = await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      // Check events
      await expect(tx).to.emit(vault, "RiskAnalysisSubmitted");
      await expect(tx).to.emit(passport, "PassportMinted");

      // Verify passport was minted
      expect(await passport.totalSupply()).to.equal(1);
      expect(await passport.ownerOf(0)).to.equal(recipient.address);
      expect(await passport.passportCommitments(0)).to.equal(TEST_COMMITMENT);
    });

    it("Should reject if PassportNFT not set", async function () {
      // Deploy new vault without passport
      const VaultFactory = await ethers.getContractFactory("TestRiskScoreVault");
      const newVault = await VaultFactory.deploy(owner.address);
      await newVault.connect(owner).setAuthorizedUpdater(updater.address, true);

      await expect(
        newVault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(newVault, "PassportNFTNotSet");
    });

    it("Should reject zero recipient address", async function () {
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          TEST_PROOF,
          ethers.ZeroAddress
        )
      ).to.be.revertedWithCustomError(vault, "ZeroAddress");
    });

    it("Should increment totalScoredAddresses", async function () {
      expect(await vault.totalScoredAddresses()).to.equal(0);

      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      expect(await vault.totalScoredAddresses()).to.equal(1);
    });
  });

  describe("7. DAO Verification Logic", function () {
    beforeEach(async function () {
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        2000, // LOW risk
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );
    });

    it("Should verify threshold correctly (LOW <= LOW)", async function () {
      const result = await vault.connect(dao).verifyRiskThreshold.staticCall(
        TEST_COMMITMENT,
        3000 // LOW threshold
      );
      expect(result).to.equal(true);
    });

    it("Should verify threshold correctly (LOW <= MEDIUM)", async function () {
      const result = await vault.connect(dao).verifyRiskThreshold.staticCall(
        TEST_COMMITMENT,
        5000 // MEDIUM threshold
      );
      expect(result).to.equal(true);
    });

    it("Should fail verification (MEDIUM > LOW)", async function () {
      // Submit MEDIUM risk
      await time.increase(3601);
      const commitment2 = ethers.keccak256(ethers.toUtf8Bytes("test2"));
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));
      
      await vault.connect(updater).submitRiskAnalysis(
        commitment2,
        5000, // MEDIUM risk
        await getValidBlockHeight(),
        nullifier2,
        TEST_PROOF,
        recipient.address
      );

      const result = await vault.connect(dao).verifyRiskThreshold.staticCall(
        commitment2,
        2000 // LOW threshold
      );
      expect(result).to.equal(false);
    });

    it("Should emit verification event", async function () {
      await expect(
        vault.connect(dao).verifyRiskThreshold(TEST_COMMITMENT, 3000)
      ).to.emit(vault, "DAOVerificationPerformed");
    });

    it("Should revert for non-existent commitment", async function () {
      const fakeCommitment = ethers.keccak256(ethers.toUtf8Bytes("fake"));
      await expect(
        vault.connect(dao).verifyRiskThreshold(fakeCommitment, 3000)
      ).to.be.revertedWithCustomError(vault, "CommitmentNotFound");
    });
  });

  describe("8. Input Validation Logic", function () {
    it("Should reject zero commitment", async function () {
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          ethers.ZeroHash,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidProof"); // Zero commitment fails proof check first
    });

    it("Should reject zero block height", async function () {
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          0, // Invalid
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidBlockHeight");
    });

    it("Should reject future block height", async function () {
      const futureBlock = (await ethers.provider.getBlockNumber()) + 1000;
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          futureBlock,
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidBlockHeight");
    });

    it("Should reject invalid proof (too short)", async function () {
      const shortProof = "0x1234";
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          shortProof,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidProof");
    });

    it("Should reject duplicate commitment", async function () {
      // First submission
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );

      await time.increase(3601);

      // Try to submit same commitment again
      const nullifier2 = ethers.keccak256(ethers.toUtf8Bytes("nullifier2"));
      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT, // Same commitment
          5000,
          await getValidBlockHeight(),
          nullifier2,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "InvalidCommitment");
    });
  });

  describe("9. Emergency Controls Logic", function () {
    it("Should allow owner to pause", async function () {
      await vault.connect(owner).pause();
      expect(await vault.paused()).to.equal(true);
    });

    it("Should prevent operations when paused", async function () {
      await vault.connect(owner).pause();

      await expect(
        vault.connect(updater).submitRiskAnalysis(
          TEST_COMMITMENT,
          5000,
          await getValidBlockHeight(),
          TEST_NULLIFIER,
          TEST_PROOF,
          recipient.address
        )
      ).to.be.revertedWithCustomError(vault, "ContractPaused");
    });

    it("Should allow owner to unpause", async function () {
      await vault.connect(owner).pause();
      await vault.connect(owner).unpause();
      expect(await vault.paused()).to.equal(false);
    });

    it("Should prevent non-owner from pausing", async function () {
      await expect(
        vault.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(vault, "NotAuthorized");
    });
  });

  describe("10. Metadata & View Functions", function () {
    beforeEach(async function () {
      await vault.connect(updater).submitRiskAnalysis(
        TEST_COMMITMENT,
        5000,
        await getValidBlockHeight(),
        TEST_NULLIFIER,
        TEST_PROOF,
        recipient.address
      );
    });

    it("Should return correct commitment metadata", async function () {
      const metadata = await vault.getCommitmentMetadata(TEST_COMMITMENT);
      
      expect(metadata.exists).to.equal(true);
      expect(metadata.blockHeight).to.be.gt(0); // Block height should be valid
      expect(metadata.analyzer).to.equal(updater.address);
      expect(metadata.band).to.equal(2); // MEDIUM
      expect(metadata.timestamp).to.be.gt(0);
    });

    it("Should return correct contract info", async function () {
      const info = await vault.getContractInfo();
      
      expect(info.owner).to.equal(owner.address);
      expect(info.totalScoredAddresses).to.equal(1);
      expect(info.scorePrecision).to.equal(100);
      expect(info.maxRiskScore).to.equal(10000);
    });

    it("Should check nullifier status correctly", async function () {
      expect(await vault.isNullifierUsed(TEST_NULLIFIER)).to.equal(true);
      
      const unusedNullifier = ethers.keccak256(ethers.toUtf8Bytes("unused"));
      expect(await vault.isNullifierUsed(unusedNullifier)).to.equal(false);
    });
  });
});
