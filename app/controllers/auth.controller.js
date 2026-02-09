const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const crypto = require('crypto');
const ApiResponse = require('../utils/response');
const {
  ValidationError,
  UnauthorizedError,
  NotFoundError,
  ConflictError
} = require('../utils/error');
const userService = require('../services/user.service');
const cacheService = require('../services/cache.service');

class AuthController {
  async register(req, res, next) {
    try {
      const { name, email, password, phone } = req.body;

      // Check if user already exists
      const existingUser = await userService.getUserByEmail(email);
      if (existingUser) {
        throw new ConflictError('User with this email already exists');
      }

      // Hash password
      const password_hash = await bcrypt.hash(password, 12);

      // Create user
      const user = await userService.createUser({
        name,
        email,
        phone,
        password_hash,
        privacy_settings: {
          show_online_status: 'everyone',
          show_last_seen: 'everyone',
          show_read_receipts: true,
          profile_photo_visibility: 'everyone',
          about_visibility: 'everyone',
          status_visibility: 'everyone',
          who_can_add_to_groups: 'contacts',
          who_can_message_me: 'everyone',
          require_message_request: false
        }
      });

      // Generate tokens
      const token = this.generateToken(user.id);
      const refreshToken = this.generateRefreshToken(user.id);

      // Cache refresh token
      await cacheService.set(`refresh_token:${user.id}:${refreshToken}`, true, 7 * 24 * 60 * 60);

      // Remove password from response
      const { password_hash: _, ...userWithoutPassword } = user;

      res.status(201).json(ApiResponse.success({
        user: userWithoutPassword,
        token,
        refreshToken
      }, 'Registration successful'));
    } catch (error) {
      next(error);
    }
  }

  async login(req, res, next) {
    try {
      const { email, password, deviceId = 'default' } = req.body;

      // Find user
      const user = await userService.getUserByEmail(email);
      if (!user) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Check if user is active
      if (!user.is_active) {
        throw new UnauthorizedError('Account is deactivated');
      }

      // Verify password
      const isValidPassword = await bcrypt.compare(password, user.password_hash);
      if (!isValidPassword) {
        throw new UnauthorizedError('Invalid credentials');
      }

      // Generate tokens
      const token = this.generateToken(user.id, deviceId);
      const refreshToken = this.generateRefreshToken(user.id);

      // Cache session
      await cacheService.set(`session:${user.id}:${deviceId}`, {
        user_id: user.id,
        device_id: deviceId,
        last_active: new Date().toISOString()
      }, 24 * 60 * 60);

      // Cache refresh token
      await cacheService.set(`refresh_token:${user.id}:${refreshToken}`, true, 7 * 24 * 60 * 60);

      // Update online status
      await userService.updateOnlineStatus(user.id, true);

      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user;

      res.json(ApiResponse.success({
        user: userWithoutPassword,
        token,
        refreshToken
      }, 'Login successful'));
    } catch (error) {
      next(error);
    }
  }

