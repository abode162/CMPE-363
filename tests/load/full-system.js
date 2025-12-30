import http from 'k6/http';
import { check, sleep, group, fail } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config } from './config.js';

// Custom metrics
const overallErrorRate = new Rate('overall_error_rate');
const urlsCreated = new Counter('urls_created');
const redirectsPerformed = new Counter('redirects_performed');
const e2eDuration = new Trend('e2e_journey_duration');

// Select test stage
const stage = __ENV.STAGE || 'smoke';

export const options = {
  stages: config.stages[stage] || config.stages.smoke,
  thresholds: {
    http_req_duration: ['p(95)<1000'],
    http_req_failed: ['rate<0.05'],
    overall_error_rate: ['rate<0.1'],
    e2e_journey_duration: ['p(95)<5000'],
  },
};

// Shared state
const userPool = [];
const urlPool = [];

function generateUser() {
  return {
    email: `user-${Date.now()}-${Math.random().toString(36).substring(7)}@test.com`,
    password: 'password123',
    name: `Test User ${Math.random().toString(36).substring(7)}`,
  };
}

function randomUrl() {
  return `https://example.com/page/${Math.random().toString(36).substring(7)}`;
}

export function setup() {
  // Verify all services are healthy
  const services = [
    { name: 'url-service', url: config.urls.urlService },
    { name: 'analytics-service', url: config.urls.analyticsService },
    { name: 'user-service', url: config.urls.userService },
  ];

  for (const service of services) {
    const res = http.get(`${service.url}/health`);
    const healthy = check(res, {
      [`${service.name} is healthy`]: (r) => r.status === 200,
    });
    if (!healthy) {
      fail(`${service.name} is not healthy`);
    }
  }

  return {
    startTime: Date.now(),
    urls: config.urls,
  };
}

export default function (data) {
  const { urls } = data;

  // Simulate different user journeys
  const journeyType = Math.random();

  if (journeyType < 0.3) {
    // 1: Guest creates URL and visits it (30%)
    guestJourney(urls);
  } else if (journeyType < 0.6) {
    // 2: Registered user creates URL and checks stats (30%)
    registeredUserJourney(urls);
  } else if (journeyType < 0.9) {
    // 3: Just visit existing URLs (30%)
    visitorJourney(urls);
  } else {
    // 4: Power user - creates multiple URLs, checks stats (10%)
    powerUserJourney(urls);
  }

  sleep(1 + Math.random() * 2);
}

function guestJourney(urls) {
  const journeyStart = Date.now();

  group('Guest Journey', () => {
    // Step 1: Create a short URL as guest
    const claimToken = `claim-${Date.now()}-${Math.random().toString(36).substring(7)}`;
    const createRes = http.post(
      `${urls.urlService}/api/urls`,
      JSON.stringify({ original_url: randomUrl() }),
      {
        headers: {
          'Content-Type': 'application/json',
          'X-Guest-Claim-Token': claimToken,
        },
      }
    );

    const created = check(createRes, {
      'guest URL created': (r) => r.status === 201,
    });

    if (created) {
      urlsCreated.add(1);
      const shortCode = createRes.json('short_code');

      if (shortCode) {
        urlPool.push(shortCode);
        if (urlPool.length > 500) urlPool.shift();

        // Step 2: Visit the short URL
        sleep(0.5);
        const redirectRes = http.get(`${urls.urlService}/${shortCode}`, {
          redirects: 0,
        });

        check(redirectRes, {
          'guest redirect works': (r) => r.status === 307,
        });

        if (redirectRes.status === 307) {
          redirectsPerformed.add(1);
        }

        // Step 3: Check URL info
        sleep(0.3);
        const infoRes = http.get(`${urls.urlService}/api/urls/${shortCode}`);
        check(infoRes, {
          'guest can view URL info': (r) => r.status === 200,
        });
      }
    }

    overallErrorRate.add(!created);
  });

  e2eDuration.add(Date.now() - journeyStart);
}

