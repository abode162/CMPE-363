const mongoose = require('mongoose');

const clickSchema = new mongoose.Schema({
  shortCode: {
    type: String,
    required: true,
    index: true,
  },
  originalUrl: {
    type: String,
    required: true,
  },
  timestamp: {
    type: Date,
    default: Date.now,
    index: true,
  },
  userAgent: {
    type: String,
    default: null,
  },
  referer: {
    type: String,
    default: null,
  },
  ipAddress: {
    type: String,
    default: null,
  },
  // Geolocation fields
  country: {
    type: String,
    default: null,
    index: true,
  },
  countryCode: {
    type: String,
    default: null,
  },
  city: {
    type: String,
    default: null,
  },
  region: {
    type: String,
    default: null,
  },
  latitude: {
    type: Number,
    default: null,
  },
  longitude: {
    type: Number,
    default: null,
  },
  timezone: {
    type: String,
    default: null,
  },
});

// Compound indexes for efficient queries
clickSchema.index({ shortCode: 1, timestamp: -1 });
clickSchema.index({ shortCode: 1, country: 1 });

module.exports = mongoose.model('Click', clickSchema);
