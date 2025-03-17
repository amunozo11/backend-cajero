const mongoose = require("mongoose");

const CuentaSchema = new mongoose.Schema({
  nombre: String,
  numero: { type: String, unique: true },
  numeroTarjeta: { type: String, unique: true, sparse: true },
  cedula: String,
  telefono: { type: String, required: function () { return this.tipo !== "tarjeta"; } },
  monto: { type: Number, required: true, min: 0 },
  fechaNacimiento: String,
  fechaCreacion: { type: Date, default: Date.now },
  fechaVencimiento: { type: String, sparse: true },
  tipo: { type: String, enum: ["nequi", "bancolombia", "tarjeta"] },
  clave: { type: String, required: true },
  cvv: { type: String, sparse: true },
  codigosRetiros: [
    {
      codigo: String,
      expira: Date,
    },
  ],
  transacciones: [
    {
      type: { type: String, enum: ["Depósito", "Retiro", "Transferencia"], required: true },
      amount: { type: Number, required: true },
      date: { type: Date, default: Date.now },
      status: { type: String, default: "Completado" },
      // Puedes incluir otros campos como descripción, destino, etc.
    },
  ],
});

// Función para generar un número de tarjeta válido
function generarNumeroTarjeta() {
  const prefijos = ["4", "5"]; // 4 para Visa, 5 para Mastercard
  let numero = prefijos[Math.floor(Math.random() * prefijos.length)];

  for (let i = 0; i < 15; i++) {
    numero += Math.floor(Math.random() * 10);
  }

  return numero;
}

// Función para generar CVV (3 dígitos)
function generarCVV() {
  return Math.floor(100 + Math.random() * 900).toString();
}

// Función para calcular fecha de vencimiento (4 años después)
function calcularFechaVencimiento() {
  const hoy = new Date();
  const anio = hoy.getFullYear() + 4;
  const mes = String(hoy.getMonth() + 1).padStart(2, "0");
  return `${mes}/${anio}`;
}

const Cuenta = mongoose.model("Cuenta", CuentaSchema);

module.exports = { Cuenta, generarNumeroTarjeta, generarCVV, calcularFechaVencimiento };
