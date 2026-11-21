// Genera el hash SHA-256 de un archivo leyéndolo por fragmentos (streams).
// Así una tesis de varios GB no se carga completa en memoria.
const crypto = require("crypto");
const fs = require("fs");

/**
 * @param {string} ruta Ruta del archivo
 * @returns {Promise<string>} Hash en formato 0x + 64 caracteres hex (bytes32)
 */
function hashArchivo(ruta) {
  return new Promise((resolve, reject) => {
    const hash = crypto.createHash("sha256");
    fs.createReadStream(ruta, { highWaterMark: 1024 * 1024 }) // fragmentos de 1 MB
      .on("data", (chunk) => hash.update(chunk))
      .on("end", () => resolve("0x" + hash.digest("hex")))
      .on("error", reject);
  });
}

module.exports = { hashArchivo };
