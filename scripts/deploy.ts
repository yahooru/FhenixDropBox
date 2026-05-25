import pkg from "hardhat";
const { ethers, network } = pkg;

const RELAYER_KEY_PLACEHOLDERS = new Set([
  "0x0000000000000000000000000000000000000000000000000000000000000000",
  "0x1111111111111111111111111111111111111111111111111111111111111111",
]);

function normalizePrivateKey(name: string, value: string) {
  const key = value.trim();
  const normalized = key.startsWith("0x") ? key : `0x${key}`;
  if (!/^0x[a-fA-F0-9]{64}$/.test(normalized)) {
    throw new Error(`${name} must be a 32-byte private key`);
  }
  if (RELAYER_KEY_PLACEHOLDERS.has(normalized.toLowerCase())) {
    throw new Error(`${name} is still a sample value`);
  }
  return normalized;
}

async function main() {
  const relayerKeyRaw = process.env.RELAYER_PRIVATE_KEY;
  let relayerKey: string | undefined;
  if (relayerKeyRaw) {
    relayerKey = normalizePrivateKey("RELAYER_PRIVATE_KEY", relayerKeyRaw);
    const deployerKeyRaw = process.env.PRIVATE_KEY;
    if (deployerKeyRaw) {
      const deployerKey = normalizePrivateKey("PRIVATE_KEY", deployerKeyRaw);
      if (deployerKey.toLowerCase() === relayerKey.toLowerCase()) {
        throw new Error("RELAYER_PRIVATE_KEY must be different from PRIVATE_KEY");
      }
    }
  }

  console.log("Deploying FhenixDropBox contract...");

  const FhenixDropBox = await ethers.getContractFactory("FhenixDropBox");
  const contract = await FhenixDropBox.deploy();

  await contract.waitForDeployment();
  const address = await contract.getAddress();

  console.log(`FhenixDropBox deployed to: ${address}`);

  // Verify deployment
  const totalFiles = await contract.totalFiles();
  console.log(`Total files: ${totalFiles}`);

  if (relayerKey) {
    const relayerAddress = new ethers.Wallet(relayerKey).address;
    const trustTx = await contract.setTrustedRelayer(relayerAddress, true);
    await trustTx.wait();
    console.log(`Trusted relayer: ${relayerAddress}`);
  }

  console.log("\nDeployment successful!");
  console.log(`Contract Address: ${address}`);
  console.log(`Network: ${network.name} (Chain ID: ${network.config.chainId})`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
