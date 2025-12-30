//Unit tests for authentication middleware.
const jwt = require('jsonwebtoken');
const config = require('../src/config');
const {
  verifyInternalApiKey,
  requireAuth,
  optionalAuth,
  allowInternalService,
} = require('../src/middleware/auth');

describe('Authentication Middleware', () => {
  let mockReq;
  let mockRes;
  let mockNext;

  beforeEach(() => {
    mockReq = {
      headers: {},
    };
    mockRes = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn().mockReturnThis(),
    };
    mockNext = jest.fn();
  });

  describe('verifyInternalApiKey', () => {
    it('should return true for valid API key', () => {
      mockReq.headers['x-internal-api-key'] = config.internalApiKey;
      expect(verifyInternalApiKey(mockReq)).toBe(true);
    });

    it('should return false for invalid API key', () => {
      mockReq.headers['x-internal-api-key'] = 'wrong-key';
      expect(verifyInternalApiKey(mockReq)).toBe(false);
    });

    it('should return false for missing API key', () => {
      // verifyInternalApiKey returns falsy (undefined) when key is missing
      expect(verifyInternalApiKey(mockReq)).toBeFalsy();
    });
  });

  describe('requireAuth', () => {
    it('should call next() with valid token', () => {
      const token = jwt.sign({ userId: 'user123' }, config.jwtSecret);
      mockReq.headers.authorization = `Bearer ${token}`;

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ userId: 'user123' });
    });

    it('should return 401 for missing authorization header', () => {
      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({
        error: 'Authentication required',
      });
      expect(mockNext).not.toHaveBeenCalled();
    });

    it('should return 401 for malformed authorization header', () => {
      mockReq.headers.authorization = 'NotBearer token';

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });

    it('should return 401 for expired token', () => {
      const token = jwt.sign({ userId: 'user123' }, config.jwtSecret, {
        expiresIn: '-1h',
      });
      mockReq.headers.authorization = `Bearer ${token}`;

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Token expired' });
    });

    it('should return 401 for invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid.token.here';

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
      expect(mockRes.json).toHaveBeenCalledWith({ error: 'Invalid token' });
    });

    it('should return 401 for token with wrong secret', () => {
      const token = jwt.sign({ userId: 'user123' }, 'wrong-secret');
      mockReq.headers.authorization = `Bearer ${token}`;

      requireAuth(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
  });

  describe('optionalAuth', () => {
    it('should set user for valid token', () => {
      const token = jwt.sign({ userId: 'user123' }, config.jwtSecret);
      mockReq.headers.authorization = `Bearer ${token}`;

      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ userId: 'user123' });
    });

    it('should set user to null for missing token', () => {
      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });

    it('should set user to null for invalid token', () => {
      mockReq.headers.authorization = 'Bearer invalid.token';

      optionalAuth(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toBeNull();
    });
  });

  describe('allowInternalService', () => {
    it('should call next() for valid internal API key', () => {
      mockReq.headers['x-internal-api-key'] = config.internalApiKey;

      allowInternalService(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.isInternalService).toBe(true);
    });

    it('should fall back to requireAuth for missing API key', () => {
      const token = jwt.sign({ userId: 'user123' }, config.jwtSecret);
      mockReq.headers.authorization = `Bearer ${token}`;

      allowInternalService(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ userId: 'user123' });
    });

    it('should return 401 for invalid API key and no auth token', () => {
      mockReq.headers['x-internal-api-key'] = 'wrong-key';

      allowInternalService(mockReq, mockRes, mockNext);

      expect(mockRes.status).toHaveBeenCalledWith(401);
    });
    it('should allow access with invalid internal key but VALID auth token', () => {
      mockReq.headers['x-internal-api-key'] = 'wrong-key';
      const token = jwt.sign({ userId: 'user123' }, config.jwtSecret);
      mockReq.headers.authorization = `Bearer ${token}`;

      allowInternalService(mockReq, mockRes, mockNext);

      expect(mockNext).toHaveBeenCalled();
      expect(mockReq.user).toEqual({ userId: 'user123' });
    });
  });
});
