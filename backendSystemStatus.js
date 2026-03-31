const express = require("express");
const router = express.Router();
const axios = require("axios");

// cek service lain
async function check(url) {
  try {
    await axios.get(url, { timeout: 1000 });
    return true;
  } catch {
    return false;
  }
}

const TIMEOUT = 3000;

router.get("/api/system-status", async (req, res) => {
  const backend = true;

  const cookAlive = await check("http://url:5000/api/cook/latest");
  const washAlive = await check("http://url:5000/api/wash/latest");
  const inoutAlive = await check("http://url:5000/api/inout/latest");

  res.json({
    backend,
    cook:
      cookAlive &&
      global.lastUpdateTimeCook &&
      Date.now() - global.lastUpdateTimeCook < TIMEOUT,

    wash:
      washAlive &&
      global.lastUpdateTimeWash &&
      Date.now() - global.lastUpdateTimeWash < TIMEOUT,

    inout:
      inoutAlive &&
      global.lastUpdateTimeInout &&
      Date.now() - global.lastUpdateTimeInout < TIMEOUT,
  });
});

module.exports = router;
