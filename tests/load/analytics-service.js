// k6 Load Test for Analytics Service.

import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config } from './config.js';

// Custom metrics
const trackingErrors = new Rate('tracking_errors');
const statsErrors = new Rate('stats_errors');
const trackingDuration = new Trend('tracking_duration');
const statsDuration = new Trend('stats_duration');

// Select test stage
const stage = __ENV.STAGE || 'smoke';

export const options = {
  stages: config.stages[stage] || config.stages.smoke,
  thresholds: {
    ...config.thresholds,
    tracking_errors: ['rate<0.02'],
    stats_errors: ['rate<0.02'],
    tracking_duration: ['p(95)<500'],
    stats_duration: ['p(95)<300'],
  },
};

// Test short codes for consistent stats
const testShortCodes = ['loadtest1', 'loadtest2', 'loadtest3', 'loadtest4', 'loadtest5'];

// Headers for internal service calls
const internalHeaders = {
  'Content-Type': 'application/json',
  'X-Internal-API-Key': config.internalApiKey,
};

// Generate random user agent
function randomUserAgent() {
  const agents = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Safari/605.1.15',
    'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2) AppleWebKit/605.1.15 Mobile',
    'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Mobile',
    'Mozilla/5.0 (compatible; Googlebot/2.1)',
  ];
  return agents[Math.floor(Math.random() * agents.length)];
}

// Generate random IP for geolocation testing
function randomIP() {
  // Mix of public IPs from different regions
  const ips = [
    '8.8.8.8',       // Google DNS (US)
    '1.1.1.1',       // Cloudflare (US)
    '185.228.168.9', // CleanBrowsing (Germany)
    '94.140.14.14',  // AdGuard (Russia)
    '208.67.222.222', // OpenDNS (US)
  ];
  return ips[Math.floor(Math.random() * ips.length)];
}

export function setup() {
  // Health check
  const healthRes = http.get(`${config.urls.analyticsService}/health`);
  check(healthRes, {
    'analytics health check passed': (r) => r.status === 200,
  });

  // Register a test user to get JWT token for endpoints that require auth
  const testUser = {
    email: `analytics-loadtest-${Date.now()}@example.com`,
    password: 'loadtest123',
    name: 'Analytics Load Test User',
  };

  let authToken = null;
  const registerRes = http.post(
    `${config.urls.userService}/api/auth/register`,
    JSON.stringify(testUser),
    { headers: { 'Content-Type': 'application/json' } }
  );

  if (registerRes.status === 201) {
    authToken = registerRes.json('token');
  }

  return {
    baseUrl: config.urls.analyticsService,
    startTime: Date.now(),
    authToken,
  };
}

export default function (data) {
  const { baseUrl, authToken } = data;
  const shortCode = testShortCodes[Math.floor(Math.random() * testShortCodes.length)];

  // Headers for authenticated user requests
  const authHeaders = authToken
    ? { Authorization: `Bearer ${authToken}` }
    : internalHeaders;

  group('Analytics Service Load Test', () => {
    // 60% - Track clicks
    if (Math.random() < 0.6) {
      group('Track Click', () => {
        const payload = JSON.stringify({
          short_code: shortCode,
          original_url: `https://example.com/${shortCode}`,
        });

        const startTime = Date.now();
        const res = http.post(`${baseUrl}/api/analytics/track`, payload, {
          headers: {
            ...internalHeaders,
            'User-Agent': randomUserAgent(),
            'X-Forwarded-For': randomIP(),
          },
        });
        const duration = Date.now() - startTime;
        trackingDuration.add(duration);

        const success = check(res, {
          'click tracked': (r) => r.status === 201,
          'has clickId': (r) => r.json('clickId') !== undefined,
        });

        trackingErrors.add(!success);
      });
    }

    // 25% - Get stats
    if (Math.random() < 0.25) {
      group('Get Stats', () => {
        const startTime = Date.now();
        const res = http.get(`${baseUrl}/api/analytics/${shortCode}`, {
          headers: internalHeaders,
        });
        const duration = Date.now() - startTime;
        statsDuration.add(duration);

        const success = check(res, {
          'stats retrieved': (r) => r.status === 200,
          'has totalClicks': (r) => r.json('totalClicks') !== undefined,
          'has last24Hours': (r) => r.json('last24Hours') !== undefined,
          'has last7Days': (r) => r.json('last7Days') !== undefined,
        });

        statsErrors.add(!success);
      });
    }

    // 10% - Get daily aggregation (requires JWT auth)
    if (Math.random() < 0.1 && authToken) {
      group('Get Daily Stats', () => {
        const res = http.get(`${baseUrl}/api/analytics/${shortCode}/daily?days=7`, {
          headers: authHeaders,
        });

        check(res, {
          'daily stats retrieved': (r) => r.status === 200,
          'has data array': (r) => Array.isArray(r.json('data')),
        });
      });
    }

    // 5% - Get geographic distribution (requires JWT auth)
    if (Math.random() < 0.05 && authToken) {
      group('Get Geo Stats', () => {
        const res = http.get(`${baseUrl}/api/analytics/${shortCode}/geo`, {
          headers: authHeaders,
        });

        check(res, {
          'geo stats retrieved': (r) => r.status === 200,
          'has countries': (r) => r.json('countries') !== undefined,
          'has cities': (r) => r.json('cities') !== undefined,
        });
      });
    }
  });

  // Random sleep
  sleep(0.3 + Math.random() * 0.7);
}

export function teardown(data) {
  console.log(`Analytics load test completed. Duration: ${(Date.now() - data.startTime) / 1000}s`);
}
