import hre from "hardhat";

const { ethers } = hre;

const required = [
  "NEXT_PUBLIC_CONTRACT_ADDRESS",
  "SEPOLIA_RPC_URL",
  "NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID",
  "WEBHOOK_DELIVERY_SECRET",
  "RELAYER_PRIVATE_KEY",
  "RELAYER_ALLOWED_OWNERS",
];

const WEBHOOK_SECRET_PLACEHOLDER = "change_this_to_a_long_random_worker_secret";
const RELAYER_KEY_PLACEHOLDER = "0x1111111111111111111111111111111111111111111111111111111111111111";

function assertAddress(name: string) {
  const value = process.env[name] || "";
  if (!ethers.isAddress(value) || value === ethers.ZeroAddress) {
    throw new Error(`${name} must be a deployed contract address`);
  }
}

function assertAddressList(name: string) {
  const values = (process.env[name] || "").split(",").map((value) => value.trim()).filter(Boolean);
  if (values.length === 0) throw new Error(`${name} must contain at least one wallet address`);
  for (const value of values) {
    if (!/^0x[a-fA-F0-9]{40}$/.test(value)) {
      throw new Error(`${name} contains an invalid wallet address`);
    }
  }
}

function normalizedPrivateKey(value: string) {
  return (value.startsWith("0x") ? value : `0x${value}`) as `0x${string}`;
}

async function assertDeployedBytecodeMatches() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "";
  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`No contract code is deployed at ${address}`);

  const artifact = await hre.artifacts.readArtifact("FhenixDropBox");
  const expected = artifact.deployedBytecode;
  if (code.toLowerCase() !== expected.toLowerCase()) {
    throw new Error([
      "NEXT_PUBLIC_CONTRACT_ADDRESS does not match the locally compiled FhenixDropBox artifact.",
      `On-chain bytecode: ${ethers.dataLength(code)} bytes, ${ethers.keccak256(code)}`,
      `Local artifact: ${ethers.dataLength(expected)} bytes, ${ethers.keccak256(expected)}`,
      "Redeploy the current contract artifact and update NEXT_PUBLIC_CONTRACT_ADDRESS before production.",
    ].join("\n"));
  }
}

async function assertRelayerTrusted() {
  const relayerKey = process.env.RELAYER_PRIVATE_KEY || "";
  const relayer = new ethers.Wallet(normalizedPrivateKey(relayerKey));
  const artifact = await hre.artifacts.readArtifact("FhenixDropBox");
  const contract = new ethers.Contract(process.env.NEXT_PUBLIC_CONTRACT_ADDRESS || "", artifact.abi, ethers.provider);
  const trusted = await contract.trustedRelayers(relayer.address);

  if (!trusted) {
    throw new Error(`Configured relayer ${relayer.address} is not trusted by the deployed contract`);
  }
}

async function main() {
  for (const name of required) {
    if (!process.env[name]) throw new Error(`${name} is required`);
  }

  if (!process.env.PINATA_JWT && !(process.env.PINATA_API_KEY && process.env.PINATA_API_SECRET)) {
    throw new Error("PINATA_JWT or both PINATA_API_KEY and PINATA_API_SECRET are required");
  }

  const webhookSecret = process.env.WEBHOOK_DELIVERY_SECRET || "";
  if (webhookSecret === WEBHOOK_SECRET_PLACEHOLDER || webhookSecret.length < 24) {
    throw new Error("WEBHOOK_DELIVERY_SECRET must be replaced with a strong production secret");
  }

  if (process.env.NEXT_PUBLIC_ENABLE_RESUMABLE_UPLOADS === "true" && !process.env.RESUMABLE_UPLOAD_DIR) {
    throw new Error("RESUMABLE_UPLOAD_DIR is required when resumable uploads are enabled");
  }

  assertAddress("NEXT_PUBLIC_CONTRACT_ADDRESS");
  assertAddressList("RELAYER_ALLOWED_OWNERS");

  if ((process.env.PRIVATE_KEY || "").startsWith("0x0000")) {
    throw new Error("PRIVATE_KEY is still the sample value");
  }

  const deployerKey = process.env.PRIVATE_KEY ? normalizedPrivateKey(process.env.PRIVATE_KEY).toLowerCase() : "";
  const relayerKey = process.env.RELAYER_PRIVATE_KEY ? normalizedPrivateKey(process.env.RELAYER_PRIVATE_KEY).toLowerCase() : "";
  if (deployerKey && relayerKey === deployerKey) {
    throw new Error("RELAYER_PRIVATE_KEY must be a dedicated key, not the deployer PRIVATE_KEY");
  }

  if (process.env.RELAYER_PRIVATE_KEY === RELAYER_KEY_PLACEHOLDER) {
    throw new Error("RELAYER_PRIVATE_KEY is still the sample value");
  }

  await assertDeployedBytecodeMatches();
  await assertRelayerTrusted();

  console.log("Production environment check passed.");
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