  async refreshToken(req, res, next) {
    try {
      const { refreshToken } = req.body;

      if (!refreshToken) {
        throw new ValidationError('Refresh token is required');
      }

      try {
        const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);

        // Check if refresh token is valid in cache
        const isValid = await cacheService.get(`refresh_token:${decoded.userId}:${refreshToken}`);
        if (!isValid) {
          throw new UnauthorizedError('Invalid refresh token');
        }

        // Generate new tokens
        const newToken = this.generateToken(decoded.userId);
        const newRefreshToken = this.generateRefreshToken(decoded.userId);

        // Invalidate old refresh token
        await cacheService.del(`refresh_token:${decoded.userId}:${refreshToken}`);

        // Cache new refresh token
        await cacheService.set(`refresh_token:${decoded.userId}:${newRefreshToken}`, true, 7 * 24 * 60 * 60);

        res.json(ApiResponse.success({
          token: newToken,
          refreshToken: newRefreshToken
        }, 'Token refreshed successfully'));
      } catch (error) {
        throw new UnauthorizedError('Invalid refresh token');
      }
    } catch (error) {
      next(error);
    }
  }

  async logout(req, res, next) {
    try {
      const { refreshToken, allDevices = false } = req.body;

      // Blacklist current token
      await cacheService.set(`token_blacklist:${req.token}`, true, 24 * 60 * 60);

      // Handle refresh token
      if (refreshToken) {
        try {
          const decoded = jwt.verify(refreshToken, process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET);
          await cacheService.del(`refresh_token:${decoded.userId}:${refreshToken}`);
        } catch (error) {
          // Ignore invalid refresh tokens
        }
      }

      // Logout from all devices
      if (allDevices && req.user) {
        // Clear all sessions for user
        const sessionPattern = `session:${req.user.id}:*`;
        await cacheService.flushPattern(sessionPattern);

        // Clear all refresh tokens for user
        const refreshPattern = `refresh_token:${req.user.id}:*`;
        await cacheService.flushPattern(refreshPattern);
      } else if (req.user && req.token) {
        // Extract deviceId from token
        const decoded = jwt.decode(req.token);
        if (decoded && decoded.deviceId) {
          await cacheService.del(`session:${req.user.id}:${decoded.deviceId}`);
        }
      }

      // Update online status
      if (req.user) {
        await userService.updateOnlineStatus(req.user.id, false);
      }

      res.json(ApiResponse.success(null, 'Logout successful'));
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req, res, next) {
    try {
      const { current_password, new_password } = req.body;
      const userId = req.user.id;

      // Get user with password
      const userRepo = require('../repositories/user.repository');
      const user = await userRepo.findById(userId);

      // Verify current password
      const isValidPassword = await bcrypt.compare(current_password, user.password_hash);
      if (!isValidPassword) {
        throw new UnauthorizedError('Current password is incorrect');
      }

      // Hash new password
      const new_password_hash = await bcrypt.hash(new_password, 12);

      // Update password
      await userService.updateUser(userId, { password_hash: new_password_hash });

      // Invalidate all sessions and tokens
      const sessionPattern = `session:${userId}:*`;
      await cacheService.flushPattern(sessionPattern);

      const refreshPattern = `refresh_token:${userId}:*`;
      await cacheService.flushPattern(refreshPattern);

      // Blacklist current token
      await cacheService.set(`token_blacklist:${req.token}`, true, 24 * 60 * 60);

      res.json(ApiResponse.success(null, 'Password changed successfully. Please login again.'));
    } catch (error) {
      next(error);
    }
  }

  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;

      const user = await userService.getUserByEmail(email);
      if (!user) {
        // Don't reveal if user exists or not
        return res.json(ApiResponse.success(null, 'If an account exists with this email, a reset link will be sent'));
      }

      // Generate reset token
      const resetToken = crypto.randomBytes(32).toString('hex');
      const resetTokenHash = crypto.createHash('sha256').update(resetToken).digest('hex');

      // Store reset token in cache (valid for 1 hour)
      await cacheService.set(`password_reset:${resetTokenHash}`, {
        user_id: user.id,
        email: user.email
      }, 60 * 60);

      // In a real app, send email here
      console.log(`Password reset token for ${email}: ${resetToken}`);

      res.json(ApiResponse.success(null, 'Password reset instructions sent to email'));
    } catch (error) {
      next(error);
    }
  }

  async resetPassword(req, res, next) {
    try {
      const { token, new_password } = req.body;

      if (!token || !new_password) {
        throw new ValidationError('Token and new password are required');
      }

      // Hash token to compare with stored hash
      const resetTokenHash = crypto.createHash('sha256').update(token).digest('hex');

      // Get reset data from cache
      const resetData = await cacheService.get(`password_reset:${resetTokenHash}`);
      if (!resetData) {
        throw new UnauthorizedError('Invalid or expired reset token');
      }

      // Hash new password
      const new_password_hash = await bcrypt.hash(new_password, 12);

      // Update password
      await userService.updateUser(resetData.user_id, { password_hash: new_password_hash });

      // Delete reset token
      await cacheService.del(`password_reset:${resetTokenHash}`);

      // Invalidate all sessions for user
      const sessionPattern = `session:${resetData.user_id}:*`;
      await cacheService.flushPattern(sessionPattern);

      const refreshPattern = `refresh_token:${resetData.user_id}:*`;
      await cacheService.flushPattern(refreshPattern);

      res.json(ApiResponse.success(null, 'Password reset successful. Please login with your new password.'));
    } catch (error) {
      next(error);
    }
  }

  async verifyEmail(req, res, next) {
    try {
      const { token } = req.params;

      // In a real app, verify email token
      // For now, just return success

      res.json(ApiResponse.success(null, 'Email verified successfully'));
    } catch (error) {
      next(error);
    }
  }

  async getCurrentUser(req, res, next) {
    try {
      const user = req.user;

      // Remove password from response
      const { password_hash, ...userWithoutPassword } = user;

      res.json(ApiResponse.success({
        user: userWithoutPassword
      }, 'Current user retrieved successfully'));
    } catch (error) {
      next(error);
    }
  }

  // Helper methods
  generateToken(userId, deviceId = 'default') {
    return jwt.sign(
      { userId, deviceId },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '1d' }
    );
  }

  generateRefreshToken(userId) {
    return jwt.sign(
      { userId },
      process.env.JWT_REFRESH_SECRET || process.env.JWT_SECRET,
      { expiresIn: '7d' }
    );
  }
}

module.exports = new AuthController();