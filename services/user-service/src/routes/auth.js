const express = require('express');
const jwt = require('jsonwebtoken');
const config = require('../config');
const User = require('../models/User');
const auth = require('../middleware/auth');
const {
  registrationsTotal,
  loginsTotal,
  loginFailuresTotal,
  authLatency,
  profileRequestsTotal,
} = require('../metrics');

const router = express.Router();

// Register new user
router.post('/register', async (req, res) => {
  const startTime = process.hrtime();

  try {
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
      registrationsTotal.labels('failure').inc();
      return res.status(400).json({ error: 'Email, password, and name are required' });
    }

    if (password.length < 6) {
      registrationsTotal.labels('failure').inc();
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await User.findOne({ where: { email } });
    if (existingUser) {
      registrationsTotal.labels('failure').inc();
      return res.status(409).json({ error: 'Email already registered' });
    }

    const user = await User.create({ email, password, name });

    const token = jwt.sign(
      { userId: user.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Track successful registration
    registrationsTotal.labels('success').inc();

    // Track latency
    const duration = process.hrtime(startTime);
    authLatency.labels('register').observe(duration[0] + duration[1] / 1e9);

    res.status(201).json({
      message: 'User registered successfully',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    console.error('Registration error:', error);
    registrationsTotal.labels('failure').inc();
    res.status(500).json({ error: 'Registration failed' });
  }
});

// Login user
router.post('/login', async (req, res) => {
  const startTime = process.hrtime();

  try {
    const { email, password } = req.body;

    if (!email || !password) {
      loginFailuresTotal.labels('validation_error').inc();
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ where: { email } });
    if (!user) {
      loginFailuresTotal.labels('user_not_found').inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      loginFailuresTotal.labels('invalid_password').inc();
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign(
      { userId: user.id },
      config.jwt.secret,
      { expiresIn: config.jwt.expiresIn }
    );

    // Track successful login
    loginsTotal.inc();

    // Track latency
    const duration = process.hrtime(startTime);
    authLatency.labels('login').observe(duration[0] + duration[1] / 1e9);

    res.json({
      message: 'Login successful',
      user: user.toJSON(),
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    loginFailuresTotal.labels('server_error').inc();
    res.status(500).json({ error: 'Login failed' });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  // Track profile request (indicator of active sessions)
  profileRequestsTotal.inc();
  res.json({ user: req.user.toJSON() });
});

module.exports = router;
