/**
 * RAJU LUDO — SERVER CONFIGURATION
 */

import dotenv from 'dotenv';
dotenv.config();

export default {
  port: parseInt(process.env.PORT || '4000'),
  clientOrigin: process.env.CLIENT_ORIGIN || 'http://localhost:3000',
  mongoUri: process.env.MONGODB_URI || 'mongodb://localhost:27017/raju-ludo',
  jwtSecret: process.env.JWT_SECRET || 'raju-ludo-dev-secret',
  initialCoins: parseInt(process.env.INITIAL_COINS || '5000'),
  entryFees: {
    casual: parseInt(process.env.ENTRY_FEE_CASUAL || '100'),
    classic: parseInt(process.env.ENTRY_FEE_CLASSIC || '500'),
    premium: parseInt(process.env.ENTRY_FEE_PREMIUM || '2000'),
  },
};
