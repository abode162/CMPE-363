//Test application factory for Analytics Service. 
const express = require('express');
const cors = require('cors');

const routes = require('../src/routes');
const { register, metricsMiddleware } = require('../src/metrics');

function createTestApp() {
  const app = express();

  // Trust proxy for IP addresses
  app.set('trust proxy', true);

  // CORS configuration
  app.use(cors());
  app.use(express.json({ limit: '10kb' }));

  // Metrics middleware
  app.use(metricsMiddleware);

  // Metrics endpoint
  app.get('/metrics', async (req, res) => {
    try {
      res.set('Content-Type', register.contentType);
      res.end(await register.metrics());
    } catch (error) {
      res.status(500).end(error.message);
    }
  });

  // Routes
  app.use(routes);

  // Global error handler
  app.use((err, req, res, next) => {
    console.error('Unhandled error:', err);
    res.status(500).json({ error: 'Internal server error' });
  });

  return app;
}

module.exports = createTestApp;
