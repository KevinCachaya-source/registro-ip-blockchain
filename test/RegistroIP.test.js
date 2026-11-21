const { expect } = require("chai");
const { ethers } = require("hardhat");
const { anyValue } = require("@nomicfoundation/hardhat-chai-matchers/withArgs");

describe("RegistroIP", function () {
  let contrato, autor, otro;
  // Hash de ejemplo: SHA-256 del texto "Tesis de prueba"
  const HASH = ethers.sha256(ethers.toUtf8Bytes("Tesis de prueba"));

  beforeEach(async function () {
    [autor, otro] = await ethers.getSigners();
    contrato = await ethers.deployContract("RegistroIP");
    await contrato.waitForDeployment();
  });

  it("1. Registra un documento nuevo y guarda autor y fecha", async function () {
    await contrato.connect(autor).registrarDocumento(HASH);
    const [dirAutor, timestamp, registrado] = await contrato.verificarDocumento(HASH);
    const bloque = await ethers.provider.getBlock("latest");

    expect(registrado).to.equal(true);
    expect(dirAutor).to.equal(autor.address);
    expect(timestamp).to.equal(BigInt(bloque.timestamp));
  });

  it("2. Emite el evento DocumentoRegistrado", async function () {
    await expect(contrato.connect(autor).registrarDocumento(HASH))
      .to.emit(contrato, "DocumentoRegistrado")
      .withArgs(HASH, autor.address, anyValue);
  });

  it("3. Rechaza registrar el mismo documento dos veces (incluso desde otra wallet)", async function () {
    await contrato.connect(autor).registrarDocumento(HASH);
    await expect(contrato.connect(otro).registrarDocumento(HASH))
      .to.be.revertedWith("Documento ya registrado");
  });

  it("4. Rechaza un hash vacío", async function () {
    await expect(contrato.registrarDocumento(ethers.ZeroHash))
      .to.be.revertedWith("Hash vacio");
  });

  it("5. Consulta un documento no registrado sin error", async function () {
    const otroHash = ethers.sha256(ethers.toUtf8Bytes("Documento inexistente"));
    const [dirAutor, timestamp, registrado] = await contrato.verificarDocumento(otroHash);

    expect(registrado).to.equal(false);
    expect(dirAutor).to.equal(ethers.ZeroAddress);
    expect(timestamp).to.equal(0n);
  });
});
