//Authentication middleware for Analytics Service.
const jwt = require('jsonwebtoken');
const config = require('../config');

//Verify internal API key for service-to-service communication.
const verifyInternalApiKey = (req) => {
  const apiKey = req.headers['x-internal-api-key'];
  return apiKey && apiKey === config.internalApiKey;
};


 //Allow internal service requests.
//Used for endpoints that can be called by other services.
const allowInternalService = (req, res, next) => {
  if (verifyInternalApiKey(req)) {
    req.isInternalService = true;
    return next();
  }

  return requireAuth(req, res, next);
};


// Require JWT authentication.
// Returns 401 if no valid token is provided.

const requireAuth = (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    const token = authHeader.split(' ')[1];

    if (!config.jwtSecret) {
      console.error('FATAL: JWT_SECRET not configured');
      return res.status(500).json({ error: 'Server configuration error' });
    }

    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { userId: decoded.userId };
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({ error: 'Invalid token' });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ error: 'Token expired' });
    }
    console.error('Auth middleware error:', error);
    res.status(500).json({ error: 'Authentication failed' });
  }
};


const optionalAuth = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    req.user = null;
    return next();
  }

  try {
    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, config.jwtSecret);
    req.user = { userId: decoded.userId };
  } catch {
    req.user = null;
  }

  next();
};

module.exports = {
  allowInternalService,
  requireAuth,
  optionalAuth,
  verifyInternalApiKey,
};
