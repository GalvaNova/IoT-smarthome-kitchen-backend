// ===============================================
// utils/activityLoggerWash.js (FINAL + FORMAT hh:mm:ss ✅)
// ===============================================

const fs = require("fs");
const path = require("path");

// ===============================
// Setup direktori log aktivitas washing
// ===============================
const ACTIVITY_DIR = path.join(__dirname, "../logs/wash/activity");
if (!fs.existsSync(ACTIVITY_DIR))
  fs.mkdirSync(ACTIVITY_DIR, { recursive: true });

// ===============================
// Fungsi bantu: ubah detik → hh:mm:ss
// ===============================
function formatDuration(seconds) {
  const hrs = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  const secs = Math.floor(seconds % 60);
  return `${String(hrs).padStart(2, "0")}:${String(mins).padStart(
    2,
    "0"
  )}:${String(secs).padStart(2, "0")}`;
}

// ===============================
// Fungsi utama: tulis log aktivitas washing
// ===============================
async function writeActivityLog(startTimestamp, endTimestamp, durationSeconds) {
  if (!startTimestamp || !endTimestamp || durationSeconds == null) return;

  const today = new Date().toISOString().split("T")[0];
  const activityFile = path.join(ACTIVITY_DIR, `wash_activity_${today}.csv`);
  const header = "timestamp_start,timestamp_end,duration_hms\n";

  const durationFormatted = formatDuration(durationSeconds);
  const line = `${startTimestamp},${endTimestamp},${durationFormatted}\n`;

  try {
    if (!fs.existsSync(activityFile)) {
      fs.writeFileSync(activityFile, header + line, "utf8");
      console.log(`🧾 File aktivitas baru dibuat: ${activityFile}`);
    } else {
      fs.appendFileSync(activityFile, line, "utf8");
    }

    console.log(`🧽 Log aktivitas washing disimpan (${durationFormatted})`);
  } catch (err) {
    console.error("❌ Gagal menulis log aktivitas washing:", err.message);
  }
}

module.exports = { writeActivityLog };
