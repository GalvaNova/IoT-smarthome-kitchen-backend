let REGISTERED_CHAT_ID = null;

// Simpan chat ID hanya jika user mengetik /start
function registerChat(chatId) {
  REGISTERED_CHAT_ID = chatId;
  console.log("📌 Chat terdaftar:", chatId);
}

function getRegisteredChat() {
  return REGISTERED_CHAT_ID;
}

async function sendMessage(message) {
  const bot = require("./telegramBot");

  if (!REGISTERED_CHAT_ID) {
    console.warn("⚠️ Belum ada chat yang terdaftar melalui /start.");
    return;
  }

  try {
    await bot.sendMessage(REGISTERED_CHAT_ID, message, { parse_mode: "HTML" });
    console.log("📨 Pesan terkirim:", message);
  } catch (err) {
    console.error("❌ Gagal kirim pesan Telegram:", err.message);
  }
}

module.exports = {
  registerChat,
  getRegisteredChat,
  sendMessage,
};
