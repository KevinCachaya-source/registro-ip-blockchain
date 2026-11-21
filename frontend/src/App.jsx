import { useEffect, useRef, useState } from "react";
import { BrowserProvider, Contract, JsonRpcProvider } from "ethers";
import info from "./contract.json";

// ---------- Utilidades ----------

const REDES = {
  11155111: { nombre: "Sepolia", explorador: "https://sepolia.etherscan.io" },
  31337: { nombre: "Hardhat local", explorador: null },
};
const red = REDES[info.chainId] ?? { nombre: `Red ${info.chainId}`, explorador: null };

/** SHA-256 del archivo, calculado en el navegador. El archivo nunca sale del equipo. */
async function hashArchivo(file) {
  const buffer = await file.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return "0x" + [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

const corta = (s, n = 6) => (s ? `${s.slice(0, n + 2)}…${s.slice(-4)}` : "");
const fecha = (ts) =>
  new Date(Number(ts) * 1000).toLocaleString("es-CO", { dateStyle: "long", timeStyle: "medium" });
const tamano = (b) => (b > 1048576 ? `${(b / 1048576).toFixed(1)} MB` : `${(b / 1024).toFixed(1)} KB`);

function mensajeError(e) {
  if (e?.code === "ACTION_REJECTED") return "Cancelaste la transacción en MetaMask. No se registró nada.";
  // MetaMask a veces envuelve el error real; se busca el mensaje más interno
  const interno = e?.error?.data?.message || e?.error?.message || e?.info?.error?.data?.message || e?.info?.error?.message;
  const r = e?.reason || interno || e?.shortMessage || e?.message || "Error desconocido";
  if (r.includes("Internal JSON-RPC error") || r.includes("could not coalesce"))
    return "MetaMask no pudo enviar la transacción. Revisa que el sitio esté conectado a la red Sepolia y que esa cuenta tenga ETH de prueba en Sepolia. Detalle técnico en la consola (F12).";
  if (r.includes("Documento ya registrado")) return "Este documento ya está registrado en la blockchain.";
  if (r.includes("could not decode result data")) return "No se encontró el contrato en esta red. Revisa que MetaMask esté en Sepolia y que contract.json tenga la dirección desplegada.";
  if (r.includes("failed to fetch") || r.includes("Failed to fetch") || r.includes("NETWORK_ERROR")) return "No se pudo conectar con la red. Revisa tu conexión a internet e intenta de nuevo.";
  if (r.includes("insufficient funds")) return "Tu wallet no tiene ETH de prueba para pagar el gas. Pide fondos en un faucet de Sepolia.";
  return r;
}

// Nodos públicos de solo lectura: verificar no necesita MetaMask ni importa en qué red esté la wallet
const RPC_LECTURA = {
  11155111: "https://ethereum-sepolia-rpc.publicnode.com",
  31337: "http://127.0.0.1:8545",
};

function lectorContrato() {
  const url = import.meta.env.VITE_RPC_URL || RPC_LECTURA[info.chainId];
  if (url) return new Contract(info.address, info.abi, new JsonRpcProvider(url, info.chainId, { staticNetwork: true }));
  if (window.ethereum) return new Contract(info.address, info.abi, new BrowserProvider(window.ethereum));
  return null;
}

/** Busca el evento del registro para obtener bloque y transacción. */
async function buscarEvento(contrato, hash) {
  try {
    const logs = await contrato.queryFilter(contrato.filters.DocumentoRegistrado(hash), info.deployBlock || 0);
    return logs[0] ? { bloque: logs[0].blockNumber, tx: logs[0].transactionHash } : null;
  } catch {
    return null; // algunos nodos limitan el rango de búsqueda; el registro sigue siendo válido
  }
}

function descargarCertificado(c) {
  const enlace = red.explorador ? `${red.explorador}/tx/${c.tx}` : null;
  const html = `<!doctype html><html lang="es"><head><meta charset="utf-8"><title>Certificado de registro</title>
<style>body{font-family:Georgia,serif;max-width:720px;margin:48px auto;padding:0 24px;color:#1b1b1f}
h1{font-family:Arial Black,Arial,sans-serif;letter-spacing:.02em;border-bottom:6px solid #d7141a;padding-bottom:12px}
dt{font:600 13px Arial,sans-serif;color:#6b6f78;margin-top:18px}dd{margin:4px 0 0;font:15px monospace;word-break:break-all}
p.nota{margin-top:36px;font-size:13px;color:#555;line-height:1.6}</style></head><body>
<h1>Certificado de registro de autoría</h1>
<p>La huella digital (SHA-256) del siguiente documento quedó registrada de forma permanente en la blockchain de Ethereum.</p>
<dl>
<dt>Documento</dt><dd>${c.nombre}</dd>
<dt>Huella SHA-256</dt><dd>${c.hash}</dd>
<dt>Wallet del autor</dt><dd>${c.autor}</dd>
<dt>Fecha y hora del registro</dt><dd>${fecha(c.timestamp)} (Unix ${c.timestamp})</dd>
<dt>Bloque</dt><dd>${c.bloque ?? "—"}</dd>
<dt>Transacción</dt><dd>${c.tx ?? "—"}</dd>
<dt>Contrato / red</dt><dd>${info.address} · ${red.nombre}</dd>
</dl>
${enlace ? `<p><a href="${enlace}">Ver la transacción en el explorador</a></p>` : ""}
<p class="nota">Para comprobar este certificado, cualquier persona puede cargar el archivo original en la plataforma: si su huella coincide, el sistema mostrará la misma wallet y la misma fecha. Conserve el archivo original sin modificaciones; cualquier cambio, por mínimo que sea, produce una huella distinta.</p>
</body></html>`;
  const a = document.createElement("a");
  a.href = URL.createObjectURL(new Blob([html], { type: "text/html" }));
  a.download = `certificado-${c.hash.slice(2, 10)}.html`;
  a.click();
  URL.revokeObjectURL(a.href);
}

// ---------- Componentes ----------

function Huella({ hash }) {
  // La huella se muestra en 4 líneas de 16 caracteres: es el elemento central de la interfaz
  const hex = hash.slice(2);
  return (
    <div className="huella" aria-label={`Huella SHA-256 ${hash}`}>
      {[0, 1, 2, 3].map((i) => <span key={i}>{hex.slice(i * 16, i * 16 + 16)}</span>)}
    </div>
  );
}

function SelectorArchivo({ archivo, onArchivo, calculando }) {
  const input = useRef(null);
  const [encima, setEncima] = useState(false);
  return (
    <div
      className={`zona ${encima ? "encima" : ""}`}
      onDragOver={(e) => { e.preventDefault(); setEncima(true); }}
      onDragLeave={() => setEncima(false)}
      onDrop={(e) => { e.preventDefault(); setEncima(false); e.dataTransfer.files[0] && onArchivo(e.dataTransfer.files[0]); }}
    >
      <input ref={input} type="file" hidden onChange={(e) => e.target.files[0] && onArchivo(e.target.files[0])} />
      {archivo ? (
        <p><strong>{archivo.name}</strong> <span className="tenue">{tamano(archivo.size)}</span></p>
      ) : (
        <p>Arrastra aquí tu tesis o artículo (PDF, DOCX, ZIP…)</p>
      )}
      <button type="button" className="secundario" onClick={() => input.current.click()} disabled={calculando}>
        {archivo ? "Cambiar archivo" : "Elegir archivo"}
      </button>
      <p className="tenue pequeno">El archivo se analiza en tu navegador. No se sube a ningún servidor.</p>
    </div>
  );
}

export default function App() {
  const [modo, setModo] = useState("registrar");
  const [cuenta, setCuenta] = useState(null);
  const [archivo, setArchivo] = useState(null);
  const [hash, setHash] = useState(null);
  const [calculando, setCalculando] = useState(false);
  const [estado, setEstado] = useState(null); // {tipo: "info"|"ok"|"error", texto}
  const [ocupado, setOcupado] = useState(false);
  const [certificado, setCertificado] = useState(null);
  const [verificacion, setVerificacion] = useState(null);
  const [verificando, setVerificando] = useState(false);

  useEffect(() => {
    if (!window.ethereum) return;
    const recargar = () => window.location.reload();
    window.ethereum.on?.("accountsChanged", recargar);
    window.ethereum.on?.("chainChanged", recargar);
    return () => {
      window.ethereum.removeListener?.("accountsChanged", recargar);
      window.ethereum.removeListener?.("chainChanged", recargar);
    };
  }, []);

  function cambiarModo(nuevoModo) {
    setModo(nuevoModo); setEstado(null); setCertificado(null); setVerificacion(null);
    // Se conserva el archivo: si ya hay huella y pasamos a "Verificar", se consulta de inmediato
    if (nuevoModo === "verificar" && hash) verificar(hash);
  }

  async function conectar() {
    if (!window.ethereum) {
      setEstado({ tipo: "error", texto: "No se encontró MetaMask. Instala la extensión en tu navegador y recarga la página." });
      return;
    }
    try {
      const provider = new BrowserProvider(window.ethereum);
      await provider.send("eth_requestAccounts", []);
      const { chainId } = await provider.getNetwork();
      if (Number(chainId) !== info.chainId) {
        await window.ethereum.request({
          method: "wallet_switchEthereumChain",
          params: [{ chainId: "0x" + info.chainId.toString(16) }],
        });
        return; // el evento chainChanged recarga la página
      }
      setCuenta(await (await provider.getSigner()).getAddress());
      setEstado(null);
    } catch (e) {
      setEstado({ tipo: "error", texto: mensajeError(e) });
    }
  }

  async function elegirArchivo(file) {
    setArchivo(file); setHash(null); setCertificado(null); setVerificacion(null); setEstado(null);
    setCalculando(true);
    try {
      const h = await hashArchivo(file);
      setHash(h);
      if (modo === "verificar") await verificar(h);
    } catch (e) {
      setEstado({ tipo: "error", texto: `No se pudo leer el archivo: ${e.message}` });
    } finally {
      setCalculando(false);
    }
  }

  async function registrar() {
    setOcupado(true); setCertificado(null);
    try {
      const provider = new BrowserProvider(window.ethereum);
      const { chainId } = await provider.getNetwork();
      if (Number(chainId) !== info.chainId) {
        setEstado({ tipo: "error", texto: `MetaMask está en otra red. Cámbiala a ${red.nombre} y vuelve a intentarlo.` });
        await window.ethereum.request({ method: "wallet_switchEthereumChain", params: [{ chainId: "0x" + info.chainId.toString(16) }] });
        return;
      }
      const signer = await provider.getSigner();
      const contrato = new Contract(info.address, info.abi, signer);
      const lector = lectorContrato(); // nodo público: lecturas sin pasar por MetaMask

      // Se consulta antes de enviar para no gastar gas en un duplicado
      const [autorPrevio, tsPrevio, existe] = await lector.verificarDocumento(hash);
      if (existe) {
        setEstado({ tipo: "error", texto: `Este documento ya fue registrado por ${corta(autorPrevio)} el ${fecha(tsPrevio)}.` });
        return;
      }

      // El gas se estima con el nodo público; así MetaMask no tiene que estimarlo
      let gasLimit = 150000n;
      try {
        gasLimit = ((await lector.registrarDocumento.estimateGas(hash, { from: cuenta })) * 12n) / 10n;
      } catch (e) {
        if (e?.code === "CALL_EXCEPTION") throw e; // el contrato rechazaría el registro
        console.warn("No se pudo estimar el gas; se usa 150000", e);
      }

      setEstado({ tipo: "info", texto: "Confirma la transacción en MetaMask…" });
      const tx = await contrato.registrarDocumento(hash, { gasLimit });
      setEstado({ tipo: "info", texto: `Transacción enviada (${corta(tx.hash)}). Esperando confirmación en ${red.nombre}…` });
      const receipt = await tx.wait();
      const [autor, timestamp] = await lector.verificarDocumento(hash);

      setCertificado({
        nombre: archivo.name, hash, autor, timestamp: timestamp.toString(),
        bloque: receipt.blockNumber, tx: receipt.hash, gas: receipt.gasUsed.toString(),
      });
      setEstado({ tipo: "ok", texto: "Documento registrado." });
    } catch (e) {
      console.error("Error al registrar:", e);
      setEstado({ tipo: "error", texto: mensajeError(e) });
    } finally {
      setOcupado(false);
    }
  }

  async function verificar(h) {
    const contrato = lectorContrato();
    if (!contrato) {
      setEstado({ tipo: "error", texto: "Para verificar necesitas MetaMask o configurar VITE_RPC_URL." });
      return;
    }
    setVerificando(true); setEstado(null); setVerificacion(null);
    try {
      const [autor, timestamp, registrado] = await contrato.verificarDocumento(h);
      const evento = registrado ? await buscarEvento(contrato, h) : null;
      setVerificacion({ registrado, autor, timestamp: timestamp.toString(), ...evento });
    } catch (e) {
      console.error(e);
      setEstado({ tipo: "error", texto: mensajeError(e) });
    } finally {
      setVerificando(false);
    }
  }

  const sinContrato = !info.address;

  return (
    <div className="pagina">
      <header className="cabecera">
        <div>
          <h1>Registro de propiedad intelectual académica</h1>
        </div>
        {cuenta ? (
          <span className="wallet" title={cuenta}>{corta(cuenta)} · {red.nombre}</span>
        ) : (
          <button onClick={conectar}>Conectar MetaMask</button>
        )}
      </header>

      {sinContrato && (
        <p className="aviso error">Aún no hay contrato desplegado. Ejecuta <code>npm run deploy:local</code> o <code>npm run deploy:sepolia</code> en la carpeta raíz.</p>
      )}

      <nav className="pestanas" role="tablist">
        <button role="tab" aria-selected={modo === "registrar"} onClick={() => cambiarModo("registrar")}>Registrar documento</button>
        <button role="tab" aria-selected={modo === "verificar"} onClick={() => cambiarModo("verificar")}>Verificar autoría</button>
      </nav>

      <main className="contenido">
        <section>
          <SelectorArchivo archivo={archivo} onArchivo={elegirArchivo} calculando={calculando} />

          {calculando && <p className="tenue">Calculando huella SHA-256…</p>}

          {hash && (
            <div className="bloque-huella">
              <h2>Huella digital del documento</h2>
              <Huella hash={hash} />
              <p className="tenue pequeno">Esto es lo único que se guarda en la blockchain. A partir de la huella no se puede reconstruir el documento.</p>
            </div>
          )}

          {modo === "registrar" && hash && !certificado && (
            cuenta ? (
              <button className="principal" onClick={registrar} disabled={ocupado || sinContrato}>
                {ocupado ? "Registrando…" : "Registrar en la blockchain"}
              </button>
            ) : (
              <p className="tenue">Conecta MetaMask para registrar este documento a tu nombre.</p>
            )
          )}

          {modo === "verificar" && hash && !verificacion && (
            <button className="principal" onClick={() => verificar(hash)} disabled={verificando || sinContrato}>
              {verificando ? "Consultando la blockchain…" : "Verificar autoría"}
            </button>
          )}

          {estado && <p className={`aviso ${estado.tipo}`} role="status">{estado.texto}</p>}
        </section>

        <aside>
          {modo === "registrar" && certificado && (
            <div className="resultado ok">
              <h2>Registro confirmado</h2>
              <dl>
                <dt>Autor</dt><dd>{certificado.autor}</dd>
                <dt>Fecha y hora</dt><dd>{fecha(certificado.timestamp)}</dd>
                <dt>Bloque</dt><dd>{certificado.bloque}</dd>
                <dt>Transacción</dt>
                <dd>{red.explorador
                  ? <a href={`${red.explorador}/tx/${certificado.tx}`} target="_blank" rel="noreferrer">{corta(certificado.tx, 10)}</a>
                  : corta(certificado.tx, 10)}</dd>
                <dt>Gas usado</dt><dd>{certificado.gas}</dd>
              </dl>
              <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
                <button onClick={() => descargarCertificado(certificado)}>Descargar certificado</button>
                <button className="secundario" onClick={() => cambiarModo("verificar")}>Verificar este documento</button>
              </div>
            </div>
          )}

          {modo === "verificar" && verificacion && (
            verificacion.registrado ? (
              <div className="resultado ok">
                <h2>Documento registrado</h2>
                <dl>
                  <dt>Registrado por</dt><dd>{verificacion.autor}</dd>
                  <dt>Fecha y hora</dt><dd>{fecha(verificacion.timestamp)}</dd>
                  {verificacion.bloque && <><dt>Bloque</dt><dd>{verificacion.bloque}</dd></>}
                  {verificacion.tx && red.explorador && (
                    <><dt>Transacción</dt><dd><a href={`${red.explorador}/tx/${verificacion.tx}`} target="_blank" rel="noreferrer">{corta(verificacion.tx, 10)}</a></dd></>
                  )}
                </dl>
              </div>
            ) : (
              <div className="resultado nulo">
                <h2>Sin registro</h2>
                <p>Ningún documento con esta huella exacta ha sido registrado. Si el archivo fue modificado, aunque sea en un carácter, su huella cambia y no coincidirá con el original.</p>
              </div>
            )
          )}

          {!certificado && !verificacion && (
            <ol className="pasos">
              {modo === "registrar" ? (
                <>
                  <li>Conecta tu wallet MetaMask.</li>
                  <li>Elige el documento. Su huella se calcula en tu equipo.</li>
                  <li>Firma la transacción. En unos segundos queda registrada con fecha y hora.</li>
                  <li>Descarga tu certificado y conserva el archivo original.</li>
                </>
              ) : (
                <>
                  <li>Elige el documento que quieres comprobar.</li>
                  <li>La plataforma calcula su huella y la busca en el contrato.</li>
                  <li>Si existe, verás qué wallet lo registró y cuándo. La consulta no cuesta gas.</li>
                </>
              )}
            </ol>
          )}
        </aside>
      </main>

      <footer className="pie tenue pequeno">
        Contrato {info.address ? corta(info.address) : "sin desplegar"} · {red.nombre}
      </footer>
    </div>
  );
}
