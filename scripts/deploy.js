const hre = require("hardhat");

async function main() {
  console.log("Deploying VaultManager contract...");
  
  const VaultManager = await hre.ethers.getContractFactory("VaultManager");
  const vaultManager = await VaultManager.deploy();
  
  await vaultManager.waitForDeployment();
  
  console.log("VaultManager deployed to:", await vaultManager.getAddress());
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  }); 