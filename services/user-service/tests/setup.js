
 //Jest setup file for User Service tests.
//Sets up PostgreSQL connection and test utilities.

const { sequelize } = require('../src/db');

// Connect to test database before all tests
beforeAll(async () => {
  try {
    await sequelize.authenticate();
    // Drop and recreate all tables
    await sequelize.drop();
    await sequelize.sync({ force: true });
    console.log('Connected to test PostgreSQL');
  } catch (error) {
    console.error('PostgreSQL connection error:', error);
    throw error;
  }
});

// Clear all tables between tests 
beforeEach(async () => {
  try {
    const models = Object.values(sequelize.models);
    for (const model of models) {
      await model.destroy({ where: {}, truncate: true, cascade: true });
    }
  } catch (error) {
  }
});

// Close connection after all tests
afterAll(async () => {
  try {
    await sequelize.close();
  } catch (error) {
  }
});

// Suppress console.log during tests
global.console = {
  ...console,
  log: jest.fn(),
  debug: jest.fn(),
  info: jest.fn(),
  warn: jest.fn(),
  error: console.error,
};
