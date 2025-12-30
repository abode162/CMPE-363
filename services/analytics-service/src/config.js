require('dotenv').config();

module.exports = {
  port: process.env.PORT || 3001,
  mongoUri: process.env.MONGO_URI || 'mongodb://localhost:27017/analytics',
  nodeEnv: process.env.NODE_ENV || 'development',

  // Security
  jwtSecret: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  internalApiKey: process.env.INTERNAL_API_KEY || 'internal-service-key-change-in-production',

  // CORS
  corsOrigins: process.env.CORS_ORIGINS
    ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
    : ['http://localhost', 'http://localhost:3003', 'http://localhost:5173'],

  // Geolocation
  geoipDbPath: process.env.GEOIP_DB_PATH || '/app/data/GeoLite2-City.mmdb',
};
