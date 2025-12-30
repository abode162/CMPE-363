// route tests for User Service authentication.
const request = require('supertest');
const jwt = require('jsonwebtoken');
const createTestApp = require('./app');
const User = require('../src/models/User');
const config = require('../src/config');

describe('User Service Routes', () => {
  let app;

  beforeAll(() => {
    app = createTestApp();
  });

  describe('GET /health', () => {
    it('should return healthy status', async () => {
      const response = await request(app).get('/health');

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('status', 'healthy');
      expect(response.body).toHaveProperty('service', 'user-service');
      expect(response.body).toHaveProperty('version', '1.0.0');
    });
  });

  describe('POST /api/auth/register', () => {
    it('should register a new user', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(201);
      expect(response.body).toHaveProperty('message', 'User registered successfully');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'test@example.com');
      expect(response.body.user).toHaveProperty('name', 'Test User');
      expect(response.body.user).not.toHaveProperty('password'); // Password excluded
    });

    it('should hash the password', async () => {
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'hash@example.com',
          password: 'password123',
          name: 'Hash User',
        });

      const user = await User.findOne({ where: { email: 'hash@example.com' } });
      expect(user.password).not.toBe('password123');
      expect(user.password.startsWith('$2')).toBe(true); // bcrypt hash
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          password: 'password123',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing name', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for short password', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'test@example.com',
          password: '12345',
          name: 'Test User',
        });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('6 characters');
    });

    it('should return 409 for duplicate email', async () => {
      // First registration
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password123',
          name: 'First User',
        });

      // Second registration with same email
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'duplicate@example.com',
          password: 'password456',
          name: 'Second User',
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already registered');
    });

    it('should generate valid JWT token', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'jwt@example.com',
          password: 'password123',
          name: 'JWT User',
        });

      expect(response.status).toBe(201);

      const decoded = jwt.verify(response.body.token, config.jwt.secret);
      expect(decoded).toHaveProperty('userId');
      expect(decoded.userId).toBe(response.body.user.id);
    });
  });

  describe('POST /api/auth/login', () => {
    beforeEach(async () => {
      // Create a test user for login tests
      await request(app)
        .post('/api/auth/register')
        .send({
          email: 'login@example.com',
          password: 'password123',
          name: 'Login User',
        });
    });

    it('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(200);
      expect(response.body).toHaveProperty('message', 'Login successful');
      expect(response.body).toHaveProperty('token');
      expect(response.body.user).toHaveProperty('email', 'login@example.com');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 400 for missing email', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ password: 'password123' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 400 for missing password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({ email: 'login@example.com' });

      expect(response.status).toBe(400);
      expect(response.body.error).toContain('required');
    });

    it('should return 401 for non-existent user', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'nonexistent@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should return 401 for wrong password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'wrongpassword',
        });

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid credentials');
    });

    it('should generate valid JWT token on login', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      const decoded = jwt.verify(response.body.token, config.jwt.secret);
      expect(decoded).toHaveProperty('userId');
      expect(decoded.userId).toBe(response.body.user.id);
    });
    it('should return 500 if database fails during login', async () => {
      const findSpy = jest.spyOn(User, 'findOne').mockRejectedValue(new Error('DB Connection Lost'));

      const response = await request(app)
        .post('/api/auth/login')
        .send({
          email: 'login@example.com',
          password: 'password123',
        });

      expect(response.status).toBe(500);
      expect(response.body).toHaveProperty('error', 'Login failed');

      findSpy.mockRestore();
    });
  });

  describe('GET /api/auth/me', () => {
    let authToken;
    let userId;

    beforeEach(async () => {
      // Create and login a test user
      const registerResponse = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'me@example.com',
          password: 'password123',
          name: 'Me User',
        });

      authToken = registerResponse.body.token;
      userId = registerResponse.body.user.id;
    });

    it('should return current user profile', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(200);
      expect(response.body.user).toHaveProperty('id', userId);
      expect(response.body.user).toHaveProperty('email', 'me@example.com');
      expect(response.body.user).toHaveProperty('name', 'Me User');
      expect(response.body.user).not.toHaveProperty('password');
    });

    it('should return 401 without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('No token');
    });

    it('should return 401 for invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('Invalid token');
    });

    it('should return 401 for expired token', async () => {
      const expiredToken = jwt.sign(
        { userId },
        config.jwt.secret,
        { expiresIn: '-1h' }
      );

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${expiredToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('expired');
    });

    it('should return 401 for malformed authorization header', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'NotBearer token');

      expect(response.status).toBe(401);
    });

    it('should return 401 for deleted user', async () => {
      // Delete the user
      await User.destroy({ where: { id: userId } });

      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${authToken}`);

      expect(response.status).toBe(401);
      expect(response.body.error).toContain('User not found');
    });
  });

  describe('GET /metrics', () => {
    it('should return Prometheus metrics', async () => {
      const response = await request(app).get('/metrics');

      expect(response.status).toBe(200);
      expect(response.headers['content-type']).toContain('text/plain');
      expect(response.text).toContain('user_');
    });
  });
});
