const axios = require("axios");
const { sendMessage } = require("../bot/sender");

module.exports = {
  async handle(chatId) {
    try {
      const res = await axios.get(
        "http://192.168.43.238:5000/api/inout/latest"
      );
      const d = res.data;

      sendMessage(
        `🚪 *Area InOut*
🔢 Jumlah Orang : ${d.count}
⏱ Timestamp     : ${d.timestamp}
`,
        chatId
      );
    } catch {
      sendMessage("⚠️ Tidak dapat data Area InOut.", chatId);
    }
  },
};
