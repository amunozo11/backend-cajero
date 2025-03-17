const express = require("express");
const router = express.Router();
const { Cuenta, generarNumeroTarjeta, generarCVV, calcularFechaVencimiento } = require("../models/Cuenta");

const BILLETES = [100000, 50000, 20000, 10000];

const calcularBilletesConAcarreo = (monto) => {
  let billetesEntregados = { 100000: 0, 50000: 0, 20000: 0, 10000: 0 };
  let posicion = BILLETES.length - 1;

  while (monto > 0) {
    let billete = BILLETES[posicion];
    let index = posicion;

    while (index >= 0 && billete <= monto && monto > 0) {
      billetesEntregados[billete]++;
      monto -= billete;
      billete = BILLETES[--index < 0 ? BILLETES.length - 1 : index];
    }

    posicion = --posicion < 0 ? BILLETES.length - 1 : posicion;
  }

  return { billetes: billetesEntregados };
};

// Ruta para procesar un retiro
router.post("/", async (req, res) => {
  // Para todos los métodos, se requiere que el monto sea un múltiplo de 10.000 y no inferior a 10.000
  const { numero, codigo, monto, clave } = req.body;

  if (monto < 10000 || monto % 10000 !== 0) {
    return res.status(400).json({ message: "El monto a retirar debe ser un múltiplo de 10.000" });
  }

  try {
    const cuenta = await Cuenta.findOne({ numero });
    if (!cuenta) {
      return res.status(404).json({ message: "Cuenta no encontrada" });
    }

    // Si la cuenta es de tipo "tarjeta", validamos la clave; en otro caso, validamos el código de retiro
    if (cuenta.tipo === "tarjeta") {
      if (!clave) {
        return res.status(400).json({ message: "La clave es obligatoria para retirar con tarjeta" });
      }
      if (cuenta.clave !== clave) {
        return res.status(401).json({ message: "Clave incorrecta" });
      }
    } else {
      if (!codigo) {
        return res.status(400).json({ message: "El código de retiro es obligatorio" });
      }
      const codigoValido = cuenta.codigosRetiros.find(
        (c) => c.codigo === codigo && new Date(c.expira) > new Date()
      );
      if (!codigoValido) {
        return res.status(400).json({ message: "Código de retiro inválido o expirado" });
      }
      // Eliminamos el código usado
      cuenta.codigosRetiros = cuenta.codigosRetiros.filter((c) => c.codigo !== codigo);
    }

    if (cuenta.monto < monto) {
      return res.status(400).json({ message: "Saldo insuficiente" });
    }

    // Calcular billetes entregados
    let billetes = calcularBilletesConAcarreo(monto);
    if (!billetes) {
      return res.status(400).json({
        message: "No se puede entregar el monto exacto con los billetes disponibles.",
      });
    }

    // Registrar la transacción de retiro
    cuenta.transacciones.push({
      type: "Retiro",
      amount: monto,
      status: "Completado",
    });

    // Restar el monto
    cuenta.monto -= monto;
    await cuenta.save();

    res.json({
      message: "Retiro exitoso",
      numero: cuenta.numero,
      nuevoSaldo: cuenta.monto,
      billetesEntregados: billetes,
    });
  } catch (error) {
    console.error(error);
    res.status(500).json({ message: "Error al procesar el retiro", error });
  }
});

module.exports = router;