function registeredUserJourney(urls) {
  const journeyStart = Date.now();

  group('Registered User Journey', () => {
    let token = null;
    let user = null;

    // Try to reuse existing user or create new one
    if (userPool.length > 0 && Math.random() < 0.7) {
      // Reuse existing user
      user = userPool[Math.floor(Math.random() * userPool.length)];
      const loginRes = http.post(
        `${urls.userService}/api/auth/login`,
        JSON.stringify({ email: user.email, password: user.password }),
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (loginRes.status === 200) {
        token = loginRes.json('token');
      }
    }

    if (!token) {
      // Register new user
      user = generateUser();
      const registerRes = http.post(
        `${urls.userService}/api/auth/register`,
        JSON.stringify(user),
        { headers: { 'Content-Type': 'application/json' } }
      );

      if (registerRes.status === 201) {
        token = registerRes.json('token');
        userPool.push(user);
        if (userPool.length > 100) userPool.shift();
      }
    }

    if (token) {
      const authHeaders = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`,
      };

      // Create URL as authenticated user
      sleep(0.3);
      const createRes = http.post(
        `${urls.urlService}/api/urls`,
        JSON.stringify({ original_url: randomUrl() }),
        { headers: authHeaders }
      );

      const created = check(createRes, {
        'authenticated URL created': (r) => r.status === 201,
      });

      if (created) {
        urlsCreated.add(1);
        const shortCode = createRes.json('short_code');
        urlPool.push(shortCode);
        if (urlPool.length > 500) urlPool.shift();

        // View URL stats
        sleep(0.3);
        const infoRes = http.get(`${urls.urlService}/api/urls/${shortCode}`, {
          headers: authHeaders,
        });
        check(infoRes, {
          'can view own URL info': (r) => r.status === 200,
          'is marked as owner': (r) => r.json('is_owner') === true,
        });

        // List user's URLs
        sleep(0.3);
        const listRes = http.get(`${urls.urlService}/api/urls`, {
          headers: authHeaders,
        });
        check(listRes, {
          'can list URLs': (r) => r.status === 200,
          'list is array': (r) => Array.isArray(r.json()),
        });
      }

      overallErrorRate.add(!created);
    } else {
      overallErrorRate.add(true);
    }
  });

  e2eDuration.add(Date.now() - journeyStart);
}

function visitorJourney(urls) {
  const journeyStart = Date.now();

  group('Visitor Journey', () => {
    if (urlPool.length > 0) {
      const shortCode = urlPool[Math.floor(Math.random() * urlPool.length)];

      // Visit the URL
      const redirectRes = http.get(`${urls.urlService}/${shortCode}`, {
        redirects: 0,
      });

      const redirected = check(redirectRes, {
        'visitor redirect works': (r) => r.status === 307 || r.status === 404,
      });

      if (redirectRes.status === 307) {
        redirectsPerformed.add(1);
      }

      overallErrorRate.add(!redirected);
    }
  });

  e2eDuration.add(Date.now() - journeyStart);
}

function powerUserJourney(urls) {
  const journeyStart = Date.now();

  group('Power User Journey', () => {
    // Register/login
    const user = generateUser();
    const registerRes = http.post(
      `${urls.userService}/api/auth/register`,
      JSON.stringify(user),
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (registerRes.status !== 201) {
      overallErrorRate.add(true);
      return;
    }

    const token = registerRes.json('token');
    const authHeaders = {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${token}`,
    };

    userPool.push(user);
    if (userPool.length > 100) userPool.shift();

    // Create multiple URLs
    const createdCodes = [];
    for (let i = 0; i < 3; i++) {
      sleep(0.2);
      const createRes = http.post(
        `${urls.urlService}/api/urls`,
        JSON.stringify({ original_url: randomUrl() }),
        { headers: authHeaders }
      );

      if (createRes.status === 201) {
        urlsCreated.add(1);
        const shortCode = createRes.json('short_code');
        createdCodes.push(shortCode);
        urlPool.push(shortCode);
        if (urlPool.length > 500) urlPool.shift();
      }
    }

    // Simulate visitors clicking on URLs
    for (const code of createdCodes) {
      for (let i = 0; i < 2; i++) {
        sleep(0.1);
        const redirectRes = http.get(`${urls.urlService}/${code}`, {
          redirects: 0,
        });
        if (redirectRes.status === 307) {
          redirectsPerformed.add(1);
        }
      }
    }

    // Check analytics for each URL
    sleep(0.5);
    for (const code of createdCodes) {
      const statsRes = http.get(`${urls.analyticsService}/api/analytics/${code}`, {
        headers: { 'X-Internal-API-Key': config.internalApiKey },
      });
      check(statsRes, {
        'analytics has data': (r) => r.status === 200 && r.json('totalClicks') >= 0,
      });
    }

    // View dashboard
    sleep(0.3);
    const listRes = http.get(`${urls.urlService}/api/urls`, {
      headers: authHeaders,
    });
    check(listRes, {
      'power user can list all URLs': (r) => r.status === 200,
    });

    overallErrorRate.add(false);
  });

  e2eDuration.add(Date.now() - journeyStart);
}

export function teardown(data) {
  console.log('='.repeat(50));
  console.log('FULL SYSTEM LOAD TEST COMPLETED');
  console.log('='.repeat(50));
  console.log(`Duration: ${(Date.now() - data.startTime) / 1000}s`);
  console.log(`Users registered: ${userPool.length}`);
  console.log(`URLs in pool: ${urlPool.length}`);
  console.log('='.repeat(50));
}
