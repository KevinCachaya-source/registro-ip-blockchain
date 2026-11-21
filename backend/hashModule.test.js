// Pruebas del módulo de hashing (no requieren blockchain). Uso: node backend/hashModule.test.js
const assert = require("assert");
const crypto = require("crypto");
const fs = require("fs");
const os = require("os");
const path = require("path");
const { hashArchivo } = require("./hashModule");

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), "hash-"));
  const a = path.join(dir, "a.txt"), b = path.join(dir, "b.txt"), grande = path.join(dir, "grande.bin");
  fs.writeFileSync(a, "Tesis de prueba");
  fs.writeFileSync(b, "Tesis de prueba."); // un solo carácter distinto

  // 1. Coincide con el SHA-256 estándar
  const esperado = "0x" + crypto.createHash("sha256").update("Tesis de prueba").digest("hex");
  assert.strictEqual(await hashArchivo(a), esperado);
  console.log("✔ 1. Coincide con el SHA-256 estándar");

  // 2. Determinista: mismo archivo => mismo hash
  assert.strictEqual(await hashArchivo(a), await hashArchivo(a));
  console.log("✔ 2. Determinista");

  // 3. Un cambio mínimo produce un hash completamente distinto
  assert.notStrictEqual(await hashArchivo(a), await hashArchivo(b));
  console.log("✔ 3. Un carácter distinto cambia el hash");

  // 4. Formato bytes32 (0x + 64 hex), listo para el contrato
  assert.match(await hashArchivo(a), /^0x[0-9a-f]{64}$/);
  console.log("✔ 4. Formato bytes32 válido");

  // 5. Archivo grande (200 MB) procesado por streams
  const fd = fs.openSync(grande, "w"); const bloque = crypto.randomBytes(1024 * 1024);
  for (let i = 0; i < 200; i++) fs.writeSync(fd, bloque); fs.closeSync(fd);
  const t = Date.now(); await hashArchivo(grande);
  console.log(`✔ 5. Archivo de 200 MB en ${Date.now() - t} ms, memoria: ${(process.memoryUsage().rss / 1048576).toFixed(0)} MB`);

  fs.rmSync(dir, { recursive: true, force: true });
  console.log("\nTodas las pruebas del módulo de hashing pasaron.");
})().catch((e) => { console.error("✘", e.message); process.exit(1); });
