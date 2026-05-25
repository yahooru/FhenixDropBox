import hre from "hardhat";

const { ethers, network } = hre;

async function main() {
  const address = process.env.NEXT_PUBLIC_CONTRACT_ADDRESS;
  if (!address) throw new Error("NEXT_PUBLIC_CONTRACT_ADDRESS is required");

  const code = await ethers.provider.getCode(address);
  if (code === "0x") throw new Error(`No contract code at ${address}`);

  const artifact = await hre.artifacts.readArtifact("FhenixDropBox");
  if (code.toLowerCase() !== artifact.deployedBytecode.toLowerCase()) {
    throw new Error([
      "Monitor refused to continue because the deployed bytecode does not match the local FhenixDropBox artifact.",
      `On-chain bytecode: ${ethers.dataLength(code)} bytes, ${ethers.keccak256(code)}`,
      `Local artifact: ${ethers.dataLength(artifact.deployedBytecode)} bytes, ${ethers.keccak256(artifact.deployedBytecode)}`,
    ].join("\n"));
  }

  const contract = new ethers.Contract(address, artifact.abi, ethers.provider);
  const stats = await contract.getProductionStats();
  const latestBlock = await ethers.provider.getBlockNumber();

  console.log(`FhenixDropBox monitor ok`);
  console.log(`Network: ${network.name} (${network.config.chainId})`);
  console.log(`Contract: ${address}`);
  console.log(`Latest block: ${latestBlock}`);
  console.log(`Files: ${stats[0].toString()}`);
  console.log(`Downloads: ${stats[1].toString()}`);
  console.log(`Volume wei: ${stats[2].toString()}`);
  console.log(`Folders: ${stats[3].toString()}`);
  console.log(`Webhooks: ${stats[4].toString()}`);
  console.log(`Teams: ${stats[5].toString()}`);
  console.log(`Subscription plans: ${stats[6].toString()}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
