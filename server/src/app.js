const express = require('express');
const sessionsRouter = require('./routes/sessions');

const app = express();

app.use(express.json());

app.use('/api/sessions', sessionsRouter);

module.exports = {
  app
};