const ApiResponse = require('../utils/response');
const { ValidationError } = require('../utils/error');
const notificationService = require('../services/notification.service');

class NotificationController {
    async getNotifications(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 50, offset = 0 } = req.query;

            const notifications = await notificationService.getUserNotifications(userId);

            // Apply pagination
            const paginatedNotifications = notifications.slice(
                parseInt(offset),
                parseInt(offset) + parseInt(limit)
            );

            res.json(ApiResponse.paginate(paginatedNotifications, {
                total: notifications.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async getUnreadCount(req, res, next) {
        try {
            const userId = req.user.id;

            const unreadCount = await notificationService.getUnreadNotificationCount(userId);

            res.json(ApiResponse.success({
                unread_count: unreadCount
            }, 'Unread count retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async markAsRead(req, res, next) {
        try {
            const userId = req.user.id;
            const { notification_id } = req.body;

            const notifications = await notificationService.markAsRead(userId, notification_id);

            res.json(ApiResponse.success({
                notifications
            }, 'Notification marked as read'));
        } catch (error) {
            next(error);
        }
    }

    async markAllAsRead(req, res, next) {
        try {
            const userId = req.user.id;

            const notifications = await notificationService.markAsRead(userId);

            res.json(ApiResponse.success({
                notifications
            }, 'All notifications marked as read'));
        } catch (error) {
            next(error);
        }
    }

    async deleteNotification(req, res, next) {
        try {
            const userId = req.user.id;
            const notificationId = req.params.notificationId;

            const notifications = await notificationService.deleteNotification(userId, notificationId);

            res.json(ApiResponse.success({
                notifications
            }, 'Notification deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async clearAllNotifications(req, res, next) {
        try {
            const userId = req.user.id;

            await notificationService.clearAllNotifications(userId);

            res.json(ApiResponse.success(null, 'All notifications cleared'));
        } catch (error) {
            next(error);
        }
    }

    async getNotificationStats(req, res, next) {
        try {
            const userId = req.user.id;

            const stats = await notificationService.getNotificationStats(userId);

            res.json(ApiResponse.success(stats, 'Notification stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async subscribe(req, res, next) {
        try {
            const userId = req.user.id;

            // Set headers for Server-Sent Events
            res.writeHead(200, {
                'Content-Type': 'text/event-stream',
                'Cache-Control': 'no-cache',
                'Connection': 'keep-alive'
            });

            // Send initial connection event
            res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to notification stream' })}\n\n`);

            // Subscribe to notifications
            await notificationService.subscribeToNotifications(userId, (message) => {
                res.write(`data: ${JSON.stringify(message)}\n\n`);
            });

            // Keep connection alive
            const keepAlive = setInterval(() => {
                res.write(': keepalive\n\n');
            }, 30000);

            // Clean up on client disconnect
            req.on('close', () => {
                clearInterval(keepAlive);
                res.end();
            });
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new NotificationController();