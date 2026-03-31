// bot/telegramBot.js
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "...";

if (!global._botInstance) {
  global._botInstance = new TelegramBot(TOKEN, { polling: true });
  console.log("🤖 Telegram Bot started.");
}

module.exports = global._botInstance;
