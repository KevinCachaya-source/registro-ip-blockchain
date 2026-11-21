// Registra un archivo desde la terminal (útil como plan B en la demo).
// Uso: ARCHIVO=ruta/al/archivo.pdf npx hardhat run scripts/registrar.js --network localhost
const { ethers } = require("hardhat");
const { hashArchivo } = require("../backend/hashModule");
const { address } = require("../frontend/src/contract.json");

async function main() {
  const archivo = process.env.ARCHIVO;
  if (!archivo) throw new Error("Indica el archivo: ARCHIVO=ruta/al/archivo.pdf");

  const hash = await hashArchivo(archivo);
  console.log(`Hash SHA-256: ${hash}`);

  const contrato = await ethers.getContractAt("RegistroIP", address);
  const [, , yaExiste] = await contrato.verificarDocumento(hash);
  if (yaExiste) {
    const [autor, ts] = await contrato.verificarDocumento(hash);
    console.log(`Ya estaba registrado por ${autor} el ${new Date(Number(ts) * 1000).toLocaleString("es-CO")}`);
    return;
  }

  const tx = await contrato.registrarDocumento(hash);
  const receipt = await tx.wait();
  console.log(`Registrado. TxHash: ${receipt.hash} | Bloque: ${receipt.blockNumber} | Gas: ${receipt.gasUsed}`);
}

main().catch((e) => { console.error(e); process.exit(1); });
