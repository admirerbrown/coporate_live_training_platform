const express = require('express');
const pool = require('../db/pool');

const {
  createSessionController
} = require('../controllers/sessions');

const router = express.Router();

router.post('/', createSessionController(pool));

module.exports = router;