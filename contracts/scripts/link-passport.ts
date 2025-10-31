/**
 * Link PassportNFT to RiskScoreVault
 * 
 * This script connects the PassportNFT contract to RiskScoreVault by calling
 * setPassportNFT() on the vault contract. This is required for the vault to
 * automatically mint passport NFTs during risk analysis submission.
 * 
 * Usage:
 *   export VAULT_CONTRACT_ADDRESS=0x...
 *   export PASSPORT_CONTRACT_ADDRESS=0x...
 *   npx hardhat run scripts/link-passport.ts --network sepolia
 * 
 * Environment Variables:
 *   - VAULT_CONTRACT_ADDRESS: Deployed RiskScoreVault address
 *   - PASSPORT_CONTRACT_ADDRESS: Deployed PassportNFT address
 *   - DEPLOYER_PRIVATE_KEY: Deployer wallet private key (must be vault owner)
 */

import { ethers } from "hardhat";

async function main() {
  console.log("");
  console.log("🔗 Linking PassportNFT to RiskScoreVault...");
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  console.log("📝 Executing from account:", deployer.address);
  
  const balance = await ethers.provider.getBalance(deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  // ============================================
  // Step 1: Validate Environment Variables
  // ============================================
  
  console.log("📜 Step 1: Validating environment...");
  
  const vaultAddress = process.env.VAULT_CONTRACT_ADDRESS;
  if (!vaultAddress) {
    console.error("❌ Error: VAULT_CONTRACT_ADDRESS not set!");
    console.error("Please set it in your .env file");
    process.exit(1);
  }
  
  const passportAddress = process.env.PASSPORT_CONTRACT_ADDRESS;
  if (!passportAddress) {
    console.error("❌ Error: PASSPORT_CONTRACT_ADDRESS not set!");
    console.error("Please set it in your .env file");
    process.exit(1);
  }
  
  console.log("✅ RiskScoreVault:", vaultAddress);
  console.log("✅ PassportNFT:", passportAddress);
  console.log("");

  // ============================================
  // Step 2: Verify Contracts Exist
  // ============================================
  
  console.log("📜 Step 2: Verifying contracts...");
  
  const vaultCode = await ethers.provider.getCode(vaultAddress);
  if (vaultCode === "0x") {
    console.error("❌ Error: No contract found at vault address!");
    process.exit(1);
  }
  console.log("✅ RiskScoreVault contract verified");
  
  const passportCode = await ethers.provider.getCode(passportAddress);
  if (passportCode === "0x") {
    console.error("❌ Error: No contract found at passport address!");
    process.exit(1);
  }
  console.log("✅ PassportNFT contract verified");
  console.log("");

  // ============================================
  // Step 3: Get Contract Instances
  // ============================================
  
  console.log("📜 Step 3: Loading contracts...");
  
  const RiskScoreVault = await ethers.getContractFactory("RiskScoreVault");
  const vault = RiskScoreVault.attach(vaultAddress);
  
  const PassportNFT = await ethers.getContractFactory("PassportNFT");
  const passport = PassportNFT.attach(passportAddress);
  
  console.log("✅ Contracts loaded");
  console.log("");

  // ============================================
  // Step 4: Verify Ownership
  // ============================================
  
  console.log("📜 Step 4: Verifying ownership...");
  
  const vaultOwner = await vault.owner();
  console.log("   Vault owner:", vaultOwner);
  console.log("   Deployer:   ", deployer.address);
  
  if (vaultOwner.toLowerCase() !== deployer.address.toLowerCase()) {
    console.error("❌ Error: Deployer is not the vault owner!");
    console.error("   Only the owner can call setPassportNFT()");
    process.exit(1);
  }
  console.log("✅ Ownership verified");
  console.log("");

  // ============================================
  // Step 5: Check Current State
  // ============================================
  
  console.log("📜 Step 5: Checking current state...");
  
  const currentPassport = await vault.passportNFT();
  console.log("   Current PassportNFT:", currentPassport);
  
  if (currentPassport !== ethers.ZeroAddress && currentPassport.toLowerCase() === passportAddress.toLowerCase()) {
    console.log("✅ PassportNFT already linked!");
    console.log("");
    console.log("🎉 No action needed - contracts are already connected");
    return;
  }
  
  if (currentPassport !== ethers.ZeroAddress) {
    console.log("⚠️  Warning: Vault already has a different PassportNFT set");
    console.log("   This will replace it with the new address");
  }
  console.log("");

  // ============================================
  // Step 6: Link PassportNFT to Vault
  // ============================================
  
  console.log("📜 Step 6: Linking PassportNFT to RiskScoreVault...");
  
  const tx = await vault.setPassportNFT(passportAddress);
  console.log("   Transaction hash:", tx.hash);
  console.log("   Waiting for confirmation...");
  
  const receipt = await tx.wait();
  console.log("✅ Transaction confirmed!");
  console.log("   Block number:", receipt?.blockNumber);
  console.log("   Gas used:", receipt?.gasUsed.toString());
  console.log("");

  // ============================================
  // Step 7: Verify Link
  // ============================================
  
  console.log("📜 Step 7: Verifying link...");
  
  const newPassport = await vault.passportNFT();
  if (newPassport.toLowerCase() !== passportAddress.toLowerCase()) {
    console.error("❌ Error: Link verification failed!");
    console.error("   Expected:", passportAddress);
    console.error("   Got:", newPassport);
    process.exit(1);
  }
  console.log("✅ Link verified successfully");
  console.log("");

  // ============================================
  // Step 8: Verify Reverse Link
  // ============================================
  
  console.log("📜 Step 8: Verifying PassportNFT configuration...");
  
  const passportVault = await passport.vault();
  console.log("   PassportNFT vault:", passportVault);
  console.log("   Expected:        ", vaultAddress);
  
  if (passportVault.toLowerCase() !== vaultAddress.toLowerCase()) {
    console.error("⚠️  Warning: PassportNFT is pointing to a different vault!");
    console.error("   This may cause issues during minting");
  } else {
    console.log("✅ PassportNFT correctly configured");
  }
  console.log("");

  // ============================================
  // Summary
  // ============================================
  
  console.log("=".repeat(60));
  console.log("🎉 LINKING COMPLETE!");
  console.log("=".repeat(60));
  console.log();
  console.log("📋 Configuration:");
  console.log("   RiskScoreVault:  ", vaultAddress);
  console.log("   PassportNFT:     ", passportAddress);
  console.log("   Vault Owner:     ", vaultOwner);
  console.log("");
  console.log("✅ System Status:");
  console.log("   ✓ PassportNFT linked to RiskScoreVault");
  console.log("   ✓ Vault can now mint passport NFTs automatically");
  console.log("   ✓ submitRiskAnalysis() will mint passports on success");
  console.log("");
  console.log("📝 Next Steps:");
  console.log("   1. Authorize worker wallet:");
  console.log("      vault.setAuthorizedUpdater(WORKER_ADDRESS, true)");
  console.log();
  console.log("   2. Test the integration:");
  console.log("      npm run test");
  console.log();
  console.log("   3. Update frontend/worker configs with addresses");
  console.log();
}

// Execute linking
main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Linking failed:");
    console.error(error);
    process.exit(1);
  });
