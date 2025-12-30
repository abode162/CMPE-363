//Rate limiting middleware for Analytics Service.
const rateLimit = require('express-rate-limit');

// General API rate limiter
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for internal service requests
    return req.isInternalService === true;
  },
});

const trackLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 60, // 60 tracks per minute 
  message: { error: 'Too many tracking requests.' },
  standardHeaders: true,
  legacyHeaders: false,
  skip: (req) => {
    // Skip rate limiting for internal service requests
    return req.isInternalService === true;
  },
});

module.exports = {
  apiLimiter,
  trackLimiter,
};
