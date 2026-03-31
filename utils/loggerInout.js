// ===============================================
// utils/loggerInout.js (Final Stable Version)
// ===============================================

const fs = require("fs");
const path = require("path");

// ===============================================
// 📂 1. Setup direktori log
// ===============================================
const LOG_DIR = path.join(__dirname, "../logs/inout");
if (!fs.existsSync(LOG_DIR)) fs.mkdirSync(LOG_DIR, { recursive: true });

// Variabel internal
let currentDate = "";
let logFile = "";
let logQueue = [];
const MAX_QUEUE_SIZE = 10;

// ===============================================
// 🧩 2. Fungsi: Buat file log baru per hari
// ===============================================
function initLogFile() {
  const today = new Date().toISOString().split("T")[0];
  if (today !== currentDate) {
    currentDate = today;
    logFile = path.join(LOG_DIR, `inoutlog_${today}.csv`);

    if (!fs.existsSync(logFile)) {
      const header =
        "timestamp_backend_inout,timestamp_reasoner_inout,timestamp_iot_inout,personCount,lampStatus,reasoningTime,endToEndTime,backendTime\n";
      fs.writeFileSync(logFile, header, "utf8");
      console.log(`🆕 File log dibuat: ${logFile}`);
    }
  }
  return logFile;
}

// ===============================================
// 🕒 3. Format waktu lokal (WIB)
// ===============================================
function getLocalTimestamp() {
  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");

  const date = `${pad(now.getDate())}-${pad(
    now.getMonth() + 1
  )}-${now.getFullYear()}`;
  const time = `${pad(now.getHours())}:${pad(now.getMinutes())}:${pad(
    now.getSeconds()
  )}`;

  return `${date} ${time}`;
}

// ===============================================
// 🧠 4. Menulis log ke antrian
// ===============================================
async function writeLog(data) {
  if (!data || typeof data !== "object") {
    console.error("❌ Invalid log data:", data);
    return;
  }

  initLogFile();

  const timeStamp = data.timeStamp || getLocalTimestamp();

  const line =
    [
      data.timestamp_backend_inout || getLocalTimestamp(),
      data.timestamp_reasoner_inout || "-",
      data.timestamp_iot_inout || "-",
      data.personCount ?? 0,
      data.lampStatus || "st_actOFF",
      data.reasoningTime ?? 0,
      data.endToEndTime ?? 0,
      data.backendTime ?? 0,
    ].join(",") + "\n";

  logQueue.push(line);

  if (logQueue.length >= MAX_QUEUE_SIZE) flushQueue();
}

// ===============================================
// 💾 5. Flush antrian ke file
// ===============================================
function flushQueue() {
  if (logQueue.length === 0) return;
  initLogFile();

  const batch = logQueue.join("");
  logQueue = [];

  fs.appendFile(logFile, batch, (err) => {
    if (err) {
      console.error("❌ Gagal menulis log:", err.message);
    } else {
      console.log(`🧾 Log tersimpan (${batch.split("\n").length - 1} entri)`);
    }
  });
}

// ===============================================
// 🔁 6. Auto flush setiap 30 detik
// ===============================================
setInterval(flushQueue, 30000);

// ===============================================
// ✅ 7. Ekspor fungsi
// ===============================================
module.exports = { writeLog };
