/**
 * Shared configuration for k6 load tests.
 */
export const config = {
  // Service URLs
  urls: {
    urlService: __ENV.URL_SERVICE_URL || 'http://localhost:8000',
    analyticsService: __ENV.ANALYTICS_SERVICE_URL || 'http://localhost:3001',
    userService: __ENV.USER_SERVICE_URL || 'http://localhost:3002',
  },

  // Internal API key for service-to-service calls
  internalApiKey: __ENV.INTERNAL_API_KEY || 'test-internal-api-key-for-development',

  // JWT secret for generating test tokens
  jwtSecret: __ENV.JWT_SECRET || 'test-jwt-secret-for-development-only-change-in-production',

  // Test user credentials
  testUser: {
    email: 'loadtest@example.com',
    password: 'loadtest123',
    name: 'Load Test User',
  },

  // Load test stages
  stages: {
    // Smoke test - verify system works
    smoke: [
      { duration: '30s', target: 5 },
      { duration: '1m', target: 5 },
      { duration: '30s', target: 0 },
    ],

    // Load test - normal conditions
    load: [
      { duration: '1m', target: 20 },
      { duration: '3m', target: 20 },
      { duration: '1m', target: 50 },
      { duration: '3m', target: 50 },
      { duration: '1m', target: 0 },
    ],

    // Stress test - breaking point
    stress: [
      { duration: '2m', target: 50 },
      { duration: '5m', target: 100 },
      { duration: '5m', target: 200 },
      { duration: '2m', target: 0 },
    ],

    // Spike test - sudden traffic
    spike: [
      { duration: '30s', target: 10 },
      { duration: '1m', target: 200 },
      { duration: '30s', target: 10 },
      { duration: '30s', target: 0 },
    ],
  },

  // Thresholds - pass/fail criteria
  // Note: http_req_failed includes intentional 404 tests (~5% of requests)
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests < 500ms
    http_req_failed: ['rate<0.10'], // Error rate < 10% (includes intentional 404 tests)
    http_reqs: ['rate>1'], // Minimum 1 req/s (conservative for smoke tests)
  },
};
