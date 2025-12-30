//Prometheus metrics for Analytics Service.
const client = require('prom-client');

// Create a Registry
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });

// Custom metrics

// Click events tracked
const eventsTrackedTotal = new client.Counter({
  name: 'analytics_events_tracked_total',
  help: 'Total number of click events tracked',
  registers: [register],
});

// Stats queries made
const queriesTotal = new client.Counter({
  name: 'analytics_queries_total',
  help: 'Total number of stats queries made',
  labelNames: ['endpoint'],
  registers: [register],
});

// Events by country
const eventsByCountry = new client.Counter({
  name: 'analytics_events_by_country_total',
  help: 'Total click events by country',
  labelNames: ['country'],
  registers: [register],
});

// Events by browser
const eventsByBrowser = new client.Counter({
  name: 'analytics_events_by_browser_total',
  help: 'Total click events by browser',
  labelNames: ['browser'],
  registers: [register],
});

// Events by device type
const eventsByDevice = new client.Counter({
  name: 'analytics_events_by_device_total',
  help: 'Total click events by device type',
  labelNames: ['device'],
  registers: [register],
});

// Event processing duration
const processingDuration = new client.Histogram({
  name: 'analytics_processing_duration_seconds',
  help: 'Event processing time in seconds',
  buckets: [0.001, 0.005, 0.01, 0.025, 0.05, 0.1, 0.25, 0.5, 1.0],
  registers: [register],
});

// HTTP request duration
const httpRequestDuration = new client.Histogram({
  name: 'analytics_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});


function parseBrowser(userAgent) {
  if (!userAgent) return 'unknown';
  userAgent = userAgent.toLowerCase();

  if (userAgent.includes('firefox')) return 'Firefox';
  if (userAgent.includes('edg')) return 'Edge';
  if (userAgent.includes('chrome')) return 'Chrome';
  if (userAgent.includes('safari')) return 'Safari';
  if (userAgent.includes('opera') || userAgent.includes('opr')) return 'Opera';
  if (userAgent.includes('msie') || userAgent.includes('trident')) return 'IE';

  return 'other';
}


function parseDevice(userAgent) {
  if (!userAgent) return 'unknown';
  userAgent = userAgent.toLowerCase();

  if (userAgent.includes('mobile') || userAgent.includes('android') && !userAgent.includes('tablet')) {
    return 'mobile';
  }
  if (userAgent.includes('tablet') || userAgent.includes('ipad')) {
    return 'tablet';
  }
  if (userAgent.includes('bot') || userAgent.includes('crawler') || userAgent.includes('spider')) {
    return 'bot';
  }

  return 'desktop';
}

//Express middleware for tracking HTTP metrics.
function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;

    // Get the route path, fallback to path if no route matched
    const route = req.route?.path || req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(durationSeconds);
  });

  next();
}

module.exports = {
  register,
  eventsTrackedTotal,
  queriesTotal,
  eventsByCountry,
  eventsByBrowser,
  eventsByDevice,
  processingDuration,
  parseBrowser,
  parseDevice,
  metricsMiddleware,
};
