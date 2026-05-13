/**
 * RAJU LUDO — ECONOMY ROUTES
 * Handles coin balance, entry fees, and match rewards.
 */

import express from 'express';
import User from '../models/User.js';
import { authMiddleware } from '../middleware/auth.js';
import config from '../config/index.js';

const router = express.Router();

/**
 * GET /api/economy/balance
 * Returns the user's current coin balance.
 */
router.get('/balance', authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.userId).select('coins');
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ coins: user.coins });
  } catch (err) {
    res.status(500).json({ error: 'Failed to fetch balance' });
  }
});

/**
 * POST /api/economy/deduct-entry
 * Deducts the entry fee before a game starts.
 * Body: { tier: 'casual' | 'classic' | 'premium' }
 */
router.post('/deduct-entry', authMiddleware, async (req, res) => {
  try {
    const { tier } = req.body;
    const fee = config.entryFees[tier] || config.entryFees.casual;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    if (user.coins < fee) {
      return res.status(400).json({ error: 'Insufficient coins', required: fee, balance: user.coins });
    }

    user.coins -= fee;
    await user.save();

    res.json({ coins: user.coins, deducted: fee });
  } catch (err) {
    res.status(500).json({ error: 'Transaction failed' });
  }
});

/**
 * POST /api/economy/reward
 * Awards coins after a game completes.
 * Body: { gameType, position, playerCount, tier }
 */
router.post('/reward', authMiddleware, async (req, res) => {
  try {
    const { gameType, position, playerCount, tier } = req.body;
    const fee = config.entryFees[tier] || config.entryFees.casual;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    // Calculate reward based on position
    let reward = 0;
    let xpGain = 0;
    const totalPool = fee * playerCount;

    if (position === 1) {
      reward = Math.floor(totalPool * 0.6); // 1st gets 60% of pool
      xpGain = 50;
      user.stats.gamesWon++;
      user.stats.winStreak++;
      if (user.stats.winStreak > user.stats.bestWinStreak) {
        user.stats.bestWinStreak = user.stats.winStreak;
      }
    } else if (position === 2) {
      reward = Math.floor(totalPool * 0.25); // 2nd gets 25%
      xpGain = 25;
      user.stats.gamesLost++;
      user.stats.winStreak = 0;
    } else {
      reward = 0; // 3rd & 4th get nothing
      xpGain = 10; // But still get XP for playing
      user.stats.gamesLost++;
      user.stats.winStreak = 0;
    }

    user.coins += reward;
    user.xp += xpGain;
    user.stats.gamesPlayed++;
    user.stats.totalCoinsWon += reward > 0 ? reward : 0;

    // Track game type stats
    if (gameType === 'LUDO') {
      user.stats.ludoGamesPlayed++;
      if (position === 1) user.stats.ludoGamesWon++;
    } else {
      user.stats.snlGamesPlayed++;
      if (position === 1) user.stats.snlGamesWon++;
    }

    // Update rank
    user.calculateRank();

    // Add to match history
    user.addMatch({
      gameType,
      result: position === 1 ? 'win' : 'loss',
      position,
      coinsChange: reward - fee,
      opponentCount: playerCount - 1,
    });

    await user.save();

    res.json({
      coins: user.coins,
      reward,
      xpGain,
      rank: user.rank,
      totalXp: user.xp,
      stats: user.stats,
    });
  } catch (err) {
    res.status(500).json({ error: 'Reward processing failed' });
  }
});

export default router;
