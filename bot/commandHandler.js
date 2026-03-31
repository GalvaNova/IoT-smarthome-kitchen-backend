// bot/commandHandler.js
const bot = require("./telegramBot");
const { registerChat } = require("./telegramNotifier");
const { fetchSystemStatus, fetchAreaData } = require("./messageRouter");

function initCommandHandler() {
  bot.onText(/\/start/, (msg) => {
    const chatId = msg.chat.id;
    registerChat(chatId);

    bot.sendMessage(chatId, "👋 Selamat datang di *Thesis Beta Monitor!*", {
      parse_mode: "Markdown",
      reply_markup: {
        keyboard: [
          ["📡 Status Sistem"],
          ["🍳 Area Cook", "🚿 Area Wash", "🚪 Area InOut"],
        ],
        resize_keyboard: true,
      },
    });
  });

  bot.on("message", async (msg) => {
    const text = msg.text?.toLowerCase();
    const chatId = msg.chat.id;

    if (!text) return;

    if (text.includes("status")) {
      const status = await fetchSystemStatus();
      return bot.sendMessage(chatId, status, { parse_mode: "Markdown" });
    }

    if (text.includes("cook")) {
      const data = await fetchAreaData("cook");
      return bot.sendMessage(chatId, data, { parse_mode: "Markdown" });
    }

    if (text.includes("wash")) {
      const data = await fetchAreaData("wash");
      return bot.sendMessage(chatId, data, { parse_mode: "Markdown" });
    }

    if (text.includes("inout")) {
      const data = await fetchAreaData("inout");
      return bot.sendMessage(chatId, data, { parse_mode: "Markdown" });
    }
  });
}

module.exports = { initCommandHandler };
