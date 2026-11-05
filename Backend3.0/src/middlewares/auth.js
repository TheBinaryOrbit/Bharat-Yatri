import { verifyToken } from '../utils/token.js';
import { User } from '../models/user.model.js';
import { Driver } from '../models/driver.model.js';

// The body every blocked-account refusal uses, so the apps can show one screen for it.
export const blockedResponse = (account) => ({
  error: 'This account has been blocked',
  code: 'ACCOUNT_BLOCKED',
  reason: account.blockedReason || '',
});

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

    // Admin tokens are signed with the same secret but belong to the /admin API only.
    if (decoded.role !== 'driver' && decoded.role !== 'user') {
      return res.status(401).json({ error: 'Not authorized, wrong token type' });
    }

    const Model = decoded.role === 'driver' ? Driver : User;
    const account = await Model.findById(decoded.id);

    if (!account) {
      return res.status(401).json({ error: 'Not authorized, account not found' });
    }

    if (account.isBlocked) {
      return res.status(403).json(blockedResponse(account));
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
