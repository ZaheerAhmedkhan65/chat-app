const redis = require('../../config/redis');
const cacheService = require('./cache.service');
const CacheKeys = require('../utils/cache.keys');

class NotificationService {
    constructor() {
        this.notificationChannel = 'notifications';
    }

    async createNotification(userId, notification) {
        const notifications = await this.getUserNotifications(userId);
        notifications.unshift({
            id: Date.now().toString(),
            ...notification,
            created_at: new Date().toISOString(),
            is_read: false
        });

        // Keep only last 100 notifications
        if (notifications.length > 100) {
            notifications.length = 100;
        }

        await cacheService.cacheUserNotifications(userId, notifications);

        // Update unread count
        const unreadCount = notifications.filter(n => !n.is_read).length;
        await cacheService.cacheUnreadNotificationCount(userId, unreadCount);

        // Publish real-time notification
        await redis.publish(this.notificationChannel, {
            type: 'new_notification',
            user_id: userId,
            notification: notifications[0]
        });

        return notifications[0];
    }

    async getUserNotifications(userId, useCache = true) {
        if (useCache) {
            const cachedNotifications = await cacheService.getUserNotificationsFromCache(userId);
            if (cachedNotifications) {
                return cachedNotifications;
            }
        }

        // In a real app, you'd fetch from DB
        // For now, we'll return empty array
        const notifications = [];

        if (useCache) {
            await cacheService.cacheUserNotifications(userId, notifications);
        }

        return notifications;
    }

    async getUnreadNotificationCount(userId, useCache = true) {
        if (useCache) {
            const cachedCount = await cacheService.getUnreadNotificationCountFromCache(userId);
            if (cachedCount !== null) {
                return cachedCount;
            }
        }

        const notifications = await this.getUserNotifications(userId, false);
        const unreadCount = notifications.filter(n => !n.is_read).length;

        if (useCache) {
            await cacheService.cacheUnreadNotificationCount(userId, unreadCount);
        }

        return unreadCount;
    }

    async markAsRead(userId, notificationId = null) {
        const notifications = await this.getUserNotifications(userId);

        if (notificationId) {
            // Mark specific notification as read
            const notification = notifications.find(n => n.id === notificationId);
            if (notification) {
                notification.is_read = true;
            }
        } else {
            // Mark all as read
            notifications.forEach(n => n.is_read = true);
        }

        await cacheService.cacheUserNotifications(userId, notifications);

        // Update unread count
        const unreadCount = notifications.filter(n => !n.is_read).length;
        await cacheService.cacheUnreadNotificationCount(userId, unreadCount);

        return notifications;
    }

    async deleteNotification(userId, notificationId) {
        const notifications = await this.getUserNotifications(userId);
        const filtered = notifications.filter(n => n.id !== notificationId);

        await cacheService.cacheUserNotifications(userId, filtered);

        // Update unread count
        const unreadCount = filtered.filter(n => !n.is_read).length;
        await cacheService.cacheUnreadNotificationCount(userId, unreadCount);

        return filtered;
    }

    async clearAllNotifications(userId) {
        await cacheService.cacheUserNotifications(userId, []);
        await cacheService.cacheUnreadNotificationCount(userId, 0);
    }

    // Notification types
    async sendMessageNotification(senderId, conversationId, message) {
        // Get conversation participants
        const conversationService = require('./conversation.service');
        const participants = await conversationService.getConversationParticipants(conversationId);

        for (const participant of participants) {
            if (participant.user_id !== senderId) {
                await this.createNotification(participant.user_id, {
                    type: 'new_message',
                    title: 'New Message',
                    message: `New message from ${message.sender_name}`,
                    data: {
                        conversation_id: conversationId,
                        message_id: message.id,
                        sender_id: senderId,
                        preview: message.content?.substring(0, 100)
                    }
                });
            }
        }
    }

    async sendContactRequestNotification(requesterId, recipientId) {
        const userService = require('./user.service');
        const requester = await userService.getUserById(requesterId);

        await this.createNotification(recipientId, {
            type: 'contact_request',
            title: 'New Contact Request',
            message: `${requester.name} wants to add you as a contact`,
            data: {
                requester_id: requesterId,
                request_id: `${requesterId}:${recipientId}`
            }
        });
    }

    async sendGroupInvitationNotification(inviterId, inviteeId, groupId) {
        const userService = require('./user.service');
        const groupService = require('./group.service');

        const inviter = await userService.getUserById(inviterId);
        const group = await groupService.getGroup(groupId);

        await this.createNotification(inviteeId, {
            type: 'group_invitation',
            title: 'Group Invitation',
            message: `${inviter.name} invited you to join ${group.name}`,
            data: {
                inviter_id: inviterId,
                group_id: groupId,
                invitation_token: null // You'd need to pass this
            }
        });
    }

    async sendStatusViewNotification(statusOwnerId, viewerId, statusId) {
        const userService = require('./user.service');
        const viewer = await userService.getUserById(viewerId);

        await this.createNotification(statusOwnerId, {
            type: 'status_view',
            title: 'Status Viewed',
            message: `${viewer.name} viewed your status`,
            data: {
                viewer_id: viewerId,
                status_id: statusId
            }
        });
    }

    async sendReactionNotification(reactorId, messageId, reaction) {
        const messageService = require('./message.service');
        const userService = require('./user.service');

        const message = await messageService.getMessage(messageId);
        const reactor = await userService.getUserById(reactorId);

        if (message && message.sender_id !== reactorId) {
            await this.createNotification(message.sender_id, {
                type: 'message_reaction',
                title: 'Message Reaction',
                message: `${reactor.name} reacted with ${reaction} to your message`,
                data: {
                    reactor_id: reactorId,
                    message_id: messageId,
                    reaction: reaction,
                    conversation_id: message.conversation_id
                }
            });
        }
    }

    async sendMentionNotification(mentionedUserId, mentionerId, messageId) {
        const userService = require('./user.service');
        const mentioner = await userService.getUserById(mentionerId);

        await this.createNotification(mentionedUserId, {
            type: 'mention',
            title: 'You were mentioned',
            message: `${mentioner.name} mentioned you in a message`,
            data: {
                mentioner_id: mentionerId,
                message_id: messageId
            }
        });
    }

    // Real-time notification subscription
    async subscribeToNotifications(userId, callback) {
        await redis.subscribe(this.notificationChannel, (message) => {
            if (message.user_id === userId) {
                callback(message);
            }
        });
    }

    async getNotificationStats(userId) {
        const notifications = await this.getUserNotifications(userId);
        const unreadCount = await this.getUnreadNotificationCount(userId);

        const byType = {};
        notifications.forEach(n => {
            byType[n.type] = (byType[n.type] || 0) + 1;
        });

        return {
            total: notifications.length,
            unread: unreadCount,
            by_type: byType,
            recent: notifications.slice(0, 10)
        };
    }

    async cleanupOldNotifications() {
        // This would normally cleanup old notifications from DB
        // For cache-only implementation, we rely on cache TTL
        console.log('Notification cleanup completed');
    }
}

module.exports = new NotificationService();