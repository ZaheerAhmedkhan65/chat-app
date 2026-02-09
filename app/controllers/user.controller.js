const ApiResponse = require('../utils/response');
const { NotFoundError, ForbiddenError, ValidationError } = require('../utils/error');
const userService = require('../services/user.service');
const cacheService = require('../services/cache.service');

class UserController {
    async getProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const user = await userService.getUserById(userId);

            if (!user) {
                throw new NotFoundError('User not found');
            }

            // Remove sensitive data
            const { password_hash, ...safeUser } = user;

            res.json(ApiResponse.success({
                user: safeUser
            }, 'Profile retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateProfile(req, res, next) {
        try {
            const userId = req.user.id;
            const updateData = req.body;

            // Don't allow updating password via this endpoint
            if (updateData.password_hash) {
                throw new ForbiddenError('Use change password endpoint to update password');
            }

            const updatedUser = await userService.updateUser(userId, updateData);

            // Remove sensitive data
            const { password_hash, ...safeUser } = updatedUser;

            res.json(ApiResponse.success({
                user: safeUser
            }, 'Profile updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updatePrivacySettings(req, res, next) {
        try {
            const userId = req.user.id;
            const privacySettings = req.body;

            const updatedSettings = await userService.updatePrivacySettings(userId, privacySettings);

            res.json(ApiResponse.success({
                privacy_settings: updatedSettings
            }, 'Privacy settings updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async updateOnlineStatus(req, res, next) {
        try {
            const userId = req.user.id;
            const { is_online } = req.body;

            if (typeof is_online !== 'boolean') {
                throw new ValidationError('is_online must be a boolean');
            }

            await userService.updateOnlineStatus(userId, is_online);

            res.json(ApiResponse.success({
                is_online
            }, `Status updated to ${is_online ? 'online' : 'offline'}`));
        } catch (error) {
            next(error);
        }
    }

    async searchUsers(req, res, next) {
        try {
            const { search, limit = 50, offset = 0 } = req.query;

            if (!search || search.trim().length < 2) {
                throw new ValidationError('Search term must be at least 2 characters');
            }

            const users = await userService.searchUsers(search, parseInt(limit), parseInt(offset));

            // Remove sensitive data
            const safeUsers = users.map(user => {
                const { password_hash, ...safeUser } = user;
                return safeUser;
            });

            res.json(ApiResponse.paginate(safeUsers, {
                total: safeUsers.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async getOnlineUsers(req, res, next) {
        try {
            const { limit = 100 } = req.query;
            const users = await userService.getOnlineUsers(parseInt(limit));

            // Remove sensitive data
            const safeUsers = users.map(user => {
                const { password_hash, ...safeUser } = user;
                return safeUser;
            });

            res.json(ApiResponse.success(safeUsers, 'Online users retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserById(req, res, next) {
        try {
            const userId = parseInt(req.params.userId);

            // Check privacy settings
            const user = await userService.getUserById(userId);
            if (!user) {
                throw new NotFoundError('User not found');
            }

            // Check if requesting user can see this profile
            const canView = await this.canViewProfile(req.user.id, userId, user);
            if (!canView) {
                throw new ForbiddenError('You cannot view this profile');
            }

            // Filter data based on privacy settings
            const filteredUser = this.filterUserData(user, req.user.id);

            res.json(ApiResponse.success({
                user: filteredUser
            }, 'User retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deactivateAccount(req, res, next) {
        try {
            const userId = req.user.id;
            const { reason } = req.body;

            // In a real app, you might want to store the deactivation reason
            await userService.deactivateAccount(userId);

            // Clear all user cache
            await cacheService.invalidateUserCache(userId);

            // Logout from all devices
            const sessionPattern = `session:${userId}:*`;
            await cacheService.flushPattern(sessionPattern);

            const refreshPattern = `refresh_token:${userId}:*`;
            await cacheService.flushPattern(refreshPattern);

            // Blacklist current token
            await cacheService.set(`token_blacklist:${req.token}`, true, 24 * 60 * 60);

            res.json(ApiResponse.success(null, 'Account deactivated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserStats(req, res, next) {
        try {
            const userId = req.user.id;
            const stats = await userService.getUserStats(userId);

            res.json(ApiResponse.success(stats, 'User stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async warmCache(req, res, next) {
        try {
            const userId = req.user.id;
            await userService.warmCache(userId);

            res.json(ApiResponse.success(null, 'Cache warmed successfully'));
        } catch (error) {
            next(error);
        }
    }

    // Helper methods
    async canViewProfile(viewerId, profileUserId, profileUser) {
        // User can always view their own profile
        if (viewerId === profileUserId) {
            return true;
        }

        // Check if viewer is blocked
        const contactService = require('../services/contact.service');
        const isBlocked = await contactService.isBlocked(profileUserId, viewerId);
        if (isBlocked) {
            return false;
        }

        // Check privacy settings
        const privacySettings = profileUser.privacy_settings || {};

        // Default to 'everyone' if not set
        const profileVisibility = privacySettings.profile_photo_visibility || 'everyone';

        switch (profileVisibility) {
            case 'everyone':
                return true;
            case 'contacts':
                const isContact = await contactService.isContact(profileUserId, viewerId);
                return isContact;
            case 'nobody':
                return false;
            default:
                return true;
        }
    }

    filterUserData(user, viewerId) {
        const filteredUser = { ...user };
        const privacySettings = user.privacy_settings || {};

        // Always remove sensitive data
        delete filteredUser.password_hash;

        // Check if viewer is the user themselves
        if (viewerId === user.id) {
            return filteredUser; // Return all data for self
        }

        // Check contact status
        const contactService = require('../services/contact.service');
        const isContact = contactService.isContact(user.id, viewerId);

        // Filter based on privacy settings
        if (privacySettings.profile_photo_visibility === 'contacts' && !isContact) {
            filteredUser.avatar_url = 'avatars/default.png';
        } else if (privacySettings.profile_photo_visibility === 'nobody') {
            filteredUser.avatar_url = 'avatars/default.png';
        }

        if (privacySettings.about_visibility === 'contacts' && !isContact) {
            filteredUser.about = '';
        } else if (privacySettings.about_visibility === 'nobody') {
            filteredUser.about = '';
        }

        if (privacySettings.status_visibility === 'contacts' && !isContact) {
            filteredUser.status_emoji = null;
            filteredUser.status_text = null;
        } else if (privacySettings.status_visibility === 'nobody') {
            filteredUser.status_emoji = null;
            filteredUser.status_text = null;
        }

        if (privacySettings.show_online_status === 'contacts' && !isContact) {
            filteredUser.is_online = null;
        } else if (privacySettings.show_online_status === 'nobody') {
            filteredUser.is_online = null;
        }

        if (privacySettings.show_last_seen === 'contacts' && !isContact) {
            filteredUser.last_seen_at = null;
        } else if (privacySettings.show_last_seen === 'nobody') {
            filteredUser.last_seen_at = null;
        }

        // Remove email and phone for non-self users
        delete filteredUser.email;
        delete filteredUser.phone;
        delete filteredUser.privacy_settings;

        return filteredUser;
    }
}

module.exports = new UserController();