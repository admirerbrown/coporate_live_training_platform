const express = require("express");
const pool = require("../db/pool");

const {
  createSessionController,
  getSessionController,
} = require("../controllers/sessions");

const router = express.Router();

router.post("/", createSessionController(pool));
router.get("/:sessionId", getSessionController(pool));

module.exports = router;
