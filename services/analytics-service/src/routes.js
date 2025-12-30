//Analytics Service API routes
const express = require('express');
const Click = require('./models/Click');
const { allowInternalService, requireAuth, optionalAuth } = require('./middleware/auth');
const { apiLimiter, trackLimiter } = require('./middleware/rateLimit');
const { lookupIP, isGeoIPAvailable } = require('./utils/geolocation');
const {
  eventsTrackedTotal,
  queriesTotal,
  eventsByCountry,
  eventsByBrowser,
  eventsByDevice,
  processingDuration,
  parseBrowser,
  parseDevice,
} = require('./metrics');

const router = express.Router();

// Health check
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    service: 'analytics-service',
    version: '1.0.0',
    geoipEnabled: isGeoIPAvailable(),
  });
});

//Track a click event.
router.post('/api/analytics/track', allowInternalService, trackLimiter, async (req, res) => {
  const startTime = process.hrtime();

  try {
    const { short_code, original_url } = req.body;

    if (!short_code || !original_url) {
      return res.status(400).json({ error: 'short_code and original_url are required' });
    }

    // Get IP address
    const ipAddress = req.ip || req.headers['x-forwarded-for']?.split(',')[0] || null;

    // Lookup geolocation
    const geoData = lookupIP(ipAddress);

    const userAgent = req.headers['user-agent'] || null;

    const click = new Click({
      shortCode: short_code,
      originalUrl: original_url,
      userAgent: userAgent,
      referer: req.headers['referer'] || null,
      ipAddress: ipAddress,
      // Geolocation data
      country: geoData?.country || null,
      countryCode: geoData?.countryCode || null,
      city: geoData?.city || null,
      region: geoData?.region || null,
      latitude: geoData?.latitude || null,
      longitude: geoData?.longitude || null,
      timezone: geoData?.timezone || null,
    });

    await click.save();

    // Track metrics
    eventsTrackedTotal.inc();

    // Track by country
    if (geoData?.country) {
      eventsByCountry.labels(geoData.country).inc();
    }

    // Track by browser
    const browser = parseBrowser(userAgent);
    eventsByBrowser.labels(browser).inc();

    // Track by device
    const device = parseDevice(userAgent);
    eventsByDevice.labels(device).inc();

    // Record processing duration
    const duration = process.hrtime(startTime);
    const durationSeconds = duration[0] + duration[1] / 1e9;
    processingDuration.observe(durationSeconds);

    res.status(201).json({
      message: 'Click tracked successfully',
      clickId: click._id,
    });
  } catch (error) {
    console.error('Error tracking click:', error);
    res.status(500).json({ error: 'Failed to track click' });
  }
});

//Get analytics stats
router.get('/api/analytics/:shortCode', allowInternalService, apiLimiter, async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Track query metric
    queriesTotal.labels('stats').inc();

    const totalClicks = await Click.countDocuments({ shortCode });

    const last24Hours = await Click.countDocuments({
      shortCode,
      timestamp: { $gte: new Date(Date.now() - 24 * 60 * 60 * 1000) },
    });

    const last7Days = await Click.countDocuments({
      shortCode,
      timestamp: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) },
    });

    const lastClick = await Click.findOne({ shortCode })
      .sort({ timestamp: -1 })
      .select('timestamp');

    res.json({
      shortCode,
      totalClicks,
      last24Hours,
      last7Days,
      lastClickAt: lastClick?.timestamp || null,
    });
  } catch (error) {
    console.error('Error getting stats:', error);
    res.status(500).json({ error: 'Failed to get stats' });
  }
});

//Get click history
router.get('/api/analytics/:shortCode/history', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { limit = 100, offset = 0 } = req.query;

    // Track query metric
    queriesTotal.labels('history').inc();

    // Cap limit to prevent abuse
    const cappedLimit = Math.min(parseInt(limit, 10), 100);

    const clicks = await Click.find({ shortCode })
      .sort({ timestamp: -1 })
      .skip(parseInt(offset, 10))
      .limit(cappedLimit)
      .select('timestamp userAgent referer country city');

    const total = await Click.countDocuments({ shortCode });

    res.json({
      shortCode,
      total,
      limit: cappedLimit,
      offset: parseInt(offset, 10),
      clicks,
    });
  } catch (error) {
    console.error('Error getting history:', error);
    res.status(500).json({ error: 'Failed to get history' });
  }
});


//Get daily click aggregation.


router.get('/api/analytics/:shortCode/daily', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { shortCode } = req.params;
    const { days = 30 } = req.query;

    // Track query metric
    queriesTotal.labels('daily').inc();

    // Cap days to prevent expensive queries
    const cappedDays = Math.min(parseInt(days, 10), 90);
    const startDate = new Date(Date.now() - cappedDays * 24 * 60 * 60 * 1000);

    const dailyClicks = await Click.aggregate([
      {
        $match: {
          shortCode,
          timestamp: { $gte: startDate },
        },
      },
      {
        $group: {
          _id: {
            $dateToString: { format: '%Y-%m-%d', date: '$timestamp' },
          },
          count: { $sum: 1 },
        },
      },
      { $sort: { _id: 1 } },
    ]);

    res.json({
      shortCode,
      days: cappedDays,
      data: dailyClicks.map((d) => ({ date: d._id, clicks: d.count })),
    });
  } catch (error) {
    console.error('Error getting daily stats:', error);
    res.status(500).json({ error: 'Failed to get daily stats' });
  }
});

//Get geographic distribution of clicks.
router.get('/api/analytics/:shortCode/geo', requireAuth, apiLimiter, async (req, res) => {
  try {
    const { shortCode } = req.params;

    // Track query metric
    queriesTotal.labels('geo').inc();

    // Get country distribution
    const countryStats = await Click.aggregate([
      { $match: { shortCode, country: { $ne: null } } },
      {
        $group: {
          _id: { country: '$country', countryCode: '$countryCode' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 20 },
    ]);

    // Get city distribution (top 10)
    const cityStats = await Click.aggregate([
      { $match: { shortCode, city: { $ne: null } } },
      {
        $group: {
          _id: { city: '$city', country: '$country' },
          count: { $sum: 1 },
        },
      },
      { $sort: { count: -1 } },
      { $limit: 10 },
    ]);

    // Get total clicks with location data
    const totalWithLocation = await Click.countDocuments({
      shortCode,
      country: { $ne: null },
    });

    const totalClicks = await Click.countDocuments({ shortCode });

    res.json({
      shortCode,
      totalClicks,
      totalWithLocation,
      countries: countryStats.map((c) => ({
        country: c._id.country,
        countryCode: c._id.countryCode,
        clicks: c.count,
      })),
      cities: cityStats.map((c) => ({
        city: c._id.city,
        country: c._id.country,
        clicks: c.count,
      })),
    });
  } catch (error) {
    console.error('Error getting geo stats:', error);
    res.status(500).json({ error: 'Failed to get geographic stats' });
  }
});

module.exports = router;
