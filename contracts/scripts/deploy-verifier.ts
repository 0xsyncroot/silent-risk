import { ethers } from "hardhat";
import * as fs from "fs";
import * as path from "path";

/**
 * Deploy ZK Proof Verifier Contract
 * 
 * This script deploys the auto-generated Groth16 verifier contract
 * that will be used by PassportNFT to verify ZK proofs.
 */

async function main() {
  console.log("");
  console.log("🚀 Deploying ZK Proof Verifier...");
  console.log("");

  // Get deployer account
  const [deployer] = await ethers.getSigners();
  const balance = await ethers.provider.getBalance(deployer.address);

  console.log("📝 Deploying from account:", deployer.address);
  console.log("💰 Account balance:", ethers.formatEther(balance), "ETH");
  console.log("");

  // Check if Verifier.sol exists
  const verifierPath = path.join(__dirname, "../contracts/Verifier.sol");
  if (!fs.existsSync(verifierPath)) {
    console.error("❌ Verifier.sol not found!");
    console.error("");
    console.error("💡 You need to run the trusted setup ceremony first:");
    console.error("   cd circuits");
    console.error("   ./setup-ceremony.sh");
    console.error("");
    process.exit(1);
  }

  console.log("📜 Step 1: Deploying Verifier contract...");

  // Deploy Verifier
  const Verifier = await ethers.getContractFactory("Groth16Verifier");
  const verifier = await Verifier.deploy();
  await verifier.waitForDeployment();
  const verifierAddress = await verifier.getAddress();

  console.log("✅ Verifier deployed at:", verifierAddress);
  console.log("");

  console.log("📜 Step 2: Verifying deployment...");
  
  // Test the verifier (optional sanity check)
  try {
    // The verifier should have a verifyProof function
    const hasVerifyFunction = typeof verifier.verifyProof === 'function';
    if (hasVerifyFunction) {
      console.log("✅ Verifier contract verified - verifyProof function exists");
    } else {
      console.log("⚠️  Warning: verifyProof function not found");
    }
  } catch (error) {
    console.log("⚠️  Could not verify contract interface:", error);
  }
  console.log("");

  // Summary
  console.log("============================================================");
  console.log("🎉 DEPLOYMENT COMPLETE!");
  console.log("============================================================");
  console.log("");
  console.log("📋 Contract Information:");
  console.log("   Verifier:           ", verifierAddress);
  console.log("   Deployer:           ", deployer.address);
  console.log("   Network:            ", (await ethers.provider.getNetwork()).name);
  console.log("   Chain ID:           ", (await ethers.provider.getNetwork()).chainId.toString());
  console.log("");
  console.log("📝 Next Steps:");
  console.log("");
  console.log("   1. Verify contract on Etherscan:");
  console.log("      npx hardhat verify --network sepolia", verifierAddress);
  console.log("");
  console.log("   2. Deploy PassportNFT:");
  console.log("      export VERIFIER_ADDRESS=" + verifierAddress);
  console.log("      export VAULT_CONTRACT_ADDRESS=0x5b5df552dd023540195116176D22309A3d2D1c58");
  console.log("      npx hardhat run scripts/deploy-passport.ts --network sepolia");
  console.log("");
  console.log("   3. Copy circuit files to frontend:");
  console.log("      mkdir -p ../ui/public/circuits");
  console.log("      cp circuits/passport_proof_js/passport_proof.wasm ../ui/public/circuits/");
  console.log("      cp circuits/passport_proof_final.zkey ../ui/public/circuits/");
  console.log("");

  // Save deployment info
  const network = await ethers.provider.getNetwork();
  const deploymentInfo = {
    network: network.name,
    chainId: network.chainId.toString(),
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    contracts: {
      Verifier: verifierAddress
    }
  };

  const deploymentPath = path.join(__dirname, "../deployments", `verifier-${Date.now()}.json`);
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

