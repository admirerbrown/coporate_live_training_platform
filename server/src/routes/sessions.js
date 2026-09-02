const express = require("express");
const pool = require("../db/pool");

const {
  createSessionController,
  getSessionController,
  joinSessionController,
  startSessionController,
  endSessionController,
} = require("../controllers/sessions");

const router = express.Router();

router.post("/", createSessionController(pool));
router.get("/:sessionId", getSessionController(pool));
router.post("/:sessionId/join", joinSessionController(pool));
router.post("/:sessionId/start", startSessionController(pool));
router.post("/:sessionId/end", endSessionController(pool));

module.exports = router;
