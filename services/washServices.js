const axios = require("axios");
const { sendMessage } = require("../bot/sender");

module.exports = {
  async handle(chatId) {
    try {
      const res = await axios.get("http://192.168.43.238:5000/api/wash/latest");
      const d = res.data;

      sendMessage(
        `🚿 *Area Wash*
🚰 Jarak Objek : ${d.jarakObjek} cm
👤 Jarak Orang : ${d.jarakOrang} cm
⏱ Timestamp   : ${d.timestamp}
`,
        chatId
      );
    } catch {
      sendMessage("⚠️ Tidak dapat data Area Wash.", chatId);
    }
  },
};
