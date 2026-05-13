/**
 * RAJU LUDO — AUTH ROUTES
 * Handles registration, login, and profile management.
 */

import express from 'express';
import User from '../models/User.js';
import { authMiddleware, generateToken } from '../middleware/auth.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * POST /api/auth/register
 * Creates a new user account.
 */
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Validation
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'Username, email, and password are required' });
    }
    if (username.length < 3 || username.length > 20) {
      return res.status(400).json({ error: 'Username must be 3-20 characters' });
    }
    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    // Check duplicates
    const existingUser = await User.findOne({ $or: [{ username }, { email }] });
    if (existingUser) {
      const field = existingUser.username === username ? 'Username' : 'Email';
      return res.status(409).json({ error: `${field} already taken` });
    }

    // Create user with initial coins
    const user = new User({
      username,
      email,
      password,
      coins: config.initialCoins,
    });
    await user.save();

    const token = generateToken(user);

    res.status(201).json({
      token,
      user: user.toProfile(),
    });
  } catch (err) {
    console.error('[AUTH] Register error:', err);
    res.status(500).json({ error: 'Registration failed' });
  }
});

/**
 * POST /api/auth/login
 * Authenticates a user and returns a JWT.
 */
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    // Update last login
    user.lastLogin = new Date();
    await user.save();

    const token = generateToken(user);

    res.json({
      token,
      user: user.toProfile(),
    });
  } catch (err) {
    console.error('[AUTH] Login error:', err);
    res.status(500).json({ error: 'Login failed' });
  }
});

/**
 * GET /api/auth/profile
 * Returns the authenticated user's profile.
 */
router.get('/profile', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId);
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user: user.toProfile() });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch profile' });
  }
});

/**
 * PUT /api/auth/profile
 * Updates username or avatar.
 */
router.put('/profile', authMiddleware, async (req, res) => {
  try {
    const { username, avatar } = req.body;
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (username && username !== user.username) {
      const existing = await User.findOne({ username });
      if (existing) return res.status(409).json({ error: 'Username taken' });
      user.username = username;
    }
    if (avatar) user.avatar = avatar;

    await user.save();
    res.json({ user: user.toProfile() });
  } catch (err) {
    res.status(500).json({ error: 'Update failed' });
  }
});

/**
 * GET /api/auth/leaderboard
 * Top 20 players by XP.
 */
router.get('/leaderboard', async (req, res) => {
  try {
    const leaders = await User.find({})
      .sort({ xp: -1 })
      .limit(20)
      .select('username avatar rank xp stats.gamesWon stats.gamesPlayed coins');

    res.json({
      leaderboard: leaders.map(u => ({
        username: u.username,
        avatar: u.avatar,
        rank: u.rank,
        xp: u.xp,
        gamesWon: u.stats.gamesWon,
        gamesPlayed: u.stats.gamesPlayed,
        coins: u.coins,
      })),
    });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch leaderboard' });
  }
});

export default router;
