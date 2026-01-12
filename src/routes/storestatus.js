const express = require("express");
const router = express.Router();
const { supabase } = require('../config/supabase');

router.get("/time", (req, res) => {
  try {
    const now = new Date();
    // Convert to IST (UTC+5:30)
    const istOffset = 5.5 * 60 * 60 * 1000;
    const istTime = new Date(now.getTime() + istOffset);
    
    res.json({
      serverTime: now.getTime(),
      istTime: istTime.toISOString(),
      istHour: istTime.getUTCHours(),
      timezone: 'Asia/Kolkata'
    });
  } catch (err) {
    console.error('[STORE] getServerTime error:', err);
    return res.status(500).json({ error: err.message || 'Failed to get server time' });
  }
});

router.get("/status", async (req, res) => {
  try {
    const { data, error } = await supabase
      .from("store_settings")
      .select("*")
      .eq("id", 1)
      .single();

    if (error) throw error;

    res.json({
      serverTime: Date.now(),
      isManualClosed: data.is_manual_closed,
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;