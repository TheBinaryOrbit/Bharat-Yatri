import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';

// Verifies the JWT and attaches the account to req.user (+ req.role)
export const protect = async (req, res, next) => {
  try {
    let token;
    if (req.headers.authorization?.startsWith('Bearer ')) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return res.status(401).json({ error: 'Not authorized, no token' });
    }

    const decoded = verifyToken(token); // { id, role }
    const Model = decoded.role === 'driver' ? Driver : User;
    const account = await Model.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ error: 'Not authorized, account not found' });
    }

    req.user = account;
    req.role = decoded.role;
    next();
  } catch (error) {
    console.error('Auth error:', error.message);
    return res.status(401).json({ error: 'Not authorized, token failed' });
  }
};

// Restricts a route to specific roles, e.g. authorize('driver')
export const authorize = (...roles) => (req, res, next) => {
  if (!roles.includes(req.role)) {
    return res.status(403).json({ error: 'Forbidden: insufficient permissions' });
  }
  next();
};
