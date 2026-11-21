// Uso: node backend/hash.js ruta/al/archivo.pdf
const { hashArchivo } = require("./hashModule");
const fs = require("fs");

const ruta = process.argv[2];
if (!ruta) { console.error("Uso: node backend/hash.js <archivo>"); process.exit(1); }

const inicio = process.hrtime.bigint();
hashArchivo(ruta).then((h) => {
  const ms = Number(process.hrtime.bigint() - inicio) / 1e6;
  const mb = fs.statSync(ruta).size / 1024 / 1024;
  console.log(`Archivo: ${ruta} (${mb.toFixed(2)} MB)`);
  console.log(`SHA-256: ${h}`);
  console.log(`Tiempo:  ${ms.toFixed(1)} ms | Memoria usada: ${(process.memoryUsage().rss / 1024 / 1024).toFixed(1)} MB`);
}).catch((e) => { console.error(e.message); process.exit(1); });
