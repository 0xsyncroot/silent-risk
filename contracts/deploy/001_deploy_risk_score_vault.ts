import { HardhatRuntimeEnvironment } from "hardhat/types";
import { DeployFunction } from "hardhat-deploy/types";

/**
 * @title Deploy RiskScoreVault Contract
 * @notice Deploys the main RiskScoreVault contract with proper configuration
 * @dev Uses hardhat-deploy for deterministic deployments and verification
 */
const deployRiskScoreVault: DeployFunction = async function (hre: HardhatRuntimeEnvironment) {
  const { deployments, getNamedAccounts, network } = hre;
  const { deploy, log } = deployments;
  const { deployer } = await getNamedAccounts();

  log("----------------------------------------------------");
  log(`Deploying RiskScoreVault on network: ${network.name}`);
  log(`Deployer: ${deployer}`);

  // Get deployment configuration based on network
  const config = getDeploymentConfig(network.name);
  
  log(`Using configuration:`, config);

  // Deploy RiskScoreVault contract
  const riskScoreVault = await deploy("RiskScoreVault", {
    from: deployer,
    args: [config.initialOwner],
    log: true,
    deterministicDeployment: false, // Set to true for deterministic addresses
    waitConfirmations: config.waitConfirmations,
  });

  log(`RiskScoreVault deployed to: ${riskScoreVault.address}`);

  // Verify contract on Etherscan if not local network
  if (network.name !== "hardhat" && network.name !== "localhost") {
    log("Waiting for block confirmations...");
    await new Promise(resolve => setTimeout(resolve, 30000)); // Wait 30 seconds
    
    try {
      await hre.run("verify:verify", {
        address: riskScoreVault.address,
        constructorArguments: [config.initialOwner],
      });
      log("Contract verified on Etherscan");
    } catch (error) {
      log("Verification failed:", error);
    }
  }

  // Post-deployment setup
  if (riskScoreVault.newlyDeployed) {
    log("Setting up initial configuration...");
    
    const contract = await hre.ethers.getContractAt("RiskScoreVault", riskScoreVault.address);
    
    // Set up authorized updaters if specified
    if (config.authorizedUpdaters && config.authorizedUpdaters.length > 0) {
      for (const updater of config.authorizedUpdaters) {
        log(`Authorizing updater: ${updater}`);
        const tx = await contract.setAuthorizedUpdater(updater, true);
        await tx.wait(config.waitConfirmations);
      }
    }

    // Set custom configuration if specified
    if (config.minUpdateInterval) {
      log(`Setting min update interval: ${config.minUpdateInterval}`);
      const tx = await contract.setMinUpdateInterval(config.minUpdateInterval);
      await tx.wait(config.waitConfirmations);
    }

    if (config.maxDailyDecryptions) {
      log(`Setting max daily decryptions: ${config.maxDailyDecryptions}`);
      const tx = await contract.setMaxDailyDecryptions(config.maxDailyDecryptions);
      await tx.wait(config.waitConfirmations);
    }

    log("Initial configuration completed");
  }

  // Save deployment info for frontend
  const deploymentInfo = {
    network: network.name,
    chainId: network.config.chainId,
    address: riskScoreVault.address,
    deployer: deployer,
    timestamp: new Date().toISOString(),
    blockNumber: riskScoreVault.receipt?.blockNumber,
    transactionHash: riskScoreVault.transactionHash,
    config: config
  };

  // Write deployment info to file
  const fs = require("fs");
  const path = require("path");
  
  const deploymentDir = path.join(__dirname, "../deployments-info");
  if (!fs.existsSync(deploymentDir)) {
    fs.mkdirSync(deploymentDir, { recursive: true });
  }
  
  const deploymentFile = path.join(deploymentDir, `${network.name}.json`);
  fs.writeFileSync(deploymentFile, JSON.stringify(deploymentInfo, null, 2));
  
  log(`Deployment info saved to: ${deploymentFile}`);
  log("----------------------------------------------------");
};

/**
 * @notice Get deployment configuration based on network
 * @param networkName The name of the network being deployed to
 * @returns Deployment configuration object
 */
function getDeploymentConfig(networkName: string) {
  const baseConfig = {
    waitConfirmations: 1,
    minUpdateInterval: 3600, // 1 hour
    maxDailyDecryptions: 10,
    authorizedUpdaters: [] as string[]
  };

  switch (networkName) {
    case "sepolia":
      return {
        ...baseConfig,
        initialOwner: process.env.SEPOLIA_OWNER || process.env.DEPLOYER_ADDRESS,
        waitConfirmations: 3,
        authorizedUpdaters: process.env.SEPOLIA_UPDATERS ? 
          process.env.SEPOLIA_UPDATERS.split(",") : []
      };
    
    case "zama":
      return {
        ...baseConfig,
        initialOwner: process.env.ZAMA_OWNER || process.env.DEPLOYER_ADDRESS,
        waitConfirmations: 2,
        authorizedUpdaters: process.env.ZAMA_UPDATERS ? 
          process.env.ZAMA_UPDATERS.split(",") : []
      };
    
    case "localhost":
    case "hardhat":
      return {
        ...baseConfig,
        initialOwner: process.env.LOCAL_OWNER || "0xf39Fd6e51aad88F6F4ce6aB8827279cffFb92266", // Default hardhat account
        waitConfirmations: 1,
        minUpdateInterval: 60, // 1 minute for testing
        maxDailyDecryptions: 100, // Higher limit for testing
        authorizedUpdaters: [
          "0x70997970C51812dc3A010C7d01b50e0d17dc79C8", // Hardhat account 1
          "0x3C44CdDdB6a900fa2b585dd299e03d12FA4293BC"  // Hardhat account 2
        ]
      };
    
    default:
      throw new Error(`No configuration found for network: ${networkName}`);
  }
}

export default deployRiskScoreVault;

// Tags for selective deployment
deployRiskScoreVault.tags = ["RiskScoreVault", "main"];

// Dependencies (if any other contracts need to be deployed first)
deployRiskScoreVault.dependencies = [];

