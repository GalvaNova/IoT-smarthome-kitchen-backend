// routes/backendWash.js (FINAL FIXED VERSION ✅)

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const logger = require("../utils/loggerWash");

// telegramBot.js
const telegramNotifier = require("../bot/telegramNotifier");
const bot = require("../bot/telegramBot");
telegramNotifier.initNotifier(bot);

// log activity
const activityLogger = require("../utils/activityLoggerWash");

// ===============================
// Konfigurasi Fuseki & Reasoner
// ===============================
const FUSEKI_QUERY = "http://192.168.43.238:3030/areaWash-2/query";

let lastUpdateTimeWash = Date.now();

// ===============================
// Variabel Global
// ===============================
let reasoningTimeGlobal = 0;
let endToEndTimeGlobal = 0;
let prevValveStatus = "st_actOFF";

let washStartTime = null;
let washStartTimestamp = null;

let latestData = {
  timestamp_backend: new Date().toISOString(),
  timestamp_reasoner: "-",
  timestamp_iot: "-",
  jarakObjek: 0,
  jarakOrang: 0,
  valveStatus: "st_actOFF",
  washingStatus: "st_washNO",
  reasoningTime: 0,
  backendTime: 0,
  endToEndTime: 0,
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
// API dari Reasoner
// ===============================
router.post("/api/backendwash/reasoningtime", (req, res) => {
  const { reasoningTime, timestamp_reasoner, timestamp_iot } = req.body;
  reasoningTimeGlobal = Number(reasoningTime) || 0;
  latestData.timestamp_reasoner = timestamp_reasoner || "-";
  latestData.timestamp_iot = timestamp_iot || "-";
  res.json({ message: "✅ Reasoning time & timestamps updated" });
});

router.post("/api/backendwash/endtoendtime", (req, res) => {
  const { endToEndTime } = req.body;
  endToEndTimeGlobal = Number(endToEndTime) || 0;
  res.json({ message: "✅ End-to-end time updated" });
});

// ===============================
// LOOP: Ambil Data Fuseki Tiap 2 Detik
// ===============================
async function loopFetch() {
  const start = Date.now();
  try {
    const query = `
      PREFIX tb: <http://www.semanticweb.org/msi/ontologies/2025/5/thesis-1#>
      SELECT ?distObj ?distOrang ?valveStatus ?washingStatus WHERE {
        OPTIONAL { tb:param_objek tb:ASdp_hasDISTOBJvalue ?distObj }
        OPTIONAL { tb:param_orang tb:ASdp_hasDISTPERvalue ?distOrang }
        OPTIONAL { tb:act_AS_Valve tb:M_hasActionStatus ?valveStatus }
        OPTIONAL { tb:fnc_washAct tb:M_hasActivityStatus ?washingStatus }
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
    const jarakObjek = parseFloat(b.distObj?.value || 0);
    const jarakOrang = parseFloat(b.distOrang?.value || 0);
    const valveStatus = b.valveStatus?.value?.split("#")[1] || "st_actOFF";
    const washingStatus = b.washingStatus?.value?.split("#")[1] || "st_washNO";

    const backendTime = Date.now() - start;

    // Update global data
    latestData = {
      timestamp_backend: getFormattedTimestamp(),
      timestamp_reasoner: latestData.timestamp_reasoner,
      timestamp_iot: latestData.timestamp_iot,
      jarakObjek,
      jarakOrang,
      valveStatus,
      washingStatus,
      reasoningTime: reasoningTimeGlobal,
      backendTime,
      endToEndTime: endToEndTimeGlobal,
    };

    // lastUpdateTimeWash = Date.now();
    if (latestData.timestamp_iot !== "-") {
      global.lastUpdateTimeWash = Date.now();
    }

    // ===============================
    // 🧼 Hitung Durasi Washing
    // ===============================
    if (washingStatus === "st_washYES" && !washStartTime) {
      washStartTime = Date.now();
      washStartTimestamp = getFormattedTimestamp();
      console.log(`🧼 Washing dimulai pada ${washStartTimestamp}`);
    }

    if (washingStatus === "st_washNO" && washStartTime) {
      const washEndTime = Date.now();
      const washEndTimestamp = getFormattedTimestamp();
      const washDuration = (washEndTime - washStartTime) / 1000; // detik

      console.log(
        `🧽 Washing selesai — durasi: ${washDuration.toFixed(2)} detik`
      );

      // Simpan log aktivitas
      await activityLogger.writeActivityLog(
        washStartTimestamp,
        washEndTimestamp,
        washDuration
      );

      // Reset state
      washStartTime = null;
      washStartTimestamp = null;

      // Kirim notifikasi Telegram
      await telegramNotifier.sendMessage(
        `🧽 Washing selesai\nDurasi: ${washDuration.toFixed(2)} detik`
      );
    }

    // Tulis log CSV
    await logger.writeLog(latestData);

    // Kirim notifikasi hanya saat status berubah
    if (valveStatus !== prevValveStatus) {
      if (valveStatus === "st_actON") {
        await telegramNotifier.sendMessage(
          `🚰 VALVE AKTIF\nAktivitas: ${
            washingStatus === "st_washYES"
              ? "Sedang mencuci 🧼"
              : "Tidak mencuci 🚫"
          }\nJarak Objek: ${jarakObjek.toFixed(
            2
          )} cm\nJarak Orang: ${jarakOrang.toFixed(
            2
          )} cm\nWaktu: ${new Date().toLocaleString("id-ID")}`
        );
      }
      prevValveStatus = valveStatus;
    }
  } catch (err) {
    console.error("❌ Error loop areaWash:", err.message);
  } finally {
    setTimeout(loopFetch, 2000);
  }
}

loopFetch();

// ===============================
// Endpoint: kirim data log JSON
// ===============================
router.get("/api/wash/log/data", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(__dirname, "../logs/wash", `washlog_${today}.csv`);

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
// Endpoint Monitoring Terbaru
// ===============================
router.get("/api/wash/latest", (req, res) => {
  res.json(latestData);
});

// ===============================
// Endpoint Unduh Log Harian
// ===============================
router.get("/api/wash/log/download", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const logFile = path.join(__dirname, "../logs/wash", `washlog_${today}.csv`);

  if (!fs.existsSync(logFile)) {
    return res
      .status(404)
      .json({ error: "File log belum tersedia untuk hari ini" });
  }

  res.download(logFile, `washlog_${today}.csv`);
});

// ===============================
// 📘 Tambahan: Endpoint Activity Log
// ===============================
router.get("/api/wash/activity/data", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const activityFile = path.join(
    __dirname,
    "../logs/wash/activity",
    `wash_activity_${today}.csv`
  );

  if (!fs.existsSync(activityFile)) {
    return res
      .status(404)
      .json({ error: "Belum ada aktivitas washing hari ini" });
  }

  try {
    const csvData = fs.readFileSync(activityFile, "utf8");
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
    res.status(500).json({ error: "Gagal membaca log aktivitas" });
  }
});

// Unduh file aktivitas washing
router.get("/api/wash/activity/download", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const activityFile = path.join(
    __dirname,
    "../logs/wash/activity",
    `wash_activity_${today}.csv`
  );

  if (!fs.existsSync(activityFile)) {
    return res.status(404).json({ error: "Belum ada log aktivitas hari ini" });
  }

  res.download(activityFile, `wash_activity_${today}.csv`);
});

module.exports = router;
