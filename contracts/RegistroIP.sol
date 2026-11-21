// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/// @title RegistroIP - Registro de propiedad intelectual académica
/// @notice Guarda la huella SHA-256 de un documento junto con su autor y la fecha de registro.
///         El documento nunca se sube a la blockchain: solo su hash.
contract RegistroIP {
    struct Documento {
        address autor;      // Wallet que registró el documento
        uint256 timestamp;  // Fecha/hora del bloque (Unix)
        bool registrado;    // true si el hash ya existe
    }

    /// hash SHA-256 del documento => datos del registro
    mapping(bytes32 => Documento) private documentos;

    /// Se emite en cada registro. hash y autor van indexados para poder
    /// buscar en los logs "qué registró esta wallet" o "quién registró este hash".
    event DocumentoRegistrado(bytes32 indexed hash, address indexed autor, uint256 timestamp);

    /// @notice Registra la huella de un documento. Falla si está vacía o si ya existe.
    function registrarDocumento(bytes32 hash) external {
        require(hash != bytes32(0), "Hash vacio");
        require(!documentos[hash].registrado, "Documento ya registrado");

        documentos[hash] = Documento(msg.sender, block.timestamp, true);
        emit DocumentoRegistrado(hash, msg.sender, block.timestamp);
    }

    /// @notice Consulta pública y gratuita (view): quién registró el hash y cuándo.
    function verificarDocumento(bytes32 hash)
        external
        view
        returns (address autor, uint256 timestamp, bool registrado)
    {
        Documento memory d = documentos[hash];
        return (d.autor, d.timestamp, d.registrado);
    }
}
