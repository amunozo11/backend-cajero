require("dotenv").config();
const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const retirosRouter = require("./routes/retiros");

const app = express();
const PORT = process.env.PORT || 5000;

app.use(express.json());
app.use(cors());

app.use("/api/cuentas", require("./routes/cuentas"));
app.use("/api/retiros", retirosRouter);

mongoose
  .connect(process.env.MONGO_URI, { useNewUrlParser: true, useUnifiedTopology: true })
  .then(() => console.log("📦 Conectado a MongoDB Atlas"))
  .catch((err) => console.log(err));

app.listen(PORT, () => console.log(`🚀 Servidor corriendo en el puerto ${PORT}`));
