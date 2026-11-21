// Despliega RegistroIP y deja la dirección + ABI listas para el frontend.
const { ethers, network, artifacts } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log(`Red: ${network.name}`);
  console.log(`Desplegando con la cuenta: ${deployer.address}`);

  const contrato = await ethers.deployContract("RegistroIP");
  await contrato.waitForDeployment();
  const address = await contrato.getAddress();
  const receipt = await contrato.deploymentTransaction().wait();
  const { chainId } = await ethers.provider.getNetwork();

  console.log(`RegistroIP desplegado en: ${address}`);
  console.log(`Bloque: ${receipt.blockNumber} | Gas usado en el despliegue: ${receipt.gasUsed}`);
  if (network.name === "sepolia") {
    console.log(`Etherscan: https://sepolia.etherscan.io/address/${address}`);
  }

  const { abi } = await artifacts.readArtifact("RegistroIP");
  const destino = path.join(__dirname, "..", "frontend", "src", "contract.json");
  fs.writeFileSync(
    destino,
    JSON.stringify({ address, chainId: Number(chainId), deployBlock: receipt.blockNumber, abi }, null, 2)
  );
  console.log(`Dirección y ABI guardados en ${destino}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
