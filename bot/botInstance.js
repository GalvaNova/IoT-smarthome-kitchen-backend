const TelegramBot = require("node-telegram-bot-api");
require("dotenv").config();

const TOKEN = process.env.TELEGRAM_BOT_TOKEN || "..";

let SUBSCRIBED_ID = null;

if (!global._botInstance) {
  global._botInstance = new TelegramBot(TOKEN, { polling: true });
  console.log("🤖 Telegram Bot started with polling...");
}

module.exports = global._botInstance;
