import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend } from 'k6/metrics';
import { config } from './config.js';

// Custom metrics
const urlCreationErrors = new Rate('url_creation_errors');
const redirectErrors = new Rate('redirect_errors');
const urlCreationDuration = new Trend('url_creation_duration');
const redirectDuration = new Trend('redirect_duration');

// Select test stage from environment or default to smoke
const stage = __ENV.STAGE || 'smoke';

export const options = {
  stages: config.stages[stage] || config.stages.smoke,
  thresholds: {
    ...config.thresholds,
    url_creation_errors: ['rate<0.05'],
    redirect_errors: ['rate<0.01'],
    url_creation_duration: ['p(95)<1000'],
    redirect_duration: ['p(95)<200'],
  },
};

// Store created URLs for redirect tests
const createdUrls = [];

// Generate random test data
function randomUrl() {
  return `https://example.com/page/${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

function randomToken() {
  return `token-${Date.now()}-${Math.random().toString(36).substring(7)}`;
}

export function setup() {
  // Health check before starting
  const healthRes = http.get(`${config.urls.urlService}/health`);
  check(healthRes, {
    'health check passed': (r) => r.status === 200,
  });

  return {
    baseUrl: config.urls.urlService,
    startTime: Date.now(),
  };
}

export default function (data) {
  const { baseUrl } = data;

  group('URL Service Load Test', () => {
    // 40% - Create URL (guest)
    if (Math.random() < 0.4) {
      group('Create URL (Guest)', () => {
        const claimToken = randomToken();
        const payload = JSON.stringify({
          original_url: randomUrl(),
        });

        const startTime = Date.now();
        const res = http.post(`${baseUrl}/api/urls`, payload, {
          headers: {
            'Content-Type': 'application/json',
            'X-Guest-Claim-Token': claimToken,
          },
        });
        const duration = Date.now() - startTime;
        urlCreationDuration.add(duration);

        const success = check(res, {
          'URL created': (r) => r.status === 201,
          'has short_code': (r) => r.json('short_code') !== undefined,
          'has short_url': (r) => r.json('short_url') !== undefined,
        });

        urlCreationErrors.add(!success);

        if (success && res.json('short_code')) {
          createdUrls.push(res.json('short_code'));
          // Keep list manageable
          if (createdUrls.length > 1000) {
            createdUrls.shift();
          }
        }
      });
    }

    // 40% - Redirect
    if (Math.random() < 0.4 && createdUrls.length > 0) {
      group('Redirect', () => {
        const shortCode = createdUrls[Math.floor(Math.random() * createdUrls.length)];

        const startTime = Date.now();
        const res = http.get(`${baseUrl}/${shortCode}`, {
          redirects: 0,
        });
        const duration = Date.now() - startTime;
        redirectDuration.add(duration);

        const success = check(res, {
          'redirect status': (r) => r.status === 307,
          'has location': (r) => r.headers['Location'] !== undefined,
        });

        redirectErrors.add(!success);
      });
    }

    // 15% - Get URL info
    if (Math.random() < 0.15 && createdUrls.length > 0) {
      group('Get URL Info', () => {
        const shortCode = createdUrls[Math.floor(Math.random() * createdUrls.length)];

        const res = http.get(`${baseUrl}/api/urls/${shortCode}`);

        check(res, {
          'info retrieved': (r) => r.status === 200,
          'has click_count': (r) => r.json('click_count') !== undefined,
        });
      });
    }

    // 5% - Get non-existent URL
    if (Math.random() < 0.05) {
      group('Get Non-existent URL', () => {
        const res = http.get(`${baseUrl}/nonexistent123`);

        check(res, {
          'returns 404': (r) => r.status === 404,
        });
      });
    }
  });

  // Random sleep between requests
  sleep(0.5 + Math.random() * 1.5);
}

export function teardown(data) {
  console.log(`Load test completed. Duration: ${(Date.now() - data.startTime) / 1000}s`);
  console.log(`URLs created during test: ${createdUrls.length}`);
}
