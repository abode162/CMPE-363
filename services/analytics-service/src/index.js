//Analytics Service
const express = require('express');
const cors = require('cors');
const morgan = require('morgan');

const config = require('./config');
const connectDB = require('./db');
const routes = require('./routes');
const { initGeoIP } = require('./utils/geolocation');
const { register, metricsMiddleware } = require('./metrics');

const app = express();

// Trust proxy for accurate IP addresses
app.set('trust proxy', true);

// CORS configuration - use explicit origins
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type', 'X-Internal-API-Key'],
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '10kb' })); // Limit request body size
app.use(morgan('combined'));

// Prometheus metrics middleware
app.use(metricsMiddleware);

// Prometheus metrics endpoint
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

const startServer = async () => {
  try {
    // Initialize GeoIP database
    await initGeoIP();

    // Connect to MongoDB
    await connectDB();

    app.listen(config.port, () => {
      console.log(`Analytics service running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
