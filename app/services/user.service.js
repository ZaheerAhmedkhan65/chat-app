const userRepository = require('../repositories/user.repository');
const cacheService = require('./cache.service');

class UserService {
    async createUser(userData) {
        const user = await userRepository.create(userData);

        // Cache the new user
        await cacheService.cacheUser(user);

        return user;
    }

    async getUserById(userId, useCache = true) {
        if (useCache) {
            const cachedUser = await cacheService.getUserFromCache(userId);
            if (cachedUser) {
                return cachedUser;
            }
        }

        const user = await userRepository.findById(userId);
        if (user) {
            await cacheService.cacheUser(user);
        }

        return user;
    }

    async getUserByEmail(email, useCache = true) {
        if (useCache) {
            const cachedUser = await cacheService.getUserByEmailFromCache(email);
            if (cachedUser) {
                return cachedUser;
            }
        }

        const user = await userRepository.findByEmail(email);
        if (user) {
            await cacheService.cacheUser(user);
        }

        return user;
    }

    async updateUser(userId, updateData) {
        const user = await userRepository.update(userId, updateData);

        if (user) {
            // Invalidate cache and update
            await cacheService.invalidateUserCache(userId);
            await cacheService.cacheUser(user);
        }

        return user;
    }

    async updateOnlineStatus(userId, isOnline) {
        await userRepository.updateOnlineStatus(userId, isOnline);

        // Update cache
        const user = await this.getUserById(userId, false);
        if (user) {
            user.is_online = isOnline;
            user.last_seen_at = isOnline ? null : new Date();
            await cacheService.cacheUser(user);
        }

        await cacheService.cacheOnlineStatus(userId, isOnline);

        return user;
    }

    async searchUsers(searchTerm, limit = 50, offset = 0, useCache = true) {
        const cacheKey = `search:users:${searchTerm}:${limit}:${offset}`;

        if (useCache) {
            const cachedResults = await cacheService.getSearchResultsFromCache('users', searchTerm);
            if (cachedResults) {
                return cachedResults.slice(offset, offset + limit);
            }
        }

        const users = await userRepository.searchUsers(searchTerm, limit * 2, 0);

        if (useCache) {
            await cacheService.cacheSearchResults('users', searchTerm, users);
        }

        return users.slice(offset, offset + limit);
    }

    async getOnlineUsers(limit = 100, useCache = true) {
        if (useCache) {
            const onlineUsers = await cacheService.getOnlineUsers();
            return onlineUsers.slice(0, limit);
        }

        return await userRepository.getOnlineUsers(limit);
    }

    async deactivateAccount(userId) {
        await userRepository.deactivateAccount(userId);

        // Invalidate all user-related cache
        await cacheService.invalidateUserCache(userId);

        // Remove from online users
        await cacheService.cacheOnlineStatus(userId, false);
    }

    async updatePrivacySettings(userId, privacySettings) {
        const updatedSettings = await userRepository.updatePrivacySettings(userId, privacySettings);

        // Update user cache
        const user = await this.getUserById(userId, false);
        if (user) {
            user.privacy_settings = updatedSettings;
            await cacheService.cacheUser(user);
        }

        return updatedSettings;
    }

    async warmCache(userId) {
        await cacheService.warmUserCache(userId);
    }

    async getUserStats(userId) {
        // Combine data from multiple sources with caching
        const user = await this.getUserById(userId);
        const onlineStatus = await cacheService.getOnlineStatus(userId);

        return {
            user,
            is_online: onlineStatus,
            cache_timestamp: Date.now()
        };
    }

    async validateUserCredentials(email, password) {
        const user = await this.getUserByEmail(email);
        if (!user) return null;

        // Here you would validate password hash
        // const isValid = await bcrypt.compare(password, user.password_hash);
        // For now, we'll assume validation happens elsewhere

        return user;
    }
}

module.exports = new UserService();