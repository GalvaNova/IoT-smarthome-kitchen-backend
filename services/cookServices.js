const axios = require("axios");
const { sendMessage } = require("../bot/sender");

module.exports = {
  async handle(chatId) {
    try {
      const res = await axios.get("http://192.168.43.238:5000/api/cook/latest");
      const d = res.data;

      sendMessage(
        `🍳 *Area Cook*
🔥 Suhu Api       : ${d.tempApi}°C
🌡️ Suhu Ruangan   : ${d.tempRuangan}°C
🧯 Kadar Gas      : ${d.kadarGas}
⏱ Timestamp       : ${d.timestamp}
`,
        chatId
      );
    } catch {
      sendMessage("⚠️ Tidak dapat data Area Cook.", chatId);
    }
  },
};
