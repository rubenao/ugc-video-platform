const express = require('express');
const config = require('./config');
const buildServices = require('./container');
const createApiRouter = require('./routes');
const errorHandler = require('./middleware/errorHandler');

function createApp(services = buildServices()) {
  const app = express();

  app.use(express.json({ limit: '1mb' }));
  app.use(express.static(config.paths.public));
  app.use('/uploads', express.static(config.paths.uploads));
  app.use('/api', createApiRouter(services));
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
