//Geolocation utility using MaxMind GeoLite2.
const fs = require('fs');
const path = require('path');
const config = require('../config');

let Reader;
let reader = null;
let isInitialized = false;


 //Initialize the GeoIP reader.
const initGeoIP = async () => {
  try {
    // Dynamically import maxmind
    const maxmind = await import('@maxmind/geoip2-node');
    Reader = maxmind.Reader;

    // Check if database file exists
    if (fs.existsSync(config.geoipDbPath)) {
      reader = await Reader.open(config.geoipDbPath);
      isInitialized = true;
      console.log('GeoIP database loaded successfully');
    } else {
      console.warn(`GeoIP database not found at ${config.geoipDbPath}`);
      console.warn('Geolocation will be disabled. Download GeoLite2-City.mmdb from MaxMind.');
      isInitialized = true; 
    }
  } catch (error) {
    console.error('Failed to initialize GeoIP:', error.message);
    isInitialized = true; 
  }
};

/**
 * Look up location for an IP address.
 * * * @param {string} ipAddress - The IP address to look up
 * @returns {Object} Location data or null if not found
 */

const lookupIP = (ipAddress) => {
  if (!reader || !ipAddress) {
    return null;
  }

  // Skip private/local IP addresses
  if (isPrivateIP(ipAddress)) {
    return null;
  }

  try {
    const response = reader.city(ipAddress);

    return {
      country: response.country?.names?.en || null,
      countryCode: response.country?.isoCode || null,
      city: response.city?.names?.en || null,
      region: response.subdivisions?.[0]?.names?.en || null,
      latitude: response.location?.latitude || null,
      longitude: response.location?.longitude || null,
      timezone: response.location?.timeZone || null,
    };
  } catch (error) {
    // IP not found in database (common for internal IPs)
    if (error.name !== 'AddressNotFoundError') {
      console.warn(`GeoIP lookup error for ${ipAddress}:`, error.message);
    }
    return null;
  }
};


const isPrivateIP = (ip) => {
  if (!ip) return true;

  // IPv4 private ranges
  const privateRanges = [
    /^10\./,
    /^172\.(1[6-9]|2[0-9]|3[0-1])\./,
    /^192\.168\./,
    /^127\./,
    /^localhost$/i,
    /^::1$/,
    /^fe80:/i,
  ];

  return privateRanges.some((regex) => regex.test(ip));
};


// Check if GeoIP is available.
const isGeoIPAvailable = () => {
  return reader !== null;
};

module.exports = {
  initGeoIP,
  lookupIP,
  isGeoIPAvailable,
};
