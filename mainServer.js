// server.js
// require("dotenv").config();

const express = require("express");
const cors = require("cors");

const app = express();
const PORT = process.env.PORT || 5000;

// Middleware
app.use(cors());
app.use(express.json());

// require("./utils/chatMapping");
// require("./utils/telegramNotifier");

// Import routes wash reasoninng and backend
// Mount Wash routes
const reasonerWash = require("./routes/reasonerWash");
const backendWash = require("./routes/backendWash");
// const teleNotifWash = require("./routes/teleNotifWash");
app.use(reasonerWash);
app.use(backendWash);
// app.use(teleNotifWash);

// Import routes inout reasoninng and backend
// Mount cook routes
const reasonerInout = require("./routes/reasonerInout");
const backendInout = require("./routes/backendInout");
// const teleNotifInout = require("./routes/teleNotifInout");
app.use(reasonerInout);
app.use(backendInout);
// app.use(teleNotifInout);

// Import routes cook reasoninng and backend
// Mount Inout routes
const reasonerCook = require("./routes/reasonerCook");
const backendCook = require("./routes/backendCook");
// const teleNotifCook = require("./routes/teleNotifCook");
app.use(reasonerCook);
app.use(backendCook);
// app.use(teleNotifCook);

// system status
const systemStatusRoute = require("./backendSystemStatus");
app.use(systemStatusRoute);

// tele bot
const { initNotifier } = require("./bot/telegramNotifier");
const bot = require("./bot/telegramBot");
initNotifier(bot);

const { initCommandHandler } = require("./bot/commandHandler");
initCommandHandler();

// Root test endpoint
app.get("/", (req, res) => {
  res.send("✅ Thesis System Running — Reasoner + Backend aktif");
});

// Jalankan server
app.listen(PORT, () => {
  console.log(`🚀 Server utama berjalan di port ${PORT}`);
});
