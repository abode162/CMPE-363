//Jest setup file for Analytics Service tests.
//Sets up MongoDB connection and test utilities.
const mongoose = require('mongoose');

// Use test database URL
const TEST_MONGO_URI =
  process.env.TEST_MONGO_URI || 'mongodb://localhost:27017/analytics_test';

// Connect to test database before all tests
beforeAll(async () => {
  try {
    await mongoose.connect(TEST_MONGO_URI);
    console.log('Connected to test MongoDB');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    throw error;
  }
});

// Clear all collections between tests
beforeEach(async () => {
  const collections = mongoose.connection.collections;
  for (const key in collections) {
    await collections[key].deleteMany({});
  }
});

// Disconnect after all tests
afterAll(async () => {
  await mongoose.connection.dropDatabase();
  await mongoose.connection.close();
});


global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  // Keep error for debugging
  error: console.error,
};
