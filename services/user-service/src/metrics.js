//Prometheus metrics for User Service.


const client = require('prom-client');
const register = new client.Registry();

// Add default metrics (CPU, memory, etc.)
client.collectDefaultMetrics({ register });



// User registrations
const registrationsTotal = new client.Counter({
  name: 'user_registrations_total',
  help: 'Total number of user registrations',
  labelNames: ['status'], 
  registers: [register],
});

// User logins
const loginsTotal = new client.Counter({
  name: 'user_logins_total',
  help: 'Total number of successful logins',
  registers: [register],
});

// Login failures
const loginFailuresTotal = new client.Counter({
  name: 'user_login_failures_total',
  help: 'Total number of failed login attempts',
  labelNames: ['reason'],
  registers: [register],
});

// Authentication latency
const authLatency = new client.Histogram({
  name: 'user_auth_latency_seconds',
  help: 'Authentication response time in seconds',
  labelNames: ['operation'],
  buckets: [0.01, 0.05, 0.1, 0.25, 0.5, 1, 2, 5],
  registers: [register],
});

// Token refreshes
const tokenRefreshesTotal = new client.Counter({
  name: 'user_token_refreshes_total',
  help: 'Total number of token refresh operations',
  registers: [register],
});

const profileRequestsTotal = new client.Counter({
  name: 'user_profile_requests_total',
  help: 'Total number of profile requests (indicator of active sessions)',
  registers: [register],
});


const httpRequestDuration = new client.Histogram({
  name: 'user_http_request_duration_seconds',
  help: 'HTTP request duration in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.001, 0.005, 0.01, 0.05, 0.1, 0.5, 1, 2, 5],
  registers: [register],
});


function metricsMiddleware(req, res, next) {
  const start = process.hrtime();

  res.on('finish', () => {
    const duration = process.hrtime(start);
    const durationSeconds = duration[0] + duration[1] / 1e9;

    const route = req.route?.path || req.path;

    httpRequestDuration
      .labels(req.method, route, res.statusCode.toString())
      .observe(durationSeconds);
  });

  next();
}

module.exports = {
  register,
  registrationsTotal,
  loginsTotal,
  loginFailuresTotal,
  authLatency,
  tokenRefreshesTotal,
  profileRequestsTotal,
  metricsMiddleware,
};
