// routes/backendCook.js (FINAL VERSION + Cooking Activity)

const express = require("express");
const axios = require("axios");
const fs = require("fs");
const path = require("path");
const router = express.Router();

const logger = require("../utils/loggerCook");

// telegramBot.js
const telegramNotifier = require("../bot/telegramNotifier");
const bot = require("../bot/telegramBot");
telegramNotifier.initNotifier(bot);

// log activity
const activityLogger = require("../utils/activityLoggerCook");

const API = "url";

// ===============================
// 🔧 Konfigurasi Fuseki & Reasoner
// ===============================
const FUSEKI_QUERY = `http://${API}:3030/areaCook-2/query`;

let lastUpdateTimeCook = Date.now();

// ===============================
// 🌐 Variabel Global
// ===============================
let reasoningTimeGlobal = 0;
let endToEndTimeGlobal = 0;

// actuator
let prevExhaustStatus = "st_actOFF";
let prevBuzzerStatus = "st_actOFF";
let prevCookingStatus = "st_cookNO";

let prevGas = 200;

// activity cooking
let cookStartTime = null;
let cookStartTimestamp = null;

// latest data
let latestData = {
  timestamp_backend_cook: new Date().toISOString(),
  timestamp_reasoner_cook: "-",
  timestamp_iot_cook: "-",
  temp: 0,
  flame: 1,
  gas: 0,
  distance: 0,
  buzzerStatus: "st_actOFF",
  exhaustStatus: "st_actOFF",
  cookingStatus: "st_cookNO",
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
// Endpoint: Reasoning Time & End-to-End Time
// ===============================
router.post("/api/backendcook/reasoningtime", (req, res) => {
  const { reasoningTime, timestamp_reasoner_cook, timestamp_iot_cook } =
    req.body;
  reasoningTimeGlobal = Number(reasoningTime) || 0;
  latestData.timestamp_reasoner_cook = timestamp_reasoner_cook || "-";
  latestData.timestamp_iot_cook = timestamp_iot_cook || "-";
  res.json({ message: "✅ Reasoning time & timestamps updated" });
});

router.post("/api/backendcook/endtoendtime", (req, res) => {
  const { endToEndTime } = req.body;
  endToEndTimeGlobal = Number(endToEndTime) || 0;
  res.json({ message: "✅ End-to-end time updated" });
});

// ===============================
// 🔁 LOOP: Ambil data dari Fuseki tiap 2 detik
// ===============================
async function loopFetch() {
  const start = Date.now();

  try {
    const query = `
      PREFIX tb: <http://www.semanticweb.org/msi/ontologies/2025/5/thesis-1#>
      SELECT ?flameVal ?gasVal ?tempVal ?distVal ?buzzerStatus ?exhaustStatus ?cookingStatus WHERE {
        OPTIONAL { tb:param_flame tb:ASdp_hasFLAMEvalue ?flameVal }
        OPTIONAL { tb:param_gas tb:ASdp_hasGASvalue ?gasVal }
        OPTIONAL { tb:param_temp tb:ASdp_hasTEMPvalue ?tempVal }
        OPTIONAL { tb:param_distance tb:ASdp_hasDISTANCEvalue ?distVal }
        OPTIONAL { tb:act_AS_Buzzer tb:M_hasActionStatus ?buzzerStatus }
        OPTIONAL { tb:act_AS_Exhaust tb:M_hasActionStatus ?exhaustStatus }
        OPTIONAL { tb:fnc_cookAct tb:M_hasActivityStatus ?cookingStatus }
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
    const flame = parseInt(b.flameVal?.value || 1);
    const gas = parseFloat(b.gasVal?.value || 0);
    const temp = parseFloat(b.tempVal?.value || 0);
    const distance = parseFloat(b.distVal?.value || 0);
    const buzzerStatus = b.buzzerStatus?.value?.split("#")[1] || "st_actOFF";
    const exhaustStatus = b.exhaustStatus?.value?.split("#")[1] || "st_actOFF";
    const cookingStatus = b.cookingStatus?.value?.split("#")[1] || "st_cookNO";

    const backendTime = Date.now() - start;

    latestData = {
      timestamp_backend_cook: getFormattedTimestamp(),
      timestamp_reasoner_cook: latestData.timestamp_reasoner_cook,
      timestamp_iot_cook: latestData.timestamp_iot_cook,
      temp,
      flame,
      gas,
      distance,
      buzzerStatus,
      exhaustStatus,
      cookingStatus,
      reasoningTime: reasoningTimeGlobal,
      backendTime,
      endToEndTime: endToEndTimeGlobal,
    };

    // lastUpdateTimeCook = Date.now();
    if (latestData.timestamp_iot_cook !== "-") {
      global.lastUpdateTimeCook = Date.now();
    }

    // ===============================
    // Calculate Durasi Cooking
    // ===============================
    // if (cookingStatus === "st_cookYES" && !cookStartTime) {
    //   cookStartTime = Date.now();
    //   cookStartTimestamp = getFormattedTimestamp();
    //   console.log(`Cooking dimulai pada ${cookStartTimestamp}`);
    // }

    if (cookingStatus === "st_cookYES" && !cookStartTime) {
      cookStartTime = Date.now();
      cookStartTimestamp = getFormattedTimestamp();
      cookStableStart = setTimeout(() => {
        if (cookingStatus === "st_cookYES") {
          console.log(`🍳 Cooking confirmed at ${cookStartTimestamp}`);
        } else {
          cookStartTime = null; // batal
        }
      }, 5000);
    }

    if (cookingStatus === "st_cookNO" && cookStartTime) {
      const cookEndTime = Date.now();
      const cookEndTimestamp = getFormattedTimestamp();
      const cookDuration = Math.floor((cookEndTime - cookStartTime) / 1000); // detik

      // console.log(`Cooking selesai — durasi: ${cookDuration.toFixed(2)} detik`);

      // konversi HH:MM:SS
      const hours = Math.floor(cookDuration / 3600);
      const minutes = Math.floor((cookDuration % 3600) / 60);
      const seconds = cookDuration % 60;
      const formattedDuration = [
        hours.toString().padStart(2, "0"),
        minutes.toString().padStart(2, "0"),
        seconds.toString().padStart(2, "0"),
      ].join(":");

      // Simpan log aktivitas
      await activityLogger.writeActivityLog(
        cookStartTimestamp,
        cookEndTimestamp,
        cookDuration
      );

      // Reset state
      cookStartTime = null;
      cookStartTimestamp = null;

      // Kirim notifikasi Telegram
      await telegramNotifier.sendMessage(
        `Cooking selesai\nDurasi:  <b>${formattedDuration}</b>`
      );
    }

    // Tulis log CSV
    await logger.writeLog(latestData);

    // Kirim notifikasi hanya saat status berubah
    if (
      cookingStatus !== prevCookingStatus &&
      (buzzerStatus !== prevBuzzerStatus || exhaustStatus !== prevExhaustStatus)
    ) {
      if (buzzerStatus === "st_actON") {
        await telegramNotifier.sendMessage(
          `BUZZER AKTIF di area cook\n
          Aktivitas: ${
            cookingStatus === "st_cookYES" ? "Sedang Memasak" : "Tidak Memasak"
          }\n
          Jarak Penghuni : ${distance.toFixed(2)} cm\n
          Waktu: ${new Date().toLocaleString("id-ID")}`
        );
      }
      if (exhaustStatus == "st_actON") {
        await telegramNotifier.sendMessage(
          `EXHAUST AKTIF di area cook\n
          Terdeteksi Suhu \n
          Suhu : ${temp}\n
          Waktu : ${new Date().toLocaleString("id-ID")}`
        );
      }
      prevBuzzerStatus = buzzerStatus;
      prevExhaustStatus = exhaustStatus;
      prevCookingStatus = cookingStatus;
    }

    if (
      gas > prevGas &&
      (buzzerStatus !== prevBuzzerStatus || exhaustStatus !== prevExhaustStatus)
    ) {
      await telegramNotifier.sendMessage(
        `GAS LEAK di area cook\n
          GAS : ${gas.toFixed(2)} PPM\n
          Waktu: ${new Date().toLocaleString("id-ID")}`
      );
    }
    prevGas = gas;
  } catch (err) {
    console.error("❌ Error loop areaCook:", err.message);
  } finally {
    setTimeout(loopFetch, 2000);
  }
}

loopFetch();

// ===============================
// 📊 Endpoint: Data log JSON
// ===============================
router.get("/api/cook/log/data", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  // const logFile = path.join(LOG_DIR, `cooklog_${today}.csv`);
  const logFile = path.join(__dirname, "../logs/cook", `cooklog_${today}.csv`);

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
router.get("/api/cook/latest", (req, res) => {
  res.json(latestData);
});

// ===============================
// 📥 Endpoint: Unduh log harian CSV
// ===============================
router.get("/api/cook/log/download", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  // const logFile = path.join(LOG_DIR, `cooklog_${today}.csv`);
  const logFile = path.join(__dirname, "../logs/cook", `cooklog_${today}.csv`);

  if (!fs.existsSync(logFile)) {
    return res
      .status(404)
      .json({ error: "File log belum tersedia untuk hari ini" });
  }

  res.download(logFile, `cooklog_${today}.csv`);
});

// ===============================
// 📘 Tambahan: Endpoint Activity Log
// ===============================
router.get("/api/cook/activity/data", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const activityFile = path.join(
    __dirname,
    "../logs/cook/activity",
    `cook_activity_${today}.csv`
  );

  if (!fs.existsSync(activityFile)) {
    return res
      .status(404)
      .json({ error: "Belum ada aktivitas cooking hari ini" });
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

// Unduh file aktivitas cooking
router.get("/api/cook/activity/download", (req, res) => {
  const today = new Date().toISOString().split("T")[0];
  const activityFile = path.join(
    __dirname,
    "../logs/cook/activity",
    `cook_activity_${today}.csv`
  );

  if (!fs.existsSync(activityFile)) {
    return res.status(404).json({ error: "Belum ada log aktivitas hari ini" });
  }

  res.download(activityFile, `cook_activity_${today}.csv`);
});

// API Alerttelegram
// router.post("/api/test-alert", async (req, res) => {
//   try {
//     const message = req.body.message || "⚠️ Test alert dari Postman!";
//     await sendTelegramAlert(message);
//     res
//       .status(200)
//       .json({ success: true, message: "Alert terkirim ke Telegram" });
//   } catch (err) {
//     res.status(500).json({ success: false, error: err.message });
//   }
// });

module.exports = router;
