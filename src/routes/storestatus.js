const express = require("express");
const router = express.Router();
const { supabase } = require('../config/supabase');

router.get("/time", (req, res) => {
  res.json({
    serverTime: Date.now(),
  });
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