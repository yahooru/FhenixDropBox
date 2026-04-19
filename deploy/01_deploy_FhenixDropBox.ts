import { HardhatRuntimeEnvironment } from "hardhat";
import { DeployFunction } from "hardhat-deploy/types";

const deployFunc: DeployFunction = async (hre: HardhatRuntimeEnvironment) => {
  const { deployments, getNamedAccounts } = hre;
  const { deploy } = deployments;

  const { deployer } = await getNamedAccounts();

  console.log("Deploying FhenixDropBox contract...");

  const deployment = await deploy("FhenixDropBox", {
    from: deployer,
    args: [],
    log: true,
    autoMine: true,
  });

  console.log(`FhenixDropBox deployed to: ${deployment.address}`);

  // Verify on block explorer (if configured)
  if (hre.network.name !== "hardhat" && hre.network.name !== "localhost") {
    try {
      await hre.run("verify:verify", {
        address: deployment.address,
        constructorArguments: [],
      });
      console.log("Contract verified successfully");
    } catch (error) {
      console.log("Verification failed (may need API key):", error);
    }
  }
};

export default deployFunc;
deployFunc.tags = ["FhenixDropBox"];
