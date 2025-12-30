const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const rateLimit = require('express-rate-limit');

const config = require('./config');
const { connectDB } = require('./db');
const authRoutes = require('./routes/auth');
const { register, metricsMiddleware } = require('./metrics');

const app = express();
app.set('trust proxy', true);

// CORS configuration - use explicit origins
const corsOptions = {
  origin: config.corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Authorization', 'Content-Type'],
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

// Rate limiting for auth endpoints
const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 20, // 20 requests per windowMs
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// Health check
app.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'user-service',
    version: '1.0.0',
  });
});

// Auth routes with rate limiting
app.use('/api/auth', authLimiter, authRoutes);

// Global error handler
app.use((err, req, res, next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

const startServer = async () => {
  try {
    await connectDB();

    app.listen(config.port, () => {
      console.log(`User service running on port ${config.port}`);
      console.log(`Environment: ${config.nodeEnv}`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
};

startServer();
