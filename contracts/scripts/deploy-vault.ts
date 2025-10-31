/**
 * Deploy RiskScoreVault Contract
 * 
 * Deployment Flow:
 * 1. Deploy RiskScoreVault with initial owner
 * 2. Configure authorized updaters
 * 3. Set initial parameters
 * 4. Verify deployment
 * 
 * Usage:
 *   npx hardhat run scripts/deploy-vault.ts --network sepolia
 * 
 * Environment Variables Required:
 *   - DEPLOYER_PRIVATE_KEY: Deployer wallet private key
 *   - WORKER_ADDRESS: Worker wallet to authorize (optional)
 */

import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

async function main() {
  console.log("🚀 Deploying RiskScoreVault...\n");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Deploying from account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH\n");

  // ============================================
  // Step 1: Deploy RiskScoreVault
  // ============================================
  
  console.log("📜 Step 1: Deploying RiskScoreVault...");
  
  const RiskScoreVault = await ethers.getContractFactory("RiskScoreVault");
  const vault = await RiskScoreVault.deploy(deployer.address);
  await vault.waitForDeployment();
  
  const vaultAddress = await vault.getAddress();
  console.log("✅ RiskScoreVault deployed at:", vaultAddress);
  console.log();

  // ============================================
  // Step 2: Configure Authorized Updaters
  // ============================================
  
  console.log("📜 Step 2: Configuring authorized updaters...");
  
  // Check if WORKER_ADDRESS is set
  const workerAddress = process.env.WORKER_ADDRESS;
  
  if (workerAddress) {
    console.log("🔧 Authorizing worker address:", workerAddress);
    
    const tx = await vault.setAuthorizedUpdater(workerAddress, true);
    await tx.wait();
    
    console.log("✅ Worker authorized");
  } else {
    console.log("⚠️  WORKER_ADDRESS not set - skipping worker authorization");
    console.log("   You can authorize later using:");
    console.log("   vault.setAuthorizedUpdater(WORKER_ADDRESS, true)");
  }
  
  console.log();

  // ============================================
  // Step 3: Configure Parameters (Optional)
  // ============================================
  
  console.log("📜 Step 3: Configuration...");
  
  // Get current settings
  const minUpdateInterval = 0; // Default from contract
  console.log("⏱️  Min update interval:", minUpdateInterval, "seconds");
  
  // Optionally update settings (uncomment if needed)
  // const newInterval = 60; // 1 minute
  // const tx = await vault.setMinUpdateInterval(newInterval);
  // await tx.wait();
  // console.log("✅ Min update interval set to", newInterval, "seconds");
  
  console.log();

  // ============================================
  // Step 4: Verify Deployment
  // ============================================
  
  console.log("📜 Step 4: Verifying deployment...");
  
  // Check owner
  const owner = await vault.owner();
  console.log("👤 Owner:", owner);
  
  // Check if paused
  const paused = await vault.paused();
  console.log("⏸️  Paused:", paused);
  
  // Check if worker is authorized (if set)
  if (workerAddress) {
    const isAuthorized = await vault.authorizedUpdaters(workerAddress);
    console.log("✅ Worker authorized:", isAuthorized);
  }
  
  console.log();

  // ============================================
  // Summary
  // ============================================
  
  console.log("=" .repeat(60));
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("=" .repeat(60));
  console.log();
  console.log("📋 Contract Information:");
  console.log("   RiskScoreVault:    ", vaultAddress);
  console.log("   Owner:             ", owner);
  console.log("   Network:           ", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID:          ", (await ethers.provider.getNetwork()).chainId);
  console.log();
  console.log("📝 Next Steps:");
  console.log("   1. Verify contract on Etherscan:");
  console.log("      npx hardhat verify --network sepolia", vaultAddress, deployer.address);
  console.log();
  console.log("   2. Update worker .env:");
  console.log("      VAULT_CONTRACT_ADDRESS=" + vaultAddress);
  console.log();
  console.log("   3. Update backend .env (if needed):");
  console.log("      VAULT_CONTRACT_ADDRESS=" + vaultAddress);
  console.log();
  
  if (!workerAddress) {
    console.log("   4. Authorize worker wallet:");
    console.log("      vault.setAuthorizedUpdater(WORKER_ADDRESS, true)");
    console.log();
  }
  
  console.log("   5. Deploy PassportNFT:");
  console.log("      export VAULT_CONTRACT_ADDRESS=" + vaultAddress);
  console.log("      npx hardhat run scripts/deploy-passport.ts --network sepolia");
  console.log();
  
  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(), // Convert BigInt to string
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      RiskScoreVault: vaultAddress
    },
    configuration: {
      owner: owner,
      workerAuthorized: workerAddress || "not_set",
      paused: paused
    }
  };
  
  const deploymentPath = path.join(__dirname, "../deployments", `vault-${Date.now()}.json`);
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

