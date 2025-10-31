/**
 * Deploy PassportNFT Contract
 * 
 * Deployment Flow:
 * 1. Verify RiskScoreVault is deployed
 * 2. Deploy PassportNFT with vault address
 * 3. Configure PassportNFT (if needed)
 * 4. Link PassportNFT to RiskScoreVault
 * 
 * Usage:
 *   export VAULT_CONTRACT_ADDRESS=0x...
 *   npx hardhat run scripts/deploy-passport.ts --network sepolia
 * 
 * Environment Variables:
 *   - VAULT_CONTRACT_ADDRESS: Deployed RiskScoreVault address (required)
 *   - DEPLOYER_PRIVATE_KEY: Deployer wallet private key
 * 
 * Note: PassportNFT no longer needs a separate Verifier contract.
 * ZK proof verification is handled by RiskScoreVault during submission.
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("");
  console.log("🚀 Deploying PassportNFT System...");
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  // ============================================
  // Step 1: Verify RiskScoreVault Address
  // ============================================
  
  console.log("📜 Step 1: Verifying RiskScoreVault...");
  
  const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS;
  if (!vaultAddress) {
    console.error("❌ Error: VAULT_CONTRACT_ADDRESS not set!");
    console.log("Please set it in your .env file");
    process.exit(1);
  }
  
  console.log("✅ Using RiskScoreVault at:", vaultAddress);
  
  // Verify vault exists
  const vaultCode = await ethers.provider.getCode(vaultAddress);
  if (vaultCode === "0x") {
    console.error("❌ Error: No contract found at vault address!");
    console.log("Please deploy RiskScoreVault first");
    process.exit(1);
  }
  console.log("✅ RiskScoreVault verified (contract exists)");
  console.log();

  // ============================================
  // Step 2: Deploy PassportNFT
  // ============================================
  
  console.log("📜 Step 2: Deploying PassportNFT...");
  
  const PassportNFT = await ethers.getContractFactory("PassportNFT");
  const passport = await PassportNFT.deploy(vaultAddress);
  await passport.waitForDeployment();
  
  const passportAddress = await passport.getAddress();
  console.log("✅ PassportNFT deployed at:", passportAddress);
  console.log();

  // ============================================
  // Step 3: Configuration (Optional)
  // ============================================
  
  console.log("📜 Step 3: Configuration...");
  
  // Get current passport validity period
  const validityPeriod = await passport.passportValidityPeriod();
  console.log("📅 Passport validity period:", (Number(validityPeriod) / 86400), "days");
  
  // Optionally update validity period (uncomment if needed)
  // const newPeriod = 30 * 86400; // 30 days
  // const tx = await passport.setValidityPeriod(newPeriod);
  // await tx.wait();
  // console.log("✅ Validity period updated to 30 days");
  
  console.log();

  // ============================================
  // Summary
  // ============================================
  
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log();
  console.log("📋 Contract Addresses:");
  console.log("   RiskScoreVault:   ", vaultAddress);
  console.log("   PassportNFT:      ", passportAddress);
  console.log("");
  console.log("📝 Next Steps:");
  console.log("   1. Link PassportNFT to RiskScoreVault:");
  console.log("      vault.setPassportNFT(" + passportAddress + ")");
  console.log();
  console.log("   2. Verify contracts on Etherscan:");
  console.log("      npx hardhat verify --network sepolia", passportAddress, vaultAddress);
  console.log();
  console.log("   3. Update .env with PassportNFT address:");
  console.log("      PASSPORT_CONTRACT_ADDRESS=" + passportAddress);
  console.log();
  console.log("   4. Update frontend config:");
  console.log("      NEXT_PUBLIC_PASSPORT_NFT_ADDRESS=" + passportAddress);
  console.log("      NEXT_PUBLIC_VAULT_ADDRESS=" + vaultAddress);
  console.log();
  console.log("   5. Authorize worker wallet in RiskScoreVault:");
  console.log("      vault.setAuthorizedUpdater(WORKER_ADDRESS, true)");
  console.log();
  
  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(), // Convert BigInt to string
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskScoreVault: vaultAddress,
      PassportNFT: passportAddress
    },
    configuration: {
      passportValidityPeriod: Number(validityPeriod)
    },
    notes: "ZK proof verification is handled by RiskScoreVault (no separate Verifier contract needed)"
  };
  
  const deploymentPath = path.join(__dirname, "../deployments", `passport-${Date.now()}.json`);
  fs.mkdirSync(path.dirname(deploymentPath), { recursive: true });
  fs.writeFileSync(deploymentPath, JSON.stringify(deploymentInfo, null, 2));
  
  console.log("💾 Deployment info saved to:", deploymentPath);
  console.log();
}

// Execute deployment
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:");
    console.error(error);
    process.exit(1);
  });

