// routes/backendInout.js (FINAL VERSION)

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const logger = require("../utils/loggerInout");
// const telegramNotifier = require("../utils/telegramNotifierInout");
const TELEGRAM_COOLDOWN = 10000; // ms

// API base
const API = "url";

// ===============================
// 🔧 Konfigurasi Fuseki & Reasoner
// ===============================

const FUSEKI_QUERY = `${API}:3030/areaInout-2/query`;

let lastUpdateTimeInout = Date.now();

// ===============================
// 🌐 Variabel Global
// ===============================
let reasoningTimeGlobal = 0;
let endToEndTimeGlobal = 0;
let prevLampStatus = "st_actOFF";
let lastTelegramTime = 0;

let latestData = {
  timestamp_backend_inout: new Date().toISOString(),
  timestamp_reasoner_inout: "-",
  timestamp_iot_inout: "-",
  personCount: 0,
  lampStatus: "st_actOFF",
  reasoningTime: 0,
  backendTime: 0,
  endToEndTime: 0,
  responseTime: 0,
};

//format waktu kustom: YYYY-MM-DD:hh-mm-ss
function getFormattedTimestamp() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const DD = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}:${hh}-${mm}-${ss}`;
}

// ===============================
// API Reasoner
// ===============================
router.post("/api/backendinout/reasoningtime", (req, res) => {
  const { reasoningTime, timestamp_reasoner_inout, timestamp_iot_inout } =
    req.body;
  reasoningTimeGlobal = Number(reasoningTime) || 0;
  latestData.timestamp_reasoner_inout = timestamp_reasoner_inout || "-";
  latestData.timestamp_iot_inout = timestamp_iot_inout || "-";
  res.json({ message: "✅ Reasoning time & timestamps updated" });
});

router.post("/api/backendinout/endtoendtime", (req, res) => {
  const { endToEndTime } = req.body;
  endToEndTimeGlobal = Number(endToEndTime) || 0;
  res.json({ message: "✅ End-to-end time updated" });
});

// ===============================
// LOOP: Ambil data dari Fuseki setiap 2 detik
// ===============================
async function loopFetch() {
  const start = Date.now();

  try {
    const query = `
      PREFIX tb: <http://www.semanticweb.org/msi/ontologies/2025/5/thesis-1#>
      SELECT ?personVal ?lampStatus WHERE {
        OPTIONAL { tb:param_person tb:ASdp_hasPERSONvalue ?personVal }
        OPTIONAL { tb:act_AS_Lamp tb:M_hasActionStatus ?lampStatus }
        
      } LIMIT 1
    `;

    const response = await axios.get(
      `${FUSEKI_QUERY}?query=${encodeURIComponent(query)}`,
      {
        headers: { Accept: "application/sparql-results+json" },
        timeout: 4000,
      }
    );

    const b = response.data.results.bindings[0] || {};
    const personCount = parseInt(b.personVal?.value || 0);
    const lampStatus = b.lampStatus?.value?.split("#")[1] || "st_actOFF";

    const backendTime = Date.now() - start;

    // Simpan data terbaru
    latestData = {
      timestamp_backend_inout: getFormattedTimestamp(),
      timestamp_reasoner_inout: latestData.timestamp_reasoner_inout,
      timestamp_iot_inout: latestData.timestamp_iot_inout,
      personCount,
      lampStatus,
      reasoningTime: reasoningTimeGlobal,
      backendTime,
      endToEndTime: endToEndTimeGlobal,
      responseTime: backendTime,
    };

    // lastUpdateTimeInout = Date.now();
    if (latestData.timestamp_iot_inout !== "-") {
      global.lastUpdateTimeInout = Date.now();
    }

    // Simpan ke log CSV
    await logger.writeLog(latestData);

    // Kirim notifikasi Telegram jika lampu aktif
    // if (lampStatus !== prevLampStatus) {
    //   const now = Date.now();
    //   if (now - lastTelegramTime > TELEGRAM_COOLDOWN) {
    //     const msg =
    //       lampStatus === "st_actON"
    //         ? `💡 LAMPU HIDUP\nJumlah Orang: ${personCount}\nWaktu: ${new Date().toLocaleString(
    //             "id-ID"
    //           )}`
    //         : `💡 LAMPU MATI\nJumlah Orang: ${personCount}\nWaktu: ${new Date().toLocaleString(
    //             "id-ID"
    //           )}`;
    //     await telegramNotifier.sendMessage(msg);
    //     lastTelegramTime = now;
    //   }
    //   prevLampStatus = lampStatus;
    // }
  } catch (err) {
    console.error("❌ Error loop areaInout:", err.message);
    latestData.lampStatus = "st_actOFF";
  } finally {
    setTimeout(loopFetch, 2000);
  }
}

loopFetch();

// ===============================
// 📊 Endpoint: Data log JSON
// ===============================
router.get("/api/inout/log/data", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(
    __dirname,
    "../logs/inout",
    `inoutlog_${today}.csv`
  );

  if (!fs.existsSync(logFile)) {
    return res
      .status(404)
      .json({ error: "File log belum tersedia untuk hari ini" });
  }

  try {
    const csvData = fs.readFileSync(logFile, "utf8");
    const lines = csvData.trim().split("\n");
    const headers = lines.shift().split(",");

    const jsonData = lines.map((line) => {
      const values = line.split(",");
      const obj = {};
      headers.forEach((header, i) => {
        obj[header.trim()] = values[i]?.trim() || "";
      });
      return obj;
    });

    res.json(jsonData);
  } catch (err) {
    res.status(500).json({ error: "Gagal membaca file log" });
  }
});

// ===============================
// 🛰️ Endpoint: Data terbaru monitoring
// ===============================
router.get("/api/inout/latest", (req, res) => {
  res.json(latestData);
});

// ===============================
// 📥 Endpoint: Unduh log harian CSV
// ===============================
router.get("/api/inout/log/download", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(
    __dirname,
    "../logs/inout",
    `inoutlog_${today}.csv`
  );

  if (!fs.existsSync(logFile)) {
    return res
      .status(404)
      .json({ error: "File log belum tersedia untuk hari ini" });
  }

  res.download(logFile, `inoutlog_${today}.csv`);
});

module.exports = router;
