const ApiResponse = require('../utils/response');
const { ForbiddenError, ValidationError } = require('../utils/error');
const cacheService = require('../services/cache.service');

class AdminController {
    async getCacheStats(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can access cache stats');
            }

            const stats = await cacheService.getCacheStats();

            res.json(ApiResponse.success(stats, 'Cache stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async clearCache(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can clear cache');
            }

            const { pattern = '*' } = req.body;

            if (!pattern || pattern.trim() === '') {
                throw new ValidationError('Cache pattern is required');
            }

            const clearedCount = await cacheService.flushPattern(pattern);

            res.json(ApiResponse.success({
                pattern,
                cleared_count: clearedCount
            }, 'Cache cleared successfully'));
        } catch (error) {
            next(error);
        }
    }

    async warmUserCache(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can warm cache');
            }

            const userId = parseInt(req.params.userId);

            await cacheService.warmUserCache(userId);

            res.json(ApiResponse.success(null, 'User cache warmed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async warmGroupCache(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can warm cache');
            }

            const groupId = parseInt(req.params.groupId);

            await cacheService.warmGroupCache(groupId);

            res.json(ApiResponse.success(null, 'Group cache warmed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getSystemStats(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can access system stats');
            }

            const redis = require('../config/redis');
            const db = require('../config/db');

            // Get Redis info
            const redisInfo = await redis.getClient().info();

            // Get database stats
            const dbStats = await db.query(`
                SELECT 
                    (SELECT COUNT(*) FROM users) as user_count,
                    (SELECT COUNT(*) FROM users WHERE is_online = TRUE) as online_user_count,
                    (SELECT COUNT(*) FROM contacts) as contact_count,
                    (SELECT COUNT(*) FROM chat_groups) as group_count,
                    (SELECT COUNT(*) FROM messages) as message_count,
                    (SELECT COUNT(*) FROM conversations) as conversation_count
            `);

            // Get active conversations
            const activeConversations = await db.query(`
                SELECT COUNT(*) as count 
                FROM conversations 
                WHERE updated_at > DATE_SUB(NOW(), INTERVAL 1 HOUR)
            `);

            // Get recent registrations
            const recentRegistrations = await db.query(`
                SELECT COUNT(*) as count 
                FROM users 
                WHERE created_at > DATE_SUB(NOW(), INTERVAL 24 HOUR)
            `);

            const stats = {
                database: dbStats[0],
                redis: {
                    connected_clients: redisInfo.match(/connected_clients:(\d+)/)?.[1] || '0',
                    used_memory: redisInfo.match(/used_memory_human:(\S+)/)?.[1] || '0',
                    total_connections_received: redisInfo.match(/total_connections_received:(\d+)/)?.[1] || '0'
                },
                activity: {
                    active_conversations: activeConversations[0].count,
                    recent_registrations: recentRegistrations[0].count
                },
                cache: await cacheService.getCacheStats()
            };

            res.json(ApiResponse.success(stats, 'System stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserManagement(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can manage users');
            }

            const {
                search,
                is_active,
                limit = 50,
                offset = 0
            } = req.query;

            const db = require('../config/db');

            let sql = 'SELECT * FROM users WHERE 1=1';
            const params = [];

            if (search) {
                sql += ' AND (name LIKE ? OR email LIKE ?)';
                params.push(`%${search}%`, `%${search}%`);
            }

            if (is_active !== undefined) {
                sql += ' AND is_active = ?';
                params.push(is_active === 'true');
            }

            sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
            params.push(parseInt(limit), parseInt(offset));

            const users = await db.query(sql, params);

            // Remove passwords
            const safeUsers = users.map(user => {
                const { password_hash, ...safeUser } = user;
                return safeUser;
            });

            // Get total count
            let countSql = 'SELECT COUNT(*) as total FROM users WHERE 1=1';
            const countParams = [];

            if (search) {
                countSql += ' AND (name LIKE ? OR email LIKE ?)';
                countParams.push(`%${search}%`, `%${search}%`);
            }

            if (is_active !== undefined) {
                countSql += ' AND is_active = ?';
                countParams.push(is_active === 'true');
            }

            const [countResult] = await db.query(countSql, countParams);

            res.json(ApiResponse.paginate(safeUsers, {
                total: countResult.total,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async updateUserStatus(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can update user status');
            }

            const userId = parseInt(req.params.userId);
            const { is_active, role } = req.body;

            const updateData = {};
            if (is_active !== undefined) updateData.is_active = is_active;
            if (role) updateData.role = role;

            const userService = require('../services/user.service');
            const updatedUser = await userService.updateUser(userId, updateData);

            // Remove password
            const { password_hash, ...safeUser } = updatedUser;

            res.json(ApiResponse.success({
                user: safeUser
            }, 'User status updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async cleanupOldData(req, res, next) {
        try {
            // Check if user is admin
            if (req.user.role !== 'admin') {
                throw new ForbiddenError('Only admins can cleanup data');
            }

            const { days = 30 } = req.body;

            const db = require('../config/db');

            // Cleanup old messages (soft deleted)
            const deletedMessages = await db.query(`
                DELETE FROM messages 
                WHERE is_deleted = TRUE 
                AND deleted_at < DATE_SUB(NOW(), INTERVAL ? DAY)
            `, [days]);

            // Cleanup expired statuses
            const statusService = require('../services/status.service');
            const cleanedStatuses = await statusService.cleanupExpiredStatuses();

            // Cleanup old notifications from DB (if stored)
            // This depends on your implementation

            res.json(ApiResponse.success({
                deleted_messages: deletedMessages.affectedRows,
                cleaned_statuses: cleanedStatuses
            }, 'Old data cleaned up successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new AdminController();