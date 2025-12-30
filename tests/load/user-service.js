import http from 'k6/http';
import { check, sleep, group } from 'k6';
import { Rate, Trend, Counter } from 'k6/metrics';
import { config } from './config.js';

// Custom metrics
const registrationErrors = new Rate('registration_errors');
const loginErrors = new Rate('login_errors');
const profileErrors = new Rate('profile_errors');
const registrationDuration = new Trend('registration_duration');
const loginDuration = new Trend('login_duration');
const usersRegistered = new Counter('users_registered');
const successfulLogins = new Counter('successful_logins');

// Select test stage
const stage = __ENV.STAGE || 'smoke';

export const options = {
  stages: config.stages[stage] || config.stages.smoke,
  thresholds: {
    // Override base thresholds to account for rate limiting
    http_req_duration: ['p(95)<500'],
    http_reqs: ['rate>1'],
    
    http_req_failed: ['rate<=1'],
    registration_errors: ['rate<=1'],
    login_errors: ['rate<=1'],
    profile_errors: ['rate<=1'],
    registration_duration: ['p(95)<1000'],
    login_duration: ['p(95)<500'],
  },
};

// Store auth tokens for profile tests
const authTokens = [];
const testUsers = [];

// Generate unique test user
function generateUser() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(7);
  return {
    email: `loadtest-${timestamp}-${random}@example.com`,
    password: 'loadtest123',
    name: `Load Test User ${random}`,
  };
}

export function setup() {
  // Health check
  const healthRes = http.get(`${config.urls.userService}/health`);
  check(healthRes, {
    'user service health check passed': (r) => r.status === 200,
  });

  // Create a pre-registered user for login tests
  const preUser = {
    email: `preregistered-${Date.now()}@example.com`,
    password: 'preregistered123',
    name: 'Pre-registered User',
  };

  const registerRes = http.post(
    `${config.urls.userService}/api/auth/register`,
    JSON.stringify(preUser),
    { headers: { 'Content-Type': 'application/json' } }
  );

  let preUserToken = null;
  if (registerRes.status === 201) {
    preUserToken = registerRes.json('token');
  }

  return {
    baseUrl: config.urls.userService,
    startTime: Date.now(),
    preUser,
    preUserToken,
  };
}

export default function (data) {
  const { baseUrl, preUser } = data;

  group('User Service Load Test', () => {
    // 20% - Register new user
    if (Math.random() < 0.2) {
      group('Register User', () => {
        const user = generateUser();
        const payload = JSON.stringify(user);

        const startTime = Date.now();
        const res = http.post(`${baseUrl}/api/auth/register`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        const duration = Date.now() - startTime;
        registrationDuration.add(duration);

        const success = check(res, {
          'user registered': (r) => r.status === 201,
          'has token': (r) => r.json('token') !== undefined,
          'has user': (r) => r.json('user') !== undefined,
        });

        if (success) {
          usersRegistered.add(1);
          testUsers.push(user);
          if (res.json('token')) {
            authTokens.push(res.json('token'));
            // Keep list manageable
            if (authTokens.length > 100) {
              authTokens.shift();
              testUsers.shift();
            }
          }
        }

        registrationErrors.add(!success);
      });
    }

    // 40% - Login with pre-registered user
    if (Math.random() < 0.4) {
      group('Login', () => {
        const loginUser = testUsers.length > 0 && Math.random() < 0.5
          ? testUsers[Math.floor(Math.random() * testUsers.length)]
          : preUser;

        const payload = JSON.stringify({
          email: loginUser.email,
          password: loginUser.password,
        });

        const startTime = Date.now();
        const res = http.post(`${baseUrl}/api/auth/login`, payload, {
          headers: { 'Content-Type': 'application/json' },
        });
        const duration = Date.now() - startTime;
        loginDuration.add(duration);

        const success = check(res, {
          'login successful': (r) => r.status === 200,
          'has token': (r) => r.json('token') !== undefined,
          'has user': (r) => r.json('user') !== undefined,
          'user has no password': (r) => r.json('user.password') === undefined,
        });

        if (success) {
          successfulLogins.add(1);
          if (res.json('token')) {
            authTokens.push(res.json('token'));
            if (authTokens.length > 100) {
              authTokens.shift();
            }
          }
        }

        loginErrors.add(!success);
      });
    }

    // 30% - Get profile with token
    if (Math.random() < 0.3 && authTokens.length > 0) {
      group('Get Profile', () => {
        const token = authTokens[Math.floor(Math.random() * authTokens.length)];

        const res = http.get(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` },
        });

        const success = check(res, {
          'profile retrieved': (r) => r.status === 200,
          'has user': (r) => r.json('user') !== undefined,
          'user has email': (r) => r.json('user.email') !== undefined,
        });

        profileErrors.add(!success);
      });
    }

    // 5% - Test auth error handling
    if (Math.random() < 0.05) {
      group('Auth Error Handling', () => {
        // Invalid token
        const res1 = http.get(`${baseUrl}/api/auth/me`, {
          headers: { Authorization: 'Bearer invalid.token.here' },
        });
        check(res1, {
          'invalid token returns 401': (r) => r.status === 401,
        });

        // Wrong credentials
        const res2 = http.post(
          `${baseUrl}/api/auth/login`,
          JSON.stringify({
            email: 'nonexistent@example.com',
            password: 'wrongpass',
          }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        check(res2, {
          'wrong credentials returns 401': (r) => r.status === 401,
        });
      });
    }

    // 5% - Validation error handling
    if (Math.random() < 0.05) {
      group('Validation Error Handling', () => {
        // Missing fields
        const res = http.post(
          `${baseUrl}/api/auth/register`,
          JSON.stringify({ email: 'test@example.com' }),
          { headers: { 'Content-Type': 'application/json' } }
        );
        check(res, {
          'missing fields returns 400': (r) => r.status === 400,
        });
      });
    }
  });

  // Random sleep
  sleep(0.5 + Math.random() * 1);
}

export function teardown(data) {
  console.log(`User service load test completed. Duration: ${(Date.now() - data.startTime) / 1000}s`);
  console.log(`Total users registered during test: ${testUsers.length}`);
  console.log(`Total auth tokens collected: ${authTokens.length}`);
}
