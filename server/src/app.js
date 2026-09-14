const express = require('express');
const cors = require('cors');
const sessionsRouter = require('./routes/sessions');

const app = express();

app.use(cors({
  origin: process.env.CLIENT_ORIGIN || true,
}));

app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ status: 'ok' });
});

app.use('/api/sessions', sessionsRouter);

module.exports = {
  app
};