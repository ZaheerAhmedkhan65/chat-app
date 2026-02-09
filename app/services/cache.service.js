const redis = require('../../config/redis');
const CacheKeys = require('../utils/cache.keys');

class CacheService {
    constructor() {
        this.defaultTTL = {
            user: 3600, // 1 hour
            contact: 1800, // 30 minutes
            group: 1800, // 30 minutes
            conversation: 900, // 15 minutes
            message: 300, // 5 minutes
            status: 600, // 10 minutes
            search: 300, // 5 minutes
            notification: 600 // 10 minutes
        };
    }

    // User caching
    async cacheUser(user) {
        if (!user || !user.id) return null;

        const userKey = CacheKeys.user(user.id);
        const emailKey = CacheKeys.userByEmail(user.email);
        const nameKey = CacheKeys.userByName(user.name);

        await redis.set(userKey, user, this.defaultTTL.user);
        await redis.set(emailKey, { id: user.id }, this.defaultTTL.user);
        await redis.set(nameKey, { id: user.id }, this.defaultTTL.user);

        return user;
    }

    async getUserFromCache(userId) {
        return await redis.get(CacheKeys.user(userId));
    }

    async getUserByEmailFromCache(email) {
        const data = await redis.get(CacheKeys.userByEmail(email));
        if (data && data.id) {
            return await this.getUserFromCache(data.id);
        }
        return null;
    }

    async invalidateUserCache(userId) {
        const patterns = [
            CacheKeys.userPattern(userId),
            `*:${userId}:*`
        ];

        for (const pattern of patterns) {
            await redis.flushPattern(pattern);
        }

        // Also invalidate email/name lookups
        const user = await this.getUserFromCache(userId);
        if (user) {
            await redis.del(CacheKeys.userByEmail(user.email));
            await redis.del(CacheKeys.userByName(user.name));
        }
    }

    async cacheOnlineStatus(userId, isOnline) {
        const key = CacheKeys.userOnlineStatus(userId);
        await redis.set(key, { isOnline, timestamp: Date.now() }, 60); // 1 minute TTL

        // Update online users set
        if (isOnline) {
            await redis.sadd(CacheKeys.onlineUsers(), userId);
        } else {
            await redis.srem(CacheKeys.onlineUsers(), userId);
        }
    }

    async getOnlineStatus(userId) {
        const data = await redis.get(CacheKeys.userOnlineStatus(userId));
        return data ? data.isOnline : false;
    }

    async getOnlineUsers() {
        const userIds = await redis.smembers(CacheKeys.onlineUsers());
        const users = [];

        for (const userId of userIds) {
            const user = await this.getUserFromCache(userId);
            if (user) {
                users.push(user);
            }
        }

        return users;
    }

    // Contact caching
    async cacheUserContacts(userId, contacts) {
        const key = CacheKeys.userContacts(userId);
        await redis.set(key, contacts, this.defaultTTL.contact);

        // Cache individual contacts for quick access
        for (const contact of contacts) {
            const contactKey = CacheKeys.userContact(userId, contact.contact_user_id);
            await redis.set(contactKey, contact, this.defaultTTL.contact);
        }

        // Cache blocked and favorite contacts separately
        const blocked = contacts.filter(c => c.is_blocked);
        const favorites = contacts.filter(c => c.is_favorite);

        await redis.set(
            CacheKeys.userBlockedContacts(userId),
            blocked,
            this.defaultTTL.contact
        );

        await redis.set(
            CacheKeys.userFavoriteContacts(userId),
            favorites,
            this.defaultTTL.contact
        );
    }

    async getUserContactsFromCache(userId) {
        return await redis.get(CacheKeys.userContacts(userId)) || [];
    }

    async getContactFromCache(userId, contactId) {
        return await redis.get(CacheKeys.userContact(userId, contactId));
    }

    async invalidateContactCache(userId, contactId = null) {
        if (contactId) {
            await redis.del(CacheKeys.userContact(userId, contactId));
        }
        await redis.del(CacheKeys.userContacts(userId));
        await redis.del(CacheKeys.userBlockedContacts(userId));
        await redis.del(CacheKeys.userFavoriteContacts(userId));
    }

    // Group caching
    async cacheGroup(group) {
        if (!group || !group.id) return null;

        const key = CacheKeys.group(group.id);
        await redis.set(key, group, this.defaultTTL.group);
        return group;
    }

    async getGroupFromCache(groupId) {
        return await redis.get(CacheKeys.group(groupId));
    }

    async cacheGroupMembers(groupId, members) {
        const key = CacheKeys.groupMembers(groupId);
        await redis.set(key, members, this.defaultTTL.group);

        // Cache admin list separately
        const admins = members.filter(m => m.role === 'admin');
        await redis.set(CacheKeys.groupAdmins(groupId), admins, this.defaultTTL.group);

        // Cache individual membership
        for (const member of members) {
            const memberKey = CacheKeys.groupMember(groupId, member.user_id);
            await redis.set(memberKey, member, this.defaultTTL.group);
        }
    }

    async getGroupMembersFromCache(groupId) {
        return await redis.get(CacheKeys.groupMembers(groupId)) || [];
    }

    async getUserGroupsFromCache(userId) {
        return await redis.get(CacheKeys.userGroups(userId)) || [];
    }

    async cacheUserGroups(userId, groups) {
        const key = CacheKeys.userGroups(userId);
        await redis.set(key, groups, this.defaultTTL.group);
    }

    async invalidateGroupCache(groupId) {
        const patterns = [
            CacheKeys.groupPattern(groupId),
            `*:${groupId}:*`
        ];

        for (const pattern of patterns) {
            await redis.flushPattern(pattern);
        }

        // Invalidate user group caches
        const members = await this.getGroupMembersFromCache(groupId);
        for (const member of members) {
            await redis.del(CacheKeys.userGroups(member.user_id));
        }
    }

    // Conversation caching
    async cacheConversation(conversation) {
        if (!conversation || !conversation.id) return null;

        const key = CacheKeys.conversation(conversation.id);
        await redis.set(key, conversation, this.defaultTTL.conversation);
        return conversation;
    }

    async getConversationFromCache(conversationId) {
        return await redis.get(CacheKeys.conversation(conversationId));
    }

    async cacheDirectConversation(userId1, userId2, conversation) {
        const key = CacheKeys.directConversation(userId1, userId2);
        await redis.set(key, conversation, this.defaultTTL.conversation);
    }

    async getDirectConversationFromCache(userId1, userId2) {
        const key = CacheKeys.directConversation(userId1, userId2);
        return await redis.get(key);
    }

    async cacheConversationParticipants(conversationId, participants) {
        const key = CacheKeys.conversationParticipants(conversationId);
        await redis.set(key, participants, this.defaultTTL.conversation);
    }

    async getConversationParticipantsFromCache(conversationId) {
        return await redis.get(CacheKeys.conversationParticipants(conversationId)) || [];
    }

    async cacheUserConversations(userId, conversations) {
        const key = CacheKeys.userConversations(userId);
        await redis.set(key, conversations, this.defaultTTL.conversation);
    }

    async getUserConversationsFromCache(userId) {
        return await redis.get(CacheKeys.userConversations(userId)) || [];
    }

    async cacheConversationUnreadCount(conversationId, userId, count) {
        const key = CacheKeys.conversationUnreadCount(conversationId, userId);
        await redis.set(key, count, 300); // 5 minutes TTL
    }

    async getConversationUnreadCountFromCache(conversationId, userId) {
        const key = CacheKeys.conversationUnreadCount(conversationId, userId);
        const count = await redis.get(key);
        return count !== null ? parseInt(count) : null;
    }

    async invalidateConversationCache(conversationId) {
        const patterns = [
            CacheKeys.conversationPattern(conversationId),
            `*:${conversationId}:*`
        ];

        for (const pattern of patterns) {
            await redis.flushPattern(pattern);
        }

        // Invalidate participant user caches
        const participants = await this.getConversationParticipantsFromCache(conversationId);
        for (const participant of participants) {
            await redis.del(CacheKeys.userConversations(participant.user_id));
        }
    }

    // Message caching
    async cacheMessage(message) {
        if (!message || !message.id) return null;

        const key = CacheKeys.message(message.id);
        await redis.set(key, message, this.defaultTTL.message);

        // Cache as last message of conversation
        if (message.conversation_id) {
            await redis.set(
                CacheKeys.conversationLastMessage(message.conversation_id),
                message,
                this.defaultTTL.message
            );
        }

        return message;
    }

    async getMessageFromCache(messageId) {
        return await redis.get(CacheKeys.message(messageId));
    }

    async cacheConversationMessages(conversationId, messages, page = 1, limit = 50) {
        const key = CacheKeys.conversationMessages(conversationId, page, limit);
        await redis.set(key, messages, this.defaultTTL.message);
    }

    async getConversationMessagesFromCache(conversationId, page = 1, limit = 50) {
        const key = CacheKeys.conversationMessages(conversationId, page, limit);
        return await redis.get(key) || [];
    }

    async getLastMessageFromCache(conversationId) {
        const key = CacheKeys.conversationLastMessage(conversationId);
        return await redis.get(key);
    }

    async invalidateMessageCache(messageId, conversationId = null) {
        await redis.del(CacheKeys.message(messageId));

        if (conversationId) {
            await redis.del(CacheKeys.conversationLastMessage(conversationId));
            // Invalidate all paginated message caches for this conversation
            const pattern = `conversation:${conversationId}:messages:*`;
            await redis.flushPattern(pattern);
        }
    }

    // Status caching
    async cacheStatus(status) {
        if (!status || !status.id) return null;

        const key = CacheKeys.status(status.id);
        await redis.set(key, status, this.defaultTTL.status);
        return status;
    }

    async getStatusFromCache(statusId) {
        return await redis.get(CacheKeys.status(statusId));
    }

    async cacheUserStatuses(userId, statuses) {
        const key = CacheKeys.userStatuses(userId);
        await redis.set(key, statuses, this.defaultTTL.status);
    }

    async getUserStatusesFromCache(userId) {
        return await redis.get(CacheKeys.userStatuses(userId)) || [];
    }

    async cacheContactStatuses(userId, statuses) {
        const key = CacheKeys.contactStatuses(userId);
        await redis.set(key, statuses, this.defaultTTL.status);
    }

    async getContactStatusesFromCache(userId) {
        return await redis.get(CacheKeys.contactStatuses(userId)) || [];
    }

    async invalidateStatusCache(statusId, userId = null) {
        await redis.del(CacheKeys.status(statusId));

        if (userId) {
            await redis.del(CacheKeys.userStatuses(userId));
            // Invalidate all users who have this user in contacts
            await redis.del(CacheKeys.contactStatuses(userId));
        }
    }

    // Starred messages caching
    async cacheUserStarredMessages(userId, messages) {
        const key = CacheKeys.userStarredMessages(userId);
        await redis.set(key, messages, 3600); // 1 hour TTL
    }

    async getUserStarredMessagesFromCache(userId) {
        return await redis.get(CacheKeys.userStarredMessages(userId)) || [];
    }

    // Draft caching
    async cacheUserDrafts(userId, drafts) {
        const key = CacheKeys.userDrafts(userId);
        await redis.set(key, drafts, 1800); // 30 minutes TTL
    }

    async getUserDraftsFromCache(userId) {
        return await redis.get(CacheKeys.userDrafts(userId)) || [];
    }

    async cacheConversationDraft(userId, conversationId, draft) {
        const key = CacheKeys.conversationDraft(userId, conversationId);
        await redis.set(key, draft, 1800); // 30 minutes TTL
    }

    async getConversationDraftFromCache(userId, conversationId) {
        const key = CacheKeys.conversationDraft(userId, conversationId);
        return await redis.get(key);
    }

    // Search caching
    async cacheSearchResults(type, query, results, userId = null) {
        const key = CacheKeys.searchResults(type, query, userId);
        await redis.set(key, results, this.defaultTTL.search);
    }

    async getSearchResultsFromCache(type, query, userId = null) {
        const key = CacheKeys.searchResults(type, query, userId);
        return await redis.get(key);
    }

    // Notification caching
    async cacheUserNotifications(userId, notifications) {
        const key = CacheKeys.userNotifications(userId);
        await redis.set(key, notifications, this.defaultTTL.notification);
    }

    async getUserNotificationsFromCache(userId) {
        return await redis.get(CacheKeys.userNotifications(userId)) || [];
    }

    async cacheUnreadNotificationCount(userId, count) {
        const key = CacheKeys.unreadNotificationCount(userId);
        await redis.set(key, count, 300); // 5 minutes TTL
    }

    async getUnreadNotificationCountFromCache(userId) {
        const key = CacheKeys.unreadNotificationCount(userId);
        const count = await redis.get(key);
        return count !== null ? parseInt(count) : null;
    }

    // Bulk cache operations
    async bulkCacheUsers(users) {
        const keyValues = {};

        for (const user of users) {
            if (user && user.id) {
                keyValues[CacheKeys.user(user.id)] = user;
                keyValues[CacheKeys.userByEmail(user.email)] = { id: user.id };
                keyValues[CacheKeys.userByName(user.name)] = { id: user.id };
            }
        }

        await redis.mset(keyValues, this.defaultTTL.user);
    }

    async bulkCacheMessages(messages) {
        const keyValues = {};

        for (const message of messages) {
            if (message && message.id) {
                keyValues[CacheKeys.message(message.id)] = message;
            }
        }

        await redis.mset(keyValues, this.defaultTTL.message);
    }

    // Cache warming
    async warmUserCache(userId) {
        const userRepo = require('../repositories/user.repository');
        const contactRepo = require('../repositories/contact.repository');
        const groupRepo = require('../repositories/chatGroup.repository');
        const conversationRepo = require('../repositories/conversation.repository');

        // Cache user
        const user = await userRepo.findById(userId);
        if (user) {
            await this.cacheUser(user);
        }

        // Cache user contacts
        const contacts = await contactRepo.getUserContacts(userId);
        await this.cacheUserContacts(userId, contacts);

        // Cache user groups
        const groups = await groupRepo.getUserGroups(userId);
        await this.cacheUserGroups(userId, groups);

        // Cache user conversations
        const conversations = await conversationRepo.getUserConversations(userId);
        await this.cacheUserConversations(userId, conversations);

        console.log(`✅ Cache warmed for user ${userId}`);
    }

    async warmGroupCache(groupId) {
        const groupRepo = require('../repositories/chatGroup.repository');
        const memberRepo = require('../repositories/groupMember.repository');

        // Cache group
        const group = await groupRepo.getGroupById(groupId);
        if (group) {
            await this.cacheGroup(group);
        }

        // Cache group members
        const members = await memberRepo.getGroupMembers(groupId);
        await this.cacheGroupMembers(groupId, members);

        console.log(`✅ Cache warmed for group ${groupId}`);
    }

    // Cache statistics
    async getCacheStats() {
        const keys = await redis.keys('*');
        const stats = {
            total: keys.length,
            byType: {}
        };

        for (const key of keys) {
            const type = key.split(':')[0];
            stats.byType[type] = (stats.byType[type] || 0) + 1;
        }

        return stats;
    }

    // Cache cleanup
    async cleanupExpired() {
        // Redis handles TTL automatically, but we can add manual cleanup if needed
        console.log('Cache cleanup completed');
    }

    // Lock mechanism for preventing cache stampede
    async withLock(key, ttl = 10, fn) {
        const lockKey = `lock:${key}`;
        const lockAcquired = await redis.set(lockKey, '1', 'NX', 'EX', ttl);

        if (!lockAcquired) {
            // Wait and retry
            await new Promise(resolve => setTimeout(resolve, 100));
            return this.withLock(key, ttl, fn);
        }

        try {
            return await fn();
        } finally {
            await redis.del(lockKey);
        }
    }
}

module.exports = new CacheService();