// =======================================
// 🧠 reasoning-Cook.js (FINAL + Cooking Activity)
// =======================================

const express = require("express");
const axios = require("axios");
const router = express.Router();
const bodyParser = require("body-parser");

router.use(bodyParser.json());

// ============================
// ⚙️ Konfigurasi
// ============================
axios.defaults.timeout = 5000;

const API = "192.168.43.238";
const BACKEND_MONITOR = `http://${API}:5000`;

const FUSEKI_BASE = `http://${API}:3030`;
const DATASET = "areaCook-2";
const NS = "http://www.semanticweb.org/msi/ontologies/2025/5/thesis-1#";

const FUSEKI_UPDATE = `${FUSEKI_BASE}/${DATASET}/update`;

// Menyimpan status terbaru untuk IoT
let latestCommand = {
  buzzerStatus: "st_actOFF",
  exhaustStatus: "st_actOFF",
  cookingStatus: "st_cookNO",
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
// 🧠 Logika Reasoning Area Cook
// ============================
// Flame: 0 = api menyala, 1 = tidak ada api
function reasoningLogic(flame, gas, temp, dist) {
  let buzzer = "st_actOFF";
  let exhaust = "st_actOFF";
  let cooking = "st_cookNO";

  const isCooking = flame === 0 && dist <= 10;
  const isDanger = flame === 0 && dist >= 10;
  const isGasLeak = gas > 320;

  if (isDanger || isGasLeak) {
    buzzer = "st_actON";
  }
  if (temp >= 30 || isGasLeak || isDanger) {
    exhaust = "st_actON";
  }
  if (isCooking || isDanger) {
    cooking = "st_cookYES";
  }
  return { buzzer, exhaust, cooking };
}

// ============================
// 📡 Endpoint 1: POST /api/reasoner-cook/input
// ============================
router.post("/api/reasoner-cook/input", async (req, res) => {
  try {
    const { flame, gas, temp, dist, timestamp_iot_cook } = req.body;

    if (
      flame === undefined ||
      gas === undefined ||
      temp === undefined ||
      dist === undefined
    ) {
      return res.status(400).json({ error: "Data sensor tidak lengkap" });
    }

    // console.log("📥 Data IoT Cook:", { flame, gas, temp, dist });
    console.log("📥 Data IoT Cook diterima:", req.body);

    const reasoningStart = Date.now();

    // Jalankan logika reasoning
    const { buzzer, exhaust, cooking } = reasoningLogic(flame, gas, temp, dist);

    // SPARQL update ke Fuseki
    const updateQuery = `
      PREFIX tb: <${NS}>
      PREFIX xsd: <http://www.w3.org/2001/XMLSchema#>
      DELETE {
        tb:param_flame tb:ASdp_hasFLAMEvalue ?oldFlame .
        tb:param_gas tb:ASdp_hasGASvalue ?oldGas .
        tb:param_temp tb:ASdp_hasTEMPvalue ?oldTemp .
        tb:param_distance tb:ASdp_hasDISTANCEvalue ?oldDist .
        tb:act_AS_Buzzer tb:M_hasActionStatus ?oldBuzzer .
        tb:act_AS_Exhaust tb:M_hasActionStatus ?oldExhaust .
        tb:fnc_cookAct tb:M_hasActivityStatus ?oldCooking .
      }
      INSERT {
        tb:param_flame tb:ASdp_hasFLAMEvalue "${flame}"^^xsd:integer .
        tb:param_gas tb:ASdp_hasGASvalue "${gas}"^^xsd:float .
        tb:param_temp tb:ASdp_hasTEMPvalue "${temp}"^^xsd:float .
        tb:param_distance tb:ASdp_hasDISTANCEvalue "${dist}"^^xsd:float .
        tb:act_AS_Buzzer tb:M_hasActionStatus tb:${buzzer} .
        tb:act_AS_Exhaust tb:M_hasActionStatus tb:${exhaust} .
        tb:fnc_cookAct tb:M_hasActivityStatus tb:${cooking} .
      }
      WHERE {
        OPTIONAL { tb:param_flame tb:ASdp_hasFLAMEvalue ?oldFlame . }
        OPTIONAL { tb:param_gas tb:ASdp_hasGASvalue ?oldGas . }
        OPTIONAL { tb:param_temp tb:ASdp_hasTEMPvalue ?oldTemp . }
        OPTIONAL { tb:param_distance tb:ASdp_hasDISTANCEvalue ?oldDist . }
        OPTIONAL { tb:act_AS_Buzzer tb:M_hasActionStatus ?oldBuzzer . }
        OPTIONAL { tb:act_AS_Exhaust tb:M_hasActionStatus ?oldExhaust . }
        OPTIONAL { tb:fnc_cookAct tb:M_hasActivityStatus ?oldCooking . }
      }
    `;
    await updateFuseki(updateQuery);

    const reasoningEnd = Date.now();
    const reasoningTime = reasoningEnd - reasoningStart;
    const timestamp_reasoner_cook = getFormattedTimestamp();

    // Simpan hasil reasoning terbaru
    latestCommand = {
      buzzerStatus: buzzer,
      exhaustStatus: exhaust,
      cookingStatus: cooking,
      reasoningTime,
      timestamp_iot_cook: timestamp_iot_cook || getFormattedTimestamp(),
      timestamp_reasoner_cook,
    };

    // Kirim reasoning time ke backend
    await axios.post(`${BACKEND_MONITOR}/api/backendcook/reasoningtime`, {
      reasoningTime,
      timestamp_reasoner_cook,
      timestamp_iot_cook: timestamp_iot_cook || getFormattedTimestamp(),
    });

    res.json({
      message: "✅ Data sensor diproses & reasoning selesai",
      buzzerStatus: buzzer,
      exhaustStatus: exhaust,
      reasoningTime,
      cookingStatus: cooking,
      timestamp_reasoner_cook,
      timestamp_iot_cook,
    });
  } catch (err) {
    console.error("❌ Error /reasoner-cook/input:", err.message);
    res.status(500).json({ error: err.message });
  }
});

// ============================
// ⚙️ Endpoint 2: GET /api/reasoner-cook/command
// ============================
router.get("/api/reasoner-cook/command", (req, res) => {
  res.json(latestCommand);
});

// ============================
// ⏱ Endpoint 3: POST /api/reasoner-cook/endtoend
// ============================
router.post("/api/reasoner-cook/endtoend", async (req, res) => {
  const { endToEndTime } = req.body;

  if (endToEndTime === undefined) {
    return res.status(400).json({ error: "Missing endToEndTime" });
  }

  try {
    await axios.post(`${BACKEND_MONITOR}/api/backendcook/endtoendtime`, {
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
