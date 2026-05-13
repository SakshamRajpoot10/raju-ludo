/**
 * RAJU LUDO — JWT AUTH MIDDLEWARE
 * Verifies JWT tokens for protected routes.
 */

import jwt from 'jsonwebtoken';
import config from '../config/index.js';

export function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'No token provided' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, config.jwtSecret);
    req.userId = decoded.userId;
    req.username = decoded.username;
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

/**
 * Generates a JWT token for a user.
 */
export function generateToken(user) {
  return jwt.sign(
    { userId: user._id, username: user.username },
    config.jwtSecret,
    { expiresIn: '7d' }
  );
}
