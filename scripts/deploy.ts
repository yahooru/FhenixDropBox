import pkg from "hardhat";
const { ethers } = pkg;

async function main() {
  console.log("Deploying FhenixDropBox contract...");

  const FhenixDropBox = await ethers.getContractFactory("FhenixDropBox");
  const contract = await FhenixDropBox.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`FhenixDropBox deployed to: ${address}`);

  // Verify deployment
  const totalFiles = await contract.totalFiles();
  console.log(`Total files: ${totalFiles}`);

  console.log("\nDeployment successful!");
  console.log(`Contract Address: ${address}`);
  console.log(`Network: Arbitrum Sepolia (Chain ID: 421614)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
