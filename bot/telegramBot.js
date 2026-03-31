// bot/telegramBot.js
const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const TOKEN =
  process.env.TELEGRAM_BOT_TOKEN ||
  "8364671911:AAG9Tifa5eaX6jz1wUc2MVE2s0o8zwAL3zg";

if (!global._botInstance) {
  global._botInstance = new TelegramBot(TOKEN, { polling: true });
  console.log("🤖 Telegram Bot started.");
}

module.exports = global._botInstance;
