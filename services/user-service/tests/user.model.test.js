//Unit tests for User model.

const User = require('../src/models/User');

describe('User Model', () => {
  describe('Creation', () => {
    it('should create user with valid data', async () => {
      const user = await User.create({
        email: 'model@example.com',
        password: 'password123',
        name: 'Model User',
      });

      expect(user).toBeDefined();
      expect(user.id).toBeDefined();
      expect(user.email).toBe('model@example.com');
      expect(user.name).toBe('Model User');
    });

    it('should auto-generate UUID', async () => {
      const user = await User.create({
        email: 'uuid@example.com',
        password: 'password123',
        name: 'UUID User',
      });

      // UUID v4 format: xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
      expect(user.id).toMatch(uuidRegex);
    });

    it('should add timestamps', async () => {
      const user = await User.create({
        email: 'timestamps@example.com',
        password: 'password123',
        name: 'Timestamps User',
      });

      expect(user.createdAt).toBeDefined();
      expect(user.updatedAt).toBeDefined();
    });
  });

  describe('Password Hashing', () => {
    it('should hash password on creation', async () => {
      const plainPassword = 'password123';
      const user = await User.create({
        email: 'hash@example.com',
        password: plainPassword,
        name: 'Hash User',
      });

      expect(user.password).not.toBe(plainPassword);
      expect(user.password.startsWith('$2')).toBe(true); 
    });

    it('should hash password on update', async () => {
      const user = await User.create({
        email: 'update@example.com',
        password: 'password123',
        name: 'Update User',
      });

      const originalHash = user.password;

      user.password = 'newpassword456';
      await user.save();

      expect(user.password).not.toBe('newpassword456');
      expect(user.password).not.toBe(originalHash);
      expect(user.password.startsWith('$2')).toBe(true);
    });
  });

  describe('comparePassword', () => {
    it('should return true for correct password', async () => {
      const user = await User.create({
        email: 'compare@example.com',
        password: 'password123',
        name: 'Compare User',
      });

      const isMatch = await user.comparePassword('password123');
      expect(isMatch).toBe(true);
    });

    it('should return false for incorrect password', async () => {
      const user = await User.create({
        email: 'wrong@example.com',
        password: 'password123',
        name: 'Wrong User',
      });

      const isMatch = await user.comparePassword('wrongpassword');
      expect(isMatch).toBe(false);
    });

    it('should return false for empty password', async () => {
      const user = await User.create({
        email: 'empty@example.com',
        password: 'password123',
        name: 'Empty User',
      });

      const isMatch = await user.comparePassword('');
      expect(isMatch).toBe(false);
    });
  });

  describe('toJSON', () => {
    it('should exclude password from JSON output', async () => {
      const user = await User.create({
        email: 'json@example.com',
        password: 'password123',
        name: 'JSON User',
      });

      const json = user.toJSON();

      expect(json).toHaveProperty('id');
      expect(json).toHaveProperty('email', 'json@example.com');
      expect(json).toHaveProperty('name', 'JSON User');
      expect(json).not.toHaveProperty('password');
    });

    it('should include timestamps in JSON', async () => {
      const user = await User.create({
        email: 'timestamps2@example.com',
        password: 'password123',
        name: 'Timestamps User',
      });

      const json = user.toJSON();

      expect(json).toHaveProperty('createdAt');
      expect(json).toHaveProperty('updatedAt');
    });
  });

  describe('Validation', () => {
    it('should reject invalid email format', async () => {
      await expect(
        User.create({
          email: 'invalid-email',
          password: 'password123',
          name: 'Invalid User',
        })
      ).rejects.toThrow();
    });

    it('should reject null email', async () => {
      await expect(
        User.create({
          email: null,
          password: 'password123',
          name: 'Null User',
        })
      ).rejects.toThrow();
    });

    it('should reject null password', async () => {
      await expect(
        User.create({
          email: 'null@example.com',
          password: null,
          name: 'Null Password User',
        })
      ).rejects.toThrow();
    });

    it('should reject null name', async () => {
      await expect(
        User.create({
          email: 'nullname@example.com',
          password: 'password123',
          name: null,
        })
      ).rejects.toThrow();
    });

    it('should reject duplicate email', async () => {
      await User.create({
        email: 'duplicate@example.com',
        password: 'password123',
        name: 'First User',
      });
      

      await expect(
        User.create({
          email: 'duplicate@example.com',
          password: 'password456',
          name: 'Second User',
        })
      ).rejects.toThrow();
    });
  });
});
