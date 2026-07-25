import jwt from 'jsonwebtoken';
import { env } from '../config/env.js';

// Signs a JWT. Payload should carry the account id and role ('user' | 'driver').
export const generateToken = (payload) => {
  return jwt.sign(payload, env.JWT_SECRET, { expiresIn: env.JWT_EXPIRES_IN });
};

export const verifyToken = (token) => {
  return jwt.verify(token, env.JWT_SECRET);
};
