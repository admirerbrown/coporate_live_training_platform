const express = require("express");
const pool = require("../db/pool");

const {
  createSessionController,
  getSessionController,
  joinSessionController
} = require("../controllers/sessions");

const router = express.Router();

router.post("/", createSessionController(pool));
router.get("/:sessionId", getSessionController(pool));
router.post('/:sessionId/join', joinSessionController(pool));

module.exports = router;
