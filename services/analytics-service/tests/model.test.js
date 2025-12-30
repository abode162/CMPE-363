// Unit tests for the Click Mongoose Model, Verifies schema validation rules, default values, and data integrity

const mongoose = require('mongoose');
const Click = require('../src/models/Click');

describe('Click Model Validation', () => {
  
  it('should validate a valid click instance', () => {
    const validClick = new Click({
      shortCode: 'valid-code-123',
      originalUrl: 'https://example.com/test',
      userAgent: 'Mozilla/5.0 (Test Agent)',
      ipAddress: '127.0.0.1'
    });

    const err = validClick.validateSync();
    expect(err).toBeUndefined();
  });

  it('should require shortCode field', () => {
    const click = new Click({
      originalUrl: 'https://example.com',
    });

    const err = click.validateSync();
    expect(err.errors.shortCode).toBeDefined();
    expect(err.errors.shortCode.kind).toBe('required');
  });

  it('should require originalUrl field', () => {
    const click = new Click({
      shortCode: 'test-code',
    });

    const err = click.validateSync();
    expect(err.errors.originalUrl).toBeDefined();
    expect(err.errors.originalUrl.kind).toBe('required');
  });

  it('should set default timestamp if not provided', () => {
    const click = new Click({
      shortCode: 'default-time-test',
      originalUrl: 'https://example.com',
    });

    
    expect(click.timestamp).toBeDefined();
    expect(click.timestamp).toBeInstanceOf(Date);
    
    // Should be close to "now" (within 1 second)
    const now = new Date().getTime();
    const clickTime = click.timestamp.getTime();
    expect(now - clickTime).toBeLessThan(1000);
  });

  it('should accept optional fields (geo data)', () => {
    const click = new Click({
      shortCode: 'geo-test',
      originalUrl: 'https://example.com',
      country: 'United States',
      city: 'San Francisco'
    });

    const err = click.validateSync();
    expect(err).toBeUndefined();
    expect(click.country).toBe('United States');
  });
});