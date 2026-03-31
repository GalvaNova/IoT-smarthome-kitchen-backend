// bot/telegramNotifier.js
const fs = require("fs");
const path = require("path");

let bot = null;

const FILE_PATH = path.join(__dirname, "chatIds.json");

// ===============================
// 1. Load chatId dari file (persisten)
// ===============================
let chatIds = [];
if (fs.existsSync(FILE_PATH)) {
  try {
    chatIds = JSON.parse(fs.readFileSync(FILE_PATH, "utf8"));
    console.log("📂 Loaded chat IDs:", chatIds);
  } catch {
    chatIds = [];
  }
}

// ===============================
// 2. Init Bot Instance
// ===============================
function initNotifier(botInstance) {
  bot = botInstance;
}

// ===============================
// 3. Register Chat — bisa banyak
// ===============================
function registerChat(chatId) {
  if (!chatIds.includes(chatId)) {
    chatIds.push(chatId);
    fs.writeFileSync(FILE_PATH, JSON.stringify(chatIds, null, 2));
    console.log("📌 Chat ID terdaftar:", chatId);
  }
}

// ===============================
// 4. Kirim Pesan ke Semua Chat
// ===============================
async function sendMessage(msg) {
  if (!bot) return;

  for (const id of chatIds) {
    try {
      await bot.sendMessage(id, msg, { parse_mode: "HTML" });
      console.log(`📤 Alert terkirim ke ${id}`);
    } catch (err) {
      console.log(`❌ Gagal mengirim ke ${id}:`, err.message);
    }
  }
}

module.exports = { initNotifier, registerChat, sendMessage };
