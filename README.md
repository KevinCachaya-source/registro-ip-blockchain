# Registro de Propiedad Intelectual Académica en Blockchain

Prototipo del semillero de investigación (Universidad Libre) — Juan Roncancio y Kevin Cachaya.

La plataforma calcula la huella SHA-256 de un documento académico **en el equipo del usuario** y la registra en un contrato inteligente de Ethereum junto con la wallet del autor y la fecha y hora del bloque. El documento nunca se sube a ningún servidor ni a la blockchain.

```
registro-ip/
├── contracts/RegistroIP.sol      Capa blockchain: contrato inteligente
├── test/RegistroIP.test.js       Capa testing: 5 pruebas con Chai + Mocha
├── scripts/deploy.js             Despliega y copia dirección + ABI al frontend
├── scripts/registrar.js          Registro desde la terminal (plan B de la demo)
├── backend/hashModule.js         Capa backend: SHA-256 con streams (Node.js)
├── backend/hash.js               CLI: node backend/hash.js archivo.pdf
├── backend/hashModule.test.js    Pruebas del módulo de hashing
└── frontend/                     Capa frontend: React + Ethers v6 + MetaMask + Web Crypto API
```

## 1. Requisitos

- Node.js 20 LTS o superior
- Navegador Chrome, Brave o Firefox con la extensión **MetaMask**
- Para Sepolia: una cuenta gratuita en [Alchemy](https://www.alchemy.com) e ETH de prueba de un faucet de Sepolia

## 2. Instalación

```bash
npm install                 # en la carpeta raíz (Hardhat)
cd frontend && npm install  # en la carpeta del frontend
```

## 3. Pruebas

```bash
npm test          # 5 pruebas del contrato
npm run test:gas  # las mismas pruebas + tabla de gas real por función
npm run test:hash # 5 pruebas del módulo de hashing (incluye un archivo de 200 MB)
```

Guarden una captura de la salida de `npm test` y de `npm run test:gas`: son la evidencia de las diapositivas de pruebas y de costos.

## 4. Despliegue

### Opción A — Red local (recomendada para ensayar y como respaldo)

```bash
# Terminal 1: deja corriendo una blockchain local con 20 cuentas con ETH ficticio
npm run node

# Terminal 2
npm run deploy:local
cd frontend && npm run dev
```

El despliegue escribe automáticamente en `frontend/src/contract.json` la dirección del contrato y el `chainId` `31337`.

En MetaMask: *Agregar red manualmente* → Nombre `Hardhat`, RPC `http://127.0.0.1:8545`, Chain ID `31337`, símbolo `ETH`. Luego *Importar cuenta* con una de las claves privadas que imprime `npm run node` (son públicas y solo sirven en local).

> Si reinicias `npm run node`, en MetaMask ve a *Configuración → Avanzado → Borrar datos de actividad* o las transacciones fallarán por el nonce.

### Opción B — Red pública Sepolia (la que se reporta en el artículo)

1. Copia `.env.example` como `.env` y completa `SEPOLIA_RPC_URL` y `PRIVATE_KEY` (usa una wallet **solo de pruebas**; nunca subas el `.env` a GitHub).
2. Consigue ETH de prueba en un faucet de Sepolia (basta con 0,05 ETH).
3. Despliega:
   ```bash
   npm run deploy:sepolia
   ```
   La consola imprime la dirección del contrato y el enlace a Sepolia Etherscan. **Esa es la dirección real que debe ir en el artículo y en la presentación.**
4. (Opcional) Verifica el código fuente en Etherscan:
   ```bash
   npx hardhat verify --network sepolia DIRECCION_DEL_CONTRATO
   ```
5. `cd frontend && npm run dev` y en MetaMask selecciona la red Sepolia.

## 5. Guion de la demo en vivo (≈ 5 minutos)

Preparen antes: dos archivos, `tesis_demo.pdf` y una copia `tesis_demo_modificada.pdf` donde solo cambien una letra. El frontend ya abierto, MetaMask desbloqueado y en la red correcta.

| Paso | Qué hacer | Qué decir |
|---|---|---|
| 1 | Clic en **Conectar MetaMask** | "La identidad del autor es su wallet; no hay usuario ni contraseña en un servidor." |
| 2 | Arrastrar `tesis_demo.pdf` | "La huella se calcula aquí, en el navegador. El PDF no sale del computador." |
| 3 | Señalar la huella | "Estos 64 caracteres son lo único que va a la blockchain. No se puede reconstruir la tesis a partir de ellos." |
| 4 | **Registrar en la blockchain** → confirmar en MetaMask | "MetaMask nos muestra el costo en gas. Firmamos." |
| 5 | Esperar la confirmación (~12 s en Sepolia, instantáneo en local) y abrir el enlace a Etherscan | "Cualquier persona en el mundo puede ver este registro con su fecha y hora." |
| 6 | **Descargar certificado** y abrirlo | "Este es el comprobante para el autor." |
| 7 | Volver a registrar el mismo archivo | "El contrato bloquea duplicados: nadie puede registrarlo otra vez, ni siquiera desde otra wallet." |
| 8 | Pestaña **Verificar autoría** → subir `tesis_demo.pdf` | "Un jurado o editor comprueba la autoría sin pagar gas." |
| 9 | Subir `tesis_demo_modificada.pdf` | "Cambiamos una sola letra y la huella es totalmente distinta: el sistema detecta cualquier alteración." |

### Plan B (si falla internet, Sepolia o MetaMask)

1. Usar la red local (sección 4, opción A): no depende de internet.
2. Si falla el navegador, registrar desde la terminal:
   ```bash
   ARCHIVO=tesis_demo.pdf npx hardhat run scripts/registrar.js --network localhost
   ```
3. Tener grabado un video corto de la demo funcionando y capturas de cada paso.

## 6. Contrato desplegado

| Dato | Valor |
|---|---|
| Red | Ethereum Sepolia (Chain ID 11155111) |
| Dirección del contrato | [`0xa87F17Fe9AD2C93D662130F0Cd264EebE700366c`](https://sepolia.etherscan.io/address/0xa87F17Fe9AD2C93D662130F0Cd264EebE700366c) |
| Bloque de despliegue | 11.921.267 |
| Gas del despliegue | 1.135.623 |
| Pruebas | 5/5 del contrato (`npm test`) y 5/5 del módulo de huellas (`npm run test:hash`) |

El archivo `frontend/src/contract.json` ya apunta a este contrato, así que la interfaz funciona con él sin desplegar de nuevo.

> En Windows (PowerShell), para ver el gas de cada función usa `$env:REPORT_GAS="true"; npx hardhat test` en lugar de `npm run test:gas`.

## 7. Limitaciones conocidas

- La identidad es una wallet, no una persona verificada.
- Quien obtenga el documento antes que el autor podría registrarlo primero. Además, una transacción pendiente es visible en la red antes de confirmarse; un esquema *commit–reveal* lo mitigaría (trabajo futuro).
- La Web Crypto API carga el archivo completo en memoria del navegador; para archivos de varios GB conviene usar el módulo de backend con streams.
- El registro no tiene hoy reconocimiento legal explícito ante la DNDA; sirve como evidencia digital de fecha cierta.
