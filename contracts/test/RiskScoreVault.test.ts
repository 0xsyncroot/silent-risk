import { expect } from "chai";
import { ethers } from "hardhat";
import { SignerWithAddress } from "@nomicfoundation/hardhat-ethers/signers";
import { RiskScoreVault } from "../typechain-types";
import { time, loadFixture } from "@nomicfoundation/hardhat-network-helpers";

describe("RiskScoreVault", function () {
  let riskScoreVault: RiskScoreVault;
  let owner: SignerWithAddress;
  let updater: SignerWithAddress;
  let user1: SignerWithAddress;
  let user2: SignerWithAddress;
  let unauthorized: SignerWithAddress;

  // Test constants
  const SCORE_PRECISION = 100;
  const MAX_RISK_SCORE = 10000;
  const SCORE_VALIDITY_PERIOD = 30 * 24 * 60 * 60; // 30 days

  async function deployRiskScoreVaultFixture() {
    const [owner, updater, user1, user2, unauthorized] = await ethers.getSigners();

    const RiskScoreVault = await ethers.getContractFactory("RiskScoreVault");
    const riskScoreVault = await RiskScoreVault.deploy(owner.address);

    // Authorize the updater
    await riskScoreVault.connect(owner).setAuthorizedUpdater(updater.address, true);

    return { riskScoreVault, owner, updater, user1, user2, unauthorized };
  }

  beforeEach(async function () {
    const fixture = await loadFixture(deployRiskScoreVaultFixture);
    riskScoreVault = fixture.riskScoreVault;
    owner = fixture.owner;
    updater = fixture.updater;
    user1 = fixture.user1;
    user2 = fixture.user2;
    unauthorized = fixture.unauthorized;
  });

  describe("Deployment", function () {
    it("Should set the right owner", async function () {
      expect(await riskScoreVault.owner()).to.equal(owner.address);
    });

    it("Should have correct constants", async function () {
      expect(await riskScoreVault.SCORE_PRECISION()).to.equal(SCORE_PRECISION);
      expect(await riskScoreVault.MAX_RISK_SCORE()).to.equal(MAX_RISK_SCORE);
      expect(await riskScoreVault.SCORE_VALIDITY_PERIOD()).to.equal(SCORE_VALIDITY_PERIOD);
    });

    it("Should initialize with zero scored addresses", async function () {
      expect(await riskScoreVault.totalScoredAddresses()).to.equal(0);
    });

    it("Should not be paused initially", async function () {
      expect(await riskScoreVault.paused()).to.equal(false);
    });
  });

  describe("Access Control", function () {
    it("Should allow owner to authorize updaters", async function () {
      await expect(riskScoreVault.connect(owner).setAuthorizedUpdater(user1.address, true))
        .to.emit(riskScoreVault, "UpdaterAuthorized")
        .withArgs(user1.address, true, await time.latest() + 1);

      expect(await riskScoreVault.isAuthorizedUpdater(user1.address)).to.equal(true);
    });

    it("Should allow owner to deauthorize updaters", async function () {
      await riskScoreVault.connect(owner).setAuthorizedUpdater(updater.address, false);
      expect(await riskScoreVault.isAuthorizedUpdater(updater.address)).to.equal(false);
    });

    it("Should not allow non-owner to authorize updaters", async function () {
      await expect(
        riskScoreVault.connect(unauthorized).setAuthorizedUpdater(user1.address, true)
      ).to.be.revertedWithCustomError(riskScoreVault, "NotAuthorized");
    });

    it("Should recognize owner as authorized updater", async function () {
      expect(await riskScoreVault.isAuthorizedUpdater(owner.address)).to.equal(true);
    });
  });

  describe("Risk Score Management", function () {
    const testScore = 5000; // 50.00%
    const testBlockHeight = 12345;

    it("Should allow authorized updater to set risk score from plaintext", async function () {
      await expect(
        riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
          user1.address,
          testScore,
          testBlockHeight
        )
      ).to.emit(riskScoreVault, "RiskScoreUpdated");

      const metadata = await riskScoreVault.getRiskScoreMetadata(user1.address);
      expect(metadata.exists).to.equal(true);
      expect(metadata.band).to.equal(2); // MEDIUM risk band
      expect(metadata.blockHeight).to.equal(testBlockHeight);
      expect(metadata.analyzer).to.equal(updater.address);
    });

    it("Should not allow unauthorized user to set risk score", async function () {
      await expect(
        riskScoreVault.connect(unauthorized).setRiskScoreFromPlaintext(
          user1.address,
          testScore,
          testBlockHeight
        )
      ).to.be.revertedWithCustomError(riskScoreVault, "NotAuthorized");
    });

    it("Should reject invalid block height", async function () {
      await expect(
        riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
          user1.address,
          testScore,
          0
        )
      ).to.be.revertedWithCustomError(riskScoreVault, "InvalidBlockHeight");
    });

    it("Should reject score above maximum", async function () {
      await expect(
        riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
          user1.address,
          MAX_RISK_SCORE + 1,
          testBlockHeight
        )
      ).to.be.revertedWith("Score exceeds maximum");
    });

    it("Should increment total scored addresses for new wallet", async function () {
      expect(await riskScoreVault.totalScoredAddresses()).to.equal(0);

      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore,
        testBlockHeight
      );

      expect(await riskScoreVault.totalScoredAddresses()).to.equal(1);
    });

    it("Should not increment total for existing wallet update", async function () {
      // Set initial score
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore,
        testBlockHeight
      );

      expect(await riskScoreVault.totalScoredAddresses()).to.equal(1);

      // Update score
      await time.increase(3601); // Increase time to pass rate limit
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        7000, // HIGH risk
        testBlockHeight + 100
      );

      expect(await riskScoreVault.totalScoredAddresses()).to.equal(1);
    });
  });

  describe("Risk Band Classification", function () {
    const testBlockHeight = 12345;

    it("Should classify low risk correctly", async function () {
      const lowScore = 2000; // 20.00%
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        lowScore,
        testBlockHeight
      );

      expect(await riskScoreVault.getRiskBand(user1.address)).to.equal(1); // LOW
    });

    it("Should classify medium risk correctly", async function () {
      const mediumScore = 5000; // 50.00%
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        mediumScore,
        testBlockHeight
      );

      expect(await riskScoreVault.getRiskBand(user1.address)).to.equal(2); // MEDIUM
    });

    it("Should classify high risk correctly", async function () {
      const highScore = 8000; // 80.00%
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        highScore,
        testBlockHeight
      );

      expect(await riskScoreVault.getRiskBand(user1.address)).to.equal(3); // HIGH
    });

    it("Should return UNKNOWN for non-existent score", async function () {
      expect(await riskScoreVault.getRiskBand(user1.address)).to.equal(0); // UNKNOWN
    });
  });

  describe("Score Validity and Expiration", function () {
    const testScore = 5000;
    const testBlockHeight = 12345;

    it("Should report valid score when not expired", async function () {
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore,
        testBlockHeight
      );

      const [exists, isValid] = await riskScoreVault.hasValidScore(user1.address);
      expect(exists).to.equal(true);
      expect(isValid).to.equal(true);
    });

    it("Should report invalid score when expired", async function () {
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore,
        testBlockHeight
      );

      // Fast forward past expiration
      await time.increase(SCORE_VALIDITY_PERIOD + 1);

      const [exists, isValid] = await riskScoreVault.hasValidScore(user1.address);
      expect(exists).to.equal(true);
      expect(isValid).to.equal(false);
    });

    it("Should reject operations on expired scores", async function () {
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore,
        testBlockHeight
      );

      // Fast forward past expiration
      await time.increase(SCORE_VALIDITY_PERIOD + 1);

      // Mock encrypted threshold (this would normally come from fhevmjs)
      const mockThreshold = ethers.ZeroHash; // Placeholder
      const mockProof = "0x"; // Placeholder

      await expect(
        riskScoreVault.isScoreBelowThreshold(user1.address, mockThreshold, mockProof)
      ).to.be.revertedWithCustomError(riskScoreVault, "RiskScoreExpired");
    });
  });

  describe("Batch Operations", function () {
    const testScore1 = 2000; // LOW
    const testScore2 = 8000; // HIGH
    const testBlockHeight = 12345;

    beforeEach(async function () {
      // Set up test scores
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        testScore1,
        testBlockHeight
      );

      await time.increase(3601); // Pass rate limit
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user2.address,
        testScore2,
        testBlockHeight
      );
    });

    it("Should batch check valid scores correctly", async function () {
      const wallets = [user1.address, user2.address, unauthorized.address];
      const results = await riskScoreVault.batchCheckValidScores(wallets);

      expect(results.wallets).to.deep.equal(wallets);
      expect(results.hasValidScore[0]).to.equal(true);  // user1 has valid score
      expect(results.hasValidScore[1]).to.equal(true);  // user2 has valid score
      expect(results.hasValidScore[2]).to.equal(false); // unauthorized has no score

      expect(results.bands[0]).to.equal(1); // LOW
      expect(results.bands[1]).to.equal(3); // HIGH
      expect(results.bands[2]).to.equal(0); // UNKNOWN
    });
  });

  describe("Statistics", function () {
    const testBlockHeight = 12345;

    it("Should track score statistics by band", async function () {
      // Initially all should be zero
      const [low0, medium0, high0] = await riskScoreVault.getScoreStatistics();
      expect(low0).to.equal(0);
      expect(medium0).to.equal(0);
      expect(high0).to.equal(0);

      // Add LOW risk score
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user1.address,
        2000, // LOW
        testBlockHeight
      );

      const [low1, medium1, high1] = await riskScoreVault.getScoreStatistics();
      expect(low1).to.equal(1);
      expect(medium1).to.equal(0);
      expect(high1).to.equal(0);

      // Add HIGH risk score
      await time.increase(3601);
      await riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
        user2.address,
        8000, // HIGH
        testBlockHeight
      );

      const [low2, medium2, high2] = await riskScoreVault.getScoreStatistics();
      expect(low2).to.equal(1);
      expect(medium2).to.equal(0);
      expect(high2).to.equal(1);
    });
  });

  describe("Configuration Management", function () {
    it("Should allow owner to set custom validity period", async function () {
      const customPeriod = 7 * 24 * 60 * 60; // 7 days
      await riskScoreVault.connect(owner).setCustomValidityPeriod(user1.address, customPeriod);
      expect(await riskScoreVault.customValidityPeriods(user1.address)).to.equal(customPeriod);
    });

    it("Should allow owner to set min update interval", async function () {
      const newInterval = 7200; // 2 hours
      await riskScoreVault.connect(owner).setMinUpdateInterval(newInterval);
      expect(await riskScoreVault.minUpdateInterval()).to.equal(newInterval);
    });

    it("Should reject invalid min update interval", async function () {
      const invalidInterval = 25 * 60 * 60; // 25 hours
      await expect(
        riskScoreVault.connect(owner).setMinUpdateInterval(invalidInterval)
      ).to.be.revertedWith("Interval too long");
    });

    it("Should allow owner to set max daily decryptions", async function () {
      const newLimit = 20;
      await riskScoreVault.connect(owner).setMaxDailyDecryptions(newLimit);
      expect(await riskScoreVault.maxDailyDecryptions()).to.equal(newLimit);
    });
  });

  describe("Emergency Controls", function () {
    it("Should allow owner to pause contract", async function () {
      await riskScoreVault.connect(owner).pause();
      expect(await riskScoreVault.paused()).to.equal(true);
    });

    it("Should prevent operations when paused", async function () {
      await riskScoreVault.connect(owner).pause();

      await expect(
        riskScoreVault.connect(updater).setRiskScoreFromPlaintext(
          user1.address,
          5000,
          12345
        )
      ).to.be.revertedWithCustomError(riskScoreVault, "ContractPaused");
    });

    it("Should allow owner to unpause contract", async function () {
      await riskScoreVault.connect(owner).pause();
      await riskScoreVault.connect(owner).unpause();
      expect(await riskScoreVault.paused()).to.equal(false);
    });

    it("Should not allow non-owner to pause", async function () {
      await expect(
        riskScoreVault.connect(unauthorized).pause()
      ).to.be.revertedWithCustomError(riskScoreVault, "NotAuthorized");
    });
  });

  describe("Contract Info", function () {
    it("Should return correct contract information", async function () {
      const info = await riskScoreVault.getContractInfo();
      
      expect(info.scorePrecision).to.equal(SCORE_PRECISION);
      expect(info.maxRiskScore).to.equal(MAX_RISK_SCORE);
      expect(info.scoreValidityPeriod).to.equal(SCORE_VALIDITY_PERIOD);
      expect(info.owner).to.equal(owner.address);
      expect(info.totalScoredAddresses).to.equal(0);
      expect(info.totalDecryptionRequests).to.equal(0);
    });
  });
});

