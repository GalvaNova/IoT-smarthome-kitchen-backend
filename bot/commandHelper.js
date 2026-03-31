const bot = require("./botInstance");
const { registerChat } = require("./sender");
const router = require("./messageRouter");

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

bot.on("message", (msg) => {
  router.routeMessage(msg);
});
