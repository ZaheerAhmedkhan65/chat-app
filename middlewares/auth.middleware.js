const jwt = require('jsonwebtoken');
const { UnauthorizedError, ForbiddenError } = require('../app/utils/error');
const userService = require('../app/services/user.service');
const cacheService = require('../app/services/cache.service');

const authMiddleware = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (!token) {
      throw new UnauthorizedError('No token provided');
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check if user exists and is active
    const user = await userService.getUserById(decoded.userId);
    if (!user || !user.is_active) {
      throw new UnauthorizedError('User not found or inactive');
    }

    // Check if token is blacklisted (for logout)
    const isBlacklisted = await cacheService.get(`token_blacklist:${token}`);
    if (isBlacklisted) {
      throw new UnauthorizedError('Token has been revoked');
    }

    // Check device session if deviceId is in token
    if (decoded.deviceId) {
      const session = await cacheService.get(`session:${decoded.userId}:${decoded.deviceId}`);
      if (!session) {
        throw new UnauthorizedError('Session expired');
      }
    }

    req.user = user;
    req.token = token;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      next(new UnauthorizedError('Invalid token'));
    } else if (error.name === 'TokenExpiredError') {
      next(new UnauthorizedError('Token expired'));
    } else {
      next(error);
    }
  }
};

const extractToken = (req) => {
  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer ')) {
    return req.headers.authorization.split(' ')[1];
  }

  if (req.cookies?.token) {
    return req.cookies.token;
  }

  if (req.query.token) {
    return req.query.token;
  }

  return null;
};

const requireRoles = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new UnauthorizedError('Authentication required');
    }

    if (!roles.includes(req.user.role)) {
      throw new ForbiddenError('Insufficient permissions');
    }

    next();
  };
};

const optionalAuth = async (req, res, next) => {
  try {
    const token = extractToken(req);

    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await userService.getUserById(decoded.userId);

      if (user && user.is_active) {
        req.user = user;
        req.token = token;
      }
    }

    next();
  } catch (error) {
    // Don't throw error for optional auth
    next();
  }
};

const rateLimitByUser = (limit, windowMs) => {
  return async (req, res, next) => {
    if (!req.user) {
      return next();
    }

    const key = `rate_limit:user:${req.user.id}:${req.path}`;
    const current = await cacheService.increment(key);

    if (current === 1) {
      await cacheService.expire(key, windowMs / 1000);
    }

    if (current > limit) {
      throw new RateLimitError(`Rate limit exceeded. Try again in ${windowMs / 1000} seconds`);
    }

    next();
  };
};

module.exports = {
  authMiddleware,
  requireRoles,
  optionalAuth,
  rateLimitByUser,
  extractToken
};