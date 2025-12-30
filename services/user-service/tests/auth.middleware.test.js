//Unit tests for authentication middleware.

const jwt = require('jsonwebtoken');
const config = require('../src/config');
const User = require('../src/models/User');
const auth = require('../src/middleware/auth');

describe('Authentication Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;
  let testUser;

  beforeEach(async () => {
    // Create a test user before each test (since setup.js truncates tables)
    testUser = await User.create({
      email: 'middleware@example.com',
      password: 'password123',
      name: 'Middleware User',
    });

    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  it('should call next() with valid token', async () => {
    const token = jwt.sign({ userId: testUser.id }, config.jwt.secret);
    mockReq.headers.authorization = `Bearer ${token}`;

    await auth(mockReq, mockRes, mockNext);

    expect(mockNext).toHaveBeenCalled();
    expect(mockReq.user).toBeDefined();
    expect(mockReq.user.id).toBe(testUser.id);
    expect(mockReq.token).toBe(token);
  });

  it('should return 401 for missing authorization header', async () => {
    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for malformed authorization header', async () => {
    mockReq.headers.authorization = 'NotBearer token';

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'No token provided' });
    expect(mockNext).not.toHaveBeenCalled();
  });

  it('should return 401 for expired token', async () => {
    const token = jwt.sign({ userId: testUser.id }, config.jwt.secret, {
      expiresIn: '-1h',
    });
    mockReq.headers.authorization = `Bearer ${token}`;

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
  });

  it('should return 401 for invalid token', async () => {
    mockReq.headers.authorization = 'Bearer invalid.token.here';

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });

  it('should return 401 for token with wrong secret', async () => {
    const token = jwt.sign({ userId: testUser.id }, 'wrong-secret');
    mockReq.headers.authorization = `Bearer ${token}`;

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
  });

  it('should return 401 for non-existent user', async () => {
    // Use a valid UUID format that doesn't exist in the database
    const nonExistentUUID = '00000000-0000-0000-0000-000000000000';
    const token = jwt.sign({ userId: nonExistentUUID }, config.jwt.secret);
    mockReq.headers.authorization = `Bearer ${token}`;

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'User not found' });
  });

  it('should return 401 for token with "none" algorithm (security bypass attempt)', async () => {
    const header = Buffer.from(JSON.stringify({ alg: 'none', typ: 'JWT' })).toString('base64');
    const payload = Buffer.from(JSON.stringify({ userId: testUser.id })).toString('base64');
    const noneToken = `${header}.${payload}.`;
    mockReq.headers.authorization = `Bearer ${noneToken}`;

    await auth(mockReq, mockRes, mockNext);

    expect(mockRes.status).toHaveBeenCalledWith(401);
    expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
  });
});
