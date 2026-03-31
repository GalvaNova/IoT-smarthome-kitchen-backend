// bot/messageRouter.js
const axios = require("axios");
const API = "http://192.168.43.238:5000";

// async function fetchSystemStatus() {
//   const { data } = await axios.get(`${API}/api/system-status`);

//   return `
// 📡 *Status Sistem*
// --------------------------
// 🖥 Backend   : ${data.backend ? "🟢 Aktif" : "🔴 Mati"}
// 🍳 Cook      : ${data.cook ? "🟢 Online" : "🔴 Offline"}
// 🚿 Wash      : ${data.wash ? "🟢 Online" : "🔴 Offline"}
// 🚪 InOut     : ${data.inout ? "🟢 Online" : "🔴 Offline"}
// --------------------------
//   `;
// }

async function fetchSystemStatus() {
  const { data } = await axios.get(`${API}/api/system-status`);

  return `
📡 *Status Sistem*
--------------------------
STATUS SISTEM   : ${data.backend ? "🟢 Aktif" : "🔴 Mati"}

SIAP MEMONITORING..
--------------------------
  `;
}

async function fetchAreaData(area) {
  const { data } = await axios.get(`${API}/api/${area}/latest`);

  if (area === "cook") {
    return `
🍳 *Area Cook*
🔥 Api      : ${data.flame}
🌡 Ruangan  : ${data.temp}
🧯 Gas      : ${data.gas}
👤 Jarak    : ${data.distance}
⏱ Time     : ${data.timestamp_iot_cook}
`;
  }

  if (area === "wash") {
    return `
🚿 *Area Wash*
🚰 Objek : ${data.jarakObjek} cm
👤 Orang : ${data.jarakOrang} cm
⏱ Time  : ${data.timestamp_iot}
`;
  }

  if (area === "inout") {
    return `
🚪 *Area InOut*
🔢 Count : ${data.personCount}
⏱ Time  : ${data.timestamp_iot_inout}
`;
  }
}

module.exports = { fetchSystemStatus, fetchAreaData };
