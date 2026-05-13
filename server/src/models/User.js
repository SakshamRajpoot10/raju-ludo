/**
 * RAJU LUDO — USER MODEL (MongoDB/Mongoose)
 * Stores player profiles, authentication, coins, and game statistics.
 */

import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true,
    trim: true,
    minlength: 3,
    maxlength: 20,
  },
  email: {
    type: String,
    required: true,
    unique: true,
    lowercase: true,
    trim: true,
  },
  password: {
    type: String,
    required: true,
    minlength: 6,
  },
  avatar: {
    type: String,
    default: 'default',
  },

  // Economy
  coins: {
    type: Number,
    default: 5000,
  },

  // Statistics
  stats: {
    gamesPlayed: { type: Number, default: 0 },
    gamesWon: { type: Number, default: 0 },
    gamesLost: { type: Number, default: 0 },
    totalKills: { type: Number, default: 0 },
    totalCoinsWon: { type: Number, default: 0 },
    totalCoinsLost: { type: Number, default: 0 },
    winStreak: { type: Number, default: 0 },
    bestWinStreak: { type: Number, default: 0 },
    ludoGamesPlayed: { type: Number, default: 0 },
    ludoGamesWon: { type: Number, default: 0 },
    snlGamesPlayed: { type: Number, default: 0 },
    snlGamesWon: { type: Number, default: 0 },
  },

  // Rank (based on wins)
  rank: {
    type: String,
    default: 'Bronze',
    enum: ['Bronze', 'Silver', 'Gold', 'Platinum', 'Diamond', 'Legend'],
  },
  xp: {
    type: Number,
    default: 0,
  },

  // Match history (last 20 games)
  matchHistory: [{
    gameType: String,
    result: { type: String, enum: ['win', 'loss', 'draw'] },
    position: Number, // 1st, 2nd, 3rd, 4th
    coinsChange: Number,
    playedAt: { type: Date, default: Date.now },
    opponentCount: Number,
  }],

  createdAt: {
    type: Date,
    default: Date.now,
  },
  lastLogin: {
    type: Date,
    default: Date.now,
  },
});

// Hash password before saving
userSchema.pre('save', async function(next) {
  if (!this.isModified('password')) return next();
  this.password = await bcrypt.hash(this.password, 12);
  next();
});

// Compare password method
userSchema.methods.comparePassword = async function(candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

// Calculate rank based on XP
userSchema.methods.calculateRank = function() {
  const xp = this.xp;
  if (xp >= 10000) this.rank = 'Legend';
  else if (xp >= 5000) this.rank = 'Diamond';
  else if (xp >= 2500) this.rank = 'Platinum';
  else if (xp >= 1000) this.rank = 'Gold';
  else if (xp >= 400) this.rank = 'Silver';
  else this.rank = 'Bronze';
};

// Add match to history (keep last 20)
userSchema.methods.addMatch = function(matchData) {
  this.matchHistory.unshift(matchData);
  if (this.matchHistory.length > 20) {
    this.matchHistory = this.matchHistory.slice(0, 20);
  }
};

// Sanitize for client (remove password)
userSchema.methods.toProfile = function() {
  return {
    id: this._id,
    username: this.username,
    avatar: this.avatar,
    coins: this.coins,
    rank: this.rank,
    xp: this.xp,
    stats: this.stats,
    matchHistory: this.matchHistory,
    createdAt: this.createdAt,
    lastLogin: this.lastLogin,
  };
};

const User = mongoose.model('User', userSchema);
export default User;
