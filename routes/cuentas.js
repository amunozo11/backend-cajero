const express = require("express");
const router = express.Router();
const jwt = require("jsonwebtoken");
const { Cuenta, generarNumeroTarjeta, generarCVV, calcularFechaVencimiento } = require("../models/Cuenta");

const SECRET_KEY = "mi_clave_secreta";

router.post("/", async (req, res) => {
  try {
    const { nombre, cedula, telefono, monto, fechaNacimiento, clave, tipo } = req.body;

    if (!nombre || !cedula || !fechaNacimiento || !tipo) {
      return res.status(400).json({ message: "Todos los campos son obligatorios" });
    }

    if (tipo !== "tarjeta" && (!telefono || telefono.length !== 10)) {
      return res.status(400).json({ message: "El teléfono debe tener 10 dígitos" });
    }

    if (!clave || clave.length !== 4 || isNaN(clave)) {
      return res.status(400).json({ message: "La clave debe ser un número de 4 dígitos" });
    }

    if (isNaN(monto) || monto < 0) {
      return res.status(400).json({ message: "El monto inicial debe ser un número positivo" });
    }

    const cuenta = new Cuenta({
      nombre,
      cedula,
      telefono: tipo !== "tarjeta" ? telefono : undefined,
      monto,
      fechaNacimiento,
      clave,
      tipo,
      numero: tipo !== "tarjeta" ? (tipo === "nequi" ? "0" : "1") + telefono : undefined,
    });

    // Si es tarjeta, generamos datos especiales
    if (tipo === "tarjeta") {
      cuenta.numeroTarjeta = generarNumeroTarjeta();
      cuenta.numero = cuenta.numeroTarjeta;
      cuenta.cvv = generarCVV();
      cuenta.fechaVencimiento = calcularFechaVencimiento();
    }

    await cuenta.save();
    res.status(201).json({ message: "Cuenta creada con éxito", cuenta });

  } catch (error) {
    console.error("❌ Error al crear cuenta:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { telefono, clave, tipo } = req.body;

    if (!telefono || !clave) {
      return res.status(400).json({ message: "Teléfono y clave son obligatorios" });
    }

    let numeroCuenta;
    if (tipo === "bancolombia") {
      numeroCuenta = "1" + telefono;
    } else if (tipo === "nequi") {
      numeroCuenta = "0" + telefono;
    } else if (tipo === "tarjeta") {
      numeroCuenta = req.body.numero; // Sin prefijo para tarjetas
    } else {
      return res.status(400).json({ message: "Tipo de cuenta inválido" });
    }

    const cuenta = await Cuenta.findOne({ numero: numeroCuenta });
    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    if (cuenta.clave !== clave) {
      return res.status(401).json({ message: "Clave incorrecta" });
    }

    // Generamos un token JWT que expira en 24 horas
    const token = jwt.sign({ id: cuenta._id }, SECRET_KEY, { expiresIn: 86400 });

    res.status(200).json({
      message: "Inicio de sesión exitoso",
      token,
      cuenta: {
        nombre: cuenta.nombre,
        numero: cuenta.numero,
        monto: cuenta.monto,
        tipo: cuenta.tipo,
      },
    });
  } catch (error) {
    console.error("❌ Error en el inicio de sesión:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

// Verificar token
function verifyToken(req, res, next) {
  let token = req.headers["authorization"];
  if (!token) {
    return res.status(401).json({ message: "No token provided." });
  }
  // Se asume el formato "Bearer <token>"
  if (token.startsWith("Bearer ")) {
    token = token.slice(7).trim();
  }
  jwt.verify(token, SECRET_KEY, (err, decoded) => {
    if (err) {
      return res.status(401).json({ message: "Failed to authenticate token." });
    }
    req.userId = decoded.id;
    next();
  });
}

// Obtener perfil
router.get("/profile", verifyToken, async (req, res) => {
  try {
    const cuenta = await Cuenta.findById(req.userId).select("-clave"); // excluimos la clave
    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }
    res.status(200).json({ cuenta });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

// Ruta para obtener los datos de una cuenta a partir del número
router.get("/:numero", async (req, res) => {
  try {
    const { numero } = req.params;
    const cuenta = await Cuenta.findOne({ numero });
    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }
    res.status(200).json({ cuenta });
  } catch (error) {
    console.error("Error al obtener la cuenta:", error);
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

// Ruta para obtener transacciones (filtrando retiros)
router.get("/transactions", verifyToken, async (req, res) => {
  try {
    const cuenta = await Cuenta.findById(req.userId).select("transacciones");
    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }
    // Si solo te interesan los retiros:
    const retiros = cuenta.transacciones.filter(tx => tx.type === "Retiro");
    res.status(200).json({ transactions: retiros });
  } catch (error) {
    res.status(500).json({ message: "Error interno del servidor", error: error.message });
  }
});

// Ruta para generar un código de retiro
router.post("/generar-codigo", async (req, res) => {
  const { numero, clave } = req.body;

  try {
    const cuenta = await Cuenta.findOne({ numero });

    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    if (cuenta.clave !== clave) {
      return res.status(401).json({ message: "Clave incorrecta" });
    }

    // Generar código de retiro de 6 dígitos
    const codigo = Math.floor(100000 + Math.random() * 900000).toString();
    const expira = new Date(Date.now() + 30 * 60000); // Expira en 30 minutos

    cuenta.codigosRetiros.push({ codigo, expira });
    await cuenta.save();

    res.json({ message: "Código generado con éxito", codigo });
  } catch (error) {
    res.status(500).json({ message: "Error al generar el código", error });
  }
});

module.exports = router;
