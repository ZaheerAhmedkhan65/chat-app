class CacheKeys {
    // User cache keys
    static user(id) {
        return `user:${id}`;
    }

    static userByEmail(email) {
        return `user:email:${email}`;
    }

    static userByName(name) {
        return `user:name:${name}`;
    }

    static userOnlineStatus(id) {
        return `user:online:${id}`;
    }

    static userContacts(id) {
        return `user:${id}:contacts`;
    }

    static userContact(userId, contactId) {
        return `user:${userId}:contact:${contactId}`;
    }

    static userBlockedContacts(userId) {
        return `user:${userId}:contacts:blocked`;
    }

    static userFavoriteContacts(userId) {
        return `user:${userId}:contacts:favorites`;
    }

    // Contact requests
    static contactRequestsReceived(userId) {
        return `user:${userId}:contact_requests:received`;
    }

    static contactRequestsSent(userId) {
        return `user:${userId}:contact_requests:sent`;
    }

    static contactRequest(requesterId, recipientId) {
        return `contact_request:${requesterId}:${recipientId}`;
    }

    // Group cache keys
    static group(id) {
        return `group:${id}`;
    }

    static groupMembers(groupId) {
        return `group:${groupId}:members`;
    }

    static groupMember(groupId, userId) {
        return `group:${groupId}:member:${userId}`;
    }

    static groupAdmins(groupId) {
        return `group:${groupId}:admins`;
    }

    static userGroups(userId) {
        return `user:${userId}:groups`;
    }

    static groupInvitations(groupId) {
        return `group:${groupId}:invitations`;
    }

    static groupInvitationByToken(token) {
        return `group_invitation:token:${token}`;
    }

    // Conversation cache keys
    static conversation(id) {
        return `conversation:${id}`;
    }

    static directConversation(userId1, userId2) {
        return `conversation:direct:${Math.min(userId1, userId2)}:${Math.max(userId1, userId2)}`;
    }

    static conversationParticipants(conversationId) {
        return `conversation:${conversationId}:participants`;
    }

    static userConversations(userId) {
        return `user:${userId}:conversations`;
    }

    static conversationUnreadCount(conversationId, userId) {
        return `conversation:${conversationId}:user:${userId}:unread`;
    }

    // Message cache keys
    static message(id) {
        return `message:${id}`;
    }

    static conversationMessages(conversationId, page = 1, limit = 50) {
        return `conversation:${conversationId}:messages:page:${page}:limit:${limit}`;
    }

    static conversationLastMessage(conversationId) {
        return `conversation:${conversationId}:last_message`;
    }

    static messageReactions(messageId) {
        return `message:${messageId}:reactions`;
    }

    static messageViews(messageId) {
        return `message:${messageId}:views`;
    }

    // Status cache keys
    static status(id) {
        return `status:${id}`;
    }

    static userStatuses(userId) {
        return `user:${userId}:statuses`;
    }

    static statusViews(statusId) {
        return `status:${statusId}:views`;
    }

    static contactStatuses(userId) {
        return `user:${userId}:contact_statuses`;
    }

    // Starred messages
    static userStarredMessages(userId) {
        return `user:${userId}:starred_messages`;
    }

    // Message drafts
    static userDrafts(userId) {
        return `user:${userId}:drafts`;
    }

    static conversationDraft(userId, conversationId) {
        return `user:${userId}:conversation:${conversationId}:draft`;
    }

    // Rate limiting
    static rateLimit(key, window = 60) {
        return `rate_limit:${key}:${window}`;
    }

    // Session cache
    static userSession(userId, deviceId) {
        return `session:${userId}:${deviceId}`;
    }

    // Search cache
    static searchResults(type, query, userId = null) {
        const key = `search:${type}:${query}`;
        return userId ? `${key}:user:${userId}` : key;
    }

    // Online users
    static onlineUsers() {
        return 'users:online';
    }

    // Notification cache
    static userNotifications(userId) {
        return `user:${userId}:notifications`;
    }

    static unreadNotificationCount(userId) {
        return `user:${userId}:notifications:unread_count`;
    }

    // Cache invalidation patterns
    static userPattern(userId) {
        return `user:${userId}:*`;
    }

    static groupPattern(groupId) {
        return `group:${groupId}:*`;
    }

    static conversationPattern(conversationId) {
        return `conversation:${conversationId}:*`;
    }

    static allUserCache(userId) {
        return [
            CacheKeys.user(userId),
            CacheKeys.userContacts(userId),
            CacheKeys.userGroups(userId),
            CacheKeys.userConversations(userId),
            CacheKeys.userStatuses(userId),
            CacheKeys.userStarredMessages(userId),
            CacheKeys.userDrafts(userId),
            CacheKeys.contactRequestsReceived(userId),
            CacheKeys.contactRequestsSent(userId)
        ];
    }
}

module.exports = CacheKeys;