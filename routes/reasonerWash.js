// =======================================
// reasoning-wash.js (FINAL REVISED)
// =======================================

const express = require("express");
const axios = require("axios");
const router = express.Router();
const bodyParser = require("body-parser");

router.use(bodyParser.json());

// ============================
// 🔧 Konfigurasi Dasar
// ============================
axios.defaults.timeout = 5000;

const API = "url";
const BACKEND_MONITOR = `http://${API}:5000`;

const FUSEKI_BASE = `http://${API}:3030`;
const DATASET = "areaWash-2";
const NS = "http://www.semanticweb.org/msi/ontologies/2025/5/thesis-1#";

const FUSEKI_UPDATE = `${FUSEKI_BASE}/${DATASET}/update`;
const FUSEKI_QUERY = `${FUSEKI_BASE}/${DATASET}/query`;

// Menyimpan perintah terbaru untuk diambil IoT
let latestCommand = {
  valveStatus: "st_actOFF",
  washingStatus: "st_washNO",
  reasoningTime: 0,
  timestamp: Date.now(),
};

//format waktu kustom: YYYY-MM-DD:hh-mm-ss
function getFormattedTimestamp() {
  const now = new Date();
  const YYYY = now.getFullYear();
  const MM = String(now.getMonth() + 1).padStart(2, "0");
  const DD = String(now.getDate()).padStart(2, "0");
  const hh = String(now.getHours()).padStart(2, "0");
  const mm = String(now.getMinutes()).padStart(2, "0");
  const ss = String(now.getSeconds()).padStart(2, "0");
  return `${YYYY}-${MM}-${DD}:${hh}-${mm}-${ss}`;
}

// ============================
// Update Fuseki
// ============================
async function updateFuseki(sparqlQuery) {
  try {
    await axios.post(
      FUSEKI_UPDATE,
      `update=${encodeURIComponent(sparqlQuery)}`,
      { headers: { "Content-Type": "application/x-www-form-urlencoded" } }
    );
    console.log("✅ Update ke Fuseki berhasil");
  } catch (err) {
    console.error("❌ Gagal update Fuseki:", err.message);
  }
}

// ============================
// ⚙️ Fungsi Reasoning Utama
// ============================
// function reasoningLogic(jarakObjek, jarakOrang) {
//   let washing = "st_washNO";
//   let valve = "st_actOFF";

//   if (jarakObjek < 10 && jarakOrang < 10) {
//     washing = "st_washYES";
//     valve = "st_actON";
//   }

//   return { washing, valve };
// }

function reasoningLogic(jarakObjek, jarakOrang) {
  let washing = "st_washNO";
  let valve = "st_actOFF";
  const valveON = jarakObjek < 10 && jarakOrang < 10;
  if (valveON) {
    washing = "st_washYES";
    valve = "st_actON";
  }
  return { washing, valve };
}

// ============================
// 📡 Endpoint 1: POST /api/reasoner-wash/input
// ============================
router.post("/api/reasoner-wash/input", async (req, res) => {
  try {
    const { jarakObjek, jarakOrang, timestamp_iot } = req.body;

    if (jarakObjek === undefined || jarakOrang === undefined) {
      return res.status(400).json({ error: "Data sensor tidak lengkap" });
    }

    console.log("📥 Data IoT:", { jarakObjek, jarakOrang });

    const reasoningStart = Date.now();

    // Jalankan reasoning
    const { washing, valve } = reasoningLogic(jarakObjek, jarakOrang);

    // Buat SPARQL update query
    const updateQuery = `
      PREFIX tb: <${NS}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      DELETE {
        tb:param_objek tb:ASdp_hasDISTOBJvalue ?oldObj .
        tb:param_orang tb:ASdp_hasDISTPERvalue ?oldPer .
        tb:fnc_washAct tb:M_hasActivityStatus ?oldWash .
        tb:act_AS_Valve tb:M_hasActionStatus ?oldValve .
      }
      INSERT {
        tb:param_objek a tb:parameter ;
          tb:ASdp_hasDISTOBJvalue "${jarakObjek}"^^xsd:float .
        tb:param_orang a tb:parameter ;
          tb:ASdp_hasDISTPERvalue "${jarakOrang}"^^xsd:float .
        tb:fnc_washAct tb:M_hasActivityStatus tb:${washing} .
        tb:act_AS_Valve tb:M_hasActionStatus tb:${valve} .
      }
      WHERE {
        OPTIONAL { tb:param_objek tb:ASdp_hasDISTOBJvalue ?oldObj . }
        OPTIONAL { tb:param_orang tb:ASdp_hasDISTPERvalue ?oldPer . }
        OPTIONAL { tb:fnc_washAct tb:M_hasActivityStatus ?oldWash . }
        OPTIONAL { tb:act_AS_Valve tb:M_hasActionStatus ?oldValve . }
      }
    `;

    await updateFuseki(updateQuery);

    // Hitung waktu reasoning dan timestamp
    const reasoningEnd = Date.now();
    const reasoningTime = reasoningEnd - reasoningStart;
    const timestamp_reasoner = getFormattedTimestamp();

    // Simpan perintah terbaru
    latestCommand = {
      valveStatus: valve,
      washingStatus: washing,
      reasoningTime,
      timestamp_iot: timestamp_iot || getFormattedTimestamp(),
      timestamp_reasoner,
    };

    // Kirim hasil reasoning & waktu ke backend
    await axios.post(`${BACKEND_MONITOR}/api/backendwash/reasoningtime`, {
      reasoningTime,
      timestamp_reasoner,
      timestamp_iot,
    });

    res.json({
      message: "✅ Data sensor diproses & reasoning selesai",
      valveStatus: valve,
      reasoningTime,
      washingStatus: washing,
      timestamp_reasoner,
      timestamp_iot,
    });
  } catch (err) {
    console.error("❌ Error di /reasoner-wash/input:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// ⚙️ Endpoint 2: GET /api/reasoner-wash/command
// ============================
router.get("/api/reasoner-wash/command", (req, res) => {
  res.json(latestCommand);
});

// ============================
// ⏱ Endpoint 3: POST /api/reasoner-wash/endtoend
// ============================
router.post("/api/reasoner-wash/endtoend", async (req, res) => {
  const { endToEndTime } = req.body;

  if (endToEndTime === undefined) {
    return res.status(400).json({ error: "Missing endToEndTime" });
  }

  try {
    await axios.post(`${BACKEND_MONITOR}/api/backendwash/endtoendtime`, {
      endToEndTime,
      timestamp: new Date().toISOString(),
    });

    res.json({ message: "✅ End-to-End time dikirim ke backend" });
  } catch (err) {
    console.error("❌ Gagal kirim End-to-End:", err.message);
    res.status(500).json({ error: "Failed to forward End-to-End time" });
  }
});

module.exports = router;
