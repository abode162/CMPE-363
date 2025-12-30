// Comprehensive route tests for Analytics Service.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const createTestApp = require('./app');
const Click = require('../src/models/Click');
const config = require('../src/config');

// Mock geolocation to avoid needing actual database
jest.mock('../src/utils/geolocation', () => ({
  lookupIP: jest.fn(() => ({
    country: 'United States',
    countryCode: 'US',
    city: 'New York',
    region: 'NY',
    latitude: 40.7128,
    longitude: -74.006,
    timezone: 'America/New_York',
  })),
  isGeoIPAvailable: jest.fn(() => true),
  initGeoIP: jest.fn(() => Promise.resolve()),
}));

describe('Analytics Service Routes', () => {
  let app;
  let authToken;
  const testUserId = 'test-user-123';

  beforeAll(() => {
    app = createTestApp();
    // Generate a valid JWT token for testing
    authToken = jwt.sign({ userId: testUserId }, config.jwtSecret, {
      expiresIn: '1h',
    });
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'analytics-service');
      expect(response.body).toHaveProperty('version', '1.0.0');
      expect(response.body).toHaveProperty('geoipEnabled');
    });
  });

  describe('POST /api/analytics/track', () => {
    it('should track click with internal API key', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('X-Internal-API-Key', config.internalApiKey)
        .send({
          short_code: 'test123',
          original_url: 'https://example.com/test',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'Click tracked successfully');
      expect(response.body).toHaveProperty('clickId');

      // Verify click was saved
      const click = await Click.findById(response.body.clickId);
      expect(click).not.toBeNull();
      expect(click.shortCode).toBe('test123');
    });

    it('should track click with user auth token', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('Authorization', `Bearer ${authToken}`)
        .send({
          short_code: 'auth123',
          original_url: 'https://example.com/auth',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('clickId');
    });

    it('should return 400 when short_code is missing', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('X-Internal-API-Key', config.internalApiKey)
        .send({ original_url: 'https://example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 when original_url is missing', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('X-Internal-API-Key', config.internalApiKey)
        .send({ short_code: 'test123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .send({
          short_code: 'test123',
          original_url: 'https://example.com',
        });

      expect(response.status).toBe(401);
    });

    it('should capture geolocation data', async () => {
      const response = await request(app)
        .post('/api/analytics/track')
        .set('X-Internal-API-Key', config.internalApiKey)
        .set('X-Forwarded-For', '8.8.8.8')
        .send({
          short_code: 'geoloc',
          original_url: 'https://example.com/geo',
        });

      expect(response.status).toBe(201);

      const click = await Click.findById(response.body.clickId);
      expect(click.country).toBe('United States');
      expect(click.countryCode).toBe('US');
      expect(click.city).toBe('New York');
    });
  });

  describe('GET /api/analytics/:shortCode', () => {
    beforeEach(async () => {
      // Create test clicks
      await Click.create([
        {
          shortCode: 'stats123',
          originalUrl: 'https://example.com',
          timestamp: new Date(),
        },
        {
          shortCode: 'stats123',
          originalUrl: 'https://example.com',
          timestamp: new Date(Date.now() - 12 * 60 * 60 * 1000), // 12 hours ago
        },
        {
          shortCode: 'stats123',
          originalUrl: 'https://example.com',
          timestamp: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },
      ]);
    });

    it('should return stats with internal API key', async () => {
      const response = await request(app)
        .get('/api/analytics/stats123')
        .set('X-Internal-API-Key', config.internalApiKey);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shortCode', 'stats123');
      expect(response.body).toHaveProperty('totalClicks', 3);
      expect(response.body).toHaveProperty('last24Hours', 2);
      expect(response.body).toHaveProperty('last7Days', 3);
      expect(response.body).toHaveProperty('lastClickAt');
    });

    it('should return stats with user auth token', async () => {
      const response = await request(app)
        .get('/api/analytics/stats123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.totalClicks).toBe(3);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/analytics/stats123');

      expect(response.status).toBe(401);
    });

    it('should return 0 clicks for non-existent short code', async () => {
      const response = await request(app)
        .get('/api/analytics/nonexistent')
        .set('X-Internal-API-Key', config.internalApiKey);

      expect(response.status).toBe(200);
      expect(response.body.totalClicks).toBe(0);
    });
    it('should handle database errors gracefully (return 500)', async () => {
      // Mock the Click model to simulate a DB crash
      // Need to mock the query chain: findOne().sort().select()
      const mockQuery = {
        sort: jest.fn().mockReturnValue({
          select: jest.fn().mockRejectedValue(new Error('DB Connection Lost'))
        })
      };
      const findSpy = jest.spyOn(Click, 'findOne').mockReturnValue(mockQuery);

      const response = await request(app)
        .get('/api/analytics/stats123')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Failed to get stats');
      findSpy.mockRestore();
    });
  });

  describe('GET /api/analytics/:shortCode/history', () => {
    beforeEach(async () => {
      // Create 15 test clicks
      const clicks = Array.from({ length: 15 }, (_, i) => ({
        shortCode: 'history123',
        originalUrl: 'https://example.com',
        timestamp: new Date(Date.now() - i * 60 * 60 * 1000),
        userAgent: `TestAgent/${i}`,
        country: 'United States',
        city: 'New York',
      }));
      await Click.create(clicks);
    });

    it('should return click history with pagination', async () => {
      const response = await request(app)
        .get('/api/analytics/history123/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 0 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shortCode', 'history123');
      expect(response.body).toHaveProperty('total', 15);
      expect(response.body).toHaveProperty('limit', 10);
      expect(response.body).toHaveProperty('offset', 0);
      expect(response.body.clicks).toHaveLength(10);
    });

    it('should return second page with offset', async () => {
      const response = await request(app)
        .get('/api/analytics/history123/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 10, offset: 10 });

      expect(response.status).toBe(200);
      expect(response.body.clicks).toHaveLength(5);
      expect(response.body.offset).toBe(10);
    });

    it('should cap limit at 100', async () => {
      const response = await request(app)
        .get('/api/analytics/history123/history')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ limit: 200 });

      expect(response.status).toBe(200);
      expect(response.body.limit).toBe(100);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get(
        '/api/analytics/history123/history'
      );

      expect(response.status).toBe(401);
    });

    it('should not accept internal API key (requires user auth)', async () => {
      const response = await request(app)
        .get('/api/analytics/history123/history')
        .set('X-Internal-API-Key', config.internalApiKey);

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/:shortCode/daily', () => {
    beforeEach(async () => {
      // Create clicks spread over multiple days
      const clicks = [];
      for (let day = 0; day < 10; day++) {
        for (let click = 0; click < 5 - Math.floor(day / 3); click++) {
          clicks.push({
            shortCode: 'daily123',
            originalUrl: 'https://example.com',
            timestamp: new Date(Date.now() - day * 24 * 60 * 60 * 1000),
          });
        }
      }
      await Click.create(clicks);
    });

    it('should return daily aggregation', async () => {
      const response = await request(app)
        .get('/api/analytics/daily123/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 7 });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shortCode', 'daily123');
      expect(response.body).toHaveProperty('days', 7);
      expect(response.body).toHaveProperty('data');
      expect(Array.isArray(response.body.data)).toBe(true);

      // Each data point should have date and clicks
      response.body.data.forEach((point) => {
        expect(point).toHaveProperty('date');
        expect(point).toHaveProperty('clicks');
        expect(typeof point.clicks).toBe('number');
      });
    });

    it('should cap days at 90', async () => {
      const response = await request(app)
        .get('/api/analytics/daily123/daily')
        .set('Authorization', `Bearer ${authToken}`)
        .query({ days: 200 });

      expect(response.status).toBe(200);
      expect(response.body.days).toBe(90);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/analytics/daily123/daily');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/analytics/:shortCode/geo', () => {
    beforeEach(async () => {
      // Create clicks from different countries
      await Click.create([
        {
          shortCode: 'geo123',
          originalUrl: 'https://example.com',
          country: 'United States',
          countryCode: 'US',
          city: 'New York',
        },
        {
          shortCode: 'geo123',
          originalUrl: 'https://example.com',
          country: 'United States',
          countryCode: 'US',
          city: 'Los Angeles',
        },
        {
          shortCode: 'geo123',
          originalUrl: 'https://example.com',
          country: 'Germany',
          countryCode: 'DE',
          city: 'Berlin',
        },
        {
          shortCode: 'geo123',
          originalUrl: 'https://example.com',
          country: null, // No location data
          city: null,
        },
      ]);
    });

    it('should return geographic distribution', async () => {
      const response = await request(app)
        .get('/api/analytics/geo123/geo')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('shortCode', 'geo123');
      expect(response.body).toHaveProperty('totalClicks', 4);
      expect(response.body).toHaveProperty('totalWithLocation', 3);
      expect(response.body).toHaveProperty('countries');
      expect(response.body).toHaveProperty('cities');

      // Check countries data
      const usCountry = response.body.countries.find(
        (c) => c.countryCode === 'US'
      );
      expect(usCountry).toBeDefined();
      expect(usCountry.clicks).toBe(2);
    });

    it('should return 401 without authentication', async () => {
      const response = await request(app).get('/api/analytics/geo123/geo');

      expect(response.status).toBe(401);
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('analytics_');
    });
  });
});

describe('Authentication Middleware', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  it('should reject expired token', async () => {
    const expiredToken = jwt.sign(
      { userId: 'test' },
      config.jwtSecret,
      { expiresIn: '-1h' }
    );

    const response = await request(app)
      .get('/api/analytics/test/history')
      .set('Authorization', `Bearer ${expiredToken}`);

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('expired');
  });

  it('should reject invalid token', async () => {
    const response = await request(app)
      .get('/api/analytics/test/history')
      .set('Authorization', 'Bearer invalid.token.here');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Invalid');
  });

  it('should reject malformed authorization header', async () => {
    const response = await request(app)
      .get('/api/analytics/test/history')
      .set('Authorization', 'NotBearer token');

    expect(response.status).toBe(401);
    expect(response.body.error).toContain('Authentication required');
  });
});
