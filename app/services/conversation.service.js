const conversationRepository = require('../repositories/conversation.repository');
const conversationParticipantRepository = require('../repositories/conversationParticipant.repository');
const messageRepository = require('../repositories/message.repository');
const cacheService = require('./cache.service');
const contactService = require('./contact.service');

class ConversationService {
    async createDirectConversation(userId1, userId2) {
        // Check if users are contacts and not blocked
        const isBlocked = await contactService.isBlocked(userId1, userId2);
        if (isBlocked) {
            throw new Error('Cannot create conversation with blocked user');
        }

        // Check for existing conversation
        const existing = await this.getDirectConversation(userId1, userId2, true);
        if (existing) {
            return existing;
        }

        const conversation = await conversationRepository.createConversation('direct', [userId1, userId2]);

        // Cache the conversation
        await cacheService.cacheConversation(conversation);
        await cacheService.cacheDirectConversation(userId1, userId2, conversation);

        // Invalidate user conversation caches
        await cacheService.cacheUserConversations(userId1, null);
        await cacheService.cacheUserConversations(userId2, null);

        return conversation;
    }

    async createGroupConversation(groupId) {
        // Check for existing conversation
        const existing = await conversationRepository.getGroupConversation(groupId);
        if (existing) {
            return existing;
        }

        const conversation = await conversationRepository.createConversation('group', [], groupId);

        // Cache the conversation
        await cacheService.cacheConversation(conversation);

        // Get group members and cache participants
        const groupService = require('./group.service');
        const members = await groupService.getGroupMembers(groupId);
        const participantIds = members.map(m => m.user_id);

        await conversationParticipantRepository.bulkAddParticipants(conversation.id, participantIds);
        await cacheService.cacheConversationParticipants(conversation.id, participantIds);

        // Invalidate caches for all participants
        for (const member of members) {
            await cacheService.cacheUserConversations(member.user_id, null);
        }

        return conversation;
    }

    async getConversation(conversationId, useCache = true) {
        if (useCache) {
            const cachedConversation = await cacheService.getConversationFromCache(conversationId);
            if (cachedConversation) {
                return cachedConversation;
            }
        }

        const conversation = await conversationRepository.getConversationById(conversationId);
        if (conversation) {
            await cacheService.cacheConversation(conversation);
        }

        return conversation;
    }

    async getDirectConversation(userId1, userId2, useCache = true) {
        if (useCache) {
            const cachedConversation = await cacheService.getDirectConversationFromCache(userId1, userId2);
            if (cachedConversation) {
                return cachedConversation;
            }
        }

        const conversation = await conversationRepository.getDirectConversation(userId1, userId2);
        if (conversation) {
            await cacheService.cacheConversation(conversation);
            await cacheService.cacheDirectConversation(userId1, userId2, conversation);
        }

        return conversation;
    }

    async getUserConversations(userId, filters = {}, useCache = true) {
        if (useCache) {
            const cachedConversations = await cacheService.getUserConversationsFromCache(userId);
            if (cachedConversations && cachedConversations.length > 0) {
                return this.applyConversationFilters(cachedConversations, filters);
            }
        }

        const conversations = await conversationRepository.getUserConversations(userId, filters);

        if (useCache) {
            await cacheService.cacheUserConversations(userId, conversations);

            // Cache individual conversations
            for (const conv of conversations) {
                await cacheService.cacheConversation(conv);
            }
        }

        return conversations;
    }

    applyConversationFilters(conversations, filters) {
        let filtered = [...conversations];

        if (filters.type) {
            filtered = filtered.filter(c => c.type === filters.type);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(c =>
                c.conversation_name.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    async getConversationParticipants(conversationId, useCache = true) {
        if (useCache) {
            const cachedParticipants = await cacheService.getConversationParticipantsFromCache(conversationId);
            if (cachedParticipants && cachedParticipants.length > 0) {
                return cachedParticipants;
            }
        }

        const participants = await conversationRepository.getConversationParticipants(conversationId);

        if (useCache) {
            await cacheService.cacheConversationParticipants(conversationId, participants);
        }

        return participants;
    }

    async addParticipant(conversationId, userId, isAdmin = false) {
        const participant = await conversationParticipantRepository.addParticipant(conversationId, userId, isAdmin);

        // Invalidate caches
        await cacheService.invalidateConversationCache(conversationId);
        await cacheService.cacheUserConversations(userId, null);

        return participant;
    }

    async removeParticipant(conversationId, userId, removerId = null) {
        // Check permissions if removerId is provided
        if (removerId && removerId !== userId) {
            const isRemoverAdmin = await conversationParticipantRepository.isAdmin(conversationId, removerId);
            if (!isRemoverAdmin) {
                throw new Error('Only admins can remove other participants');
            }
        }

        await conversationParticipantRepository.removeParticipant(conversationId, userId);

        // Invalidate caches
        await cacheService.invalidateConversationCache(conversationId);
        await cacheService.cacheUserConversations(userId, null);
    }

    async isParticipant(conversationId, userId, useCache = true) {
        if (useCache) {
            const participants = await this.getConversationParticipants(conversationId, true);
            return participants.some(p => p.user_id === userId);
        }

        return await conversationParticipantRepository.isParticipant(conversationId, userId);
    }

    async getUnreadCount(conversationId, userId, useCache = true) {
        if (useCache) {
            const cachedCount = await cacheService.getConversationUnreadCountFromCache(conversationId, userId);
            if (cachedCount !== null) {
                return cachedCount;
            }
        }

        const count = await conversationRepository.getUnreadCount(conversationId, userId);

        if (useCache) {
            await cacheService.cacheConversationUnreadCount(conversationId, userId, count);
        }

        return count;
    }

    async markAsRead(conversationId, userId) {
        await conversationRepository.markAsRead(conversationId, userId);

        // Update cache
        await cacheService.cacheConversationUnreadCount(conversationId, userId, 0);

        // Invalidate conversation cache to update last read
        const conversation = await this.getConversation(conversationId, false);
        await cacheService.cacheConversation(conversation);
    }

    async getConversationMessages(conversationId, filters = {}, useCache = true) {
        const page = filters.page || 1;
        const limit = filters.limit || 50;

        if (useCache && page === 1) {
            const cachedMessages = await cacheService.getConversationMessagesFromCache(conversationId, page, limit);
            if (cachedMessages && cachedMessages.length > 0) {
                return cachedMessages;
            }
        }

        const messages = await messageRepository.getConversationMessages(conversationId, filters);

        if (useCache && page === 1) {
            await cacheService.cacheConversationMessages(conversationId, messages, page, limit);
        }

        return messages;
    }

    async sendMessage(conversationId, senderId, messageData) {
        // Check if sender is participant
        const isParticipant = await this.isParticipant(conversationId, senderId);
        if (!isParticipant) {
            throw new Error('User is not a participant in this conversation');
        }

        const message = await messageRepository.createMessage({
            conversation_id: conversationId,
            sender_id: senderId,
            ...messageData
        });

        // Cache the message
        await cacheService.cacheMessage(message);

        // Update conversation's last message cache
        await cacheService.cacheConversationLastMessage(conversationId, message);

        // Invalidate conversation messages cache for first page
        await cacheService.invalidateConversationMessagesCache(conversationId);

        // Update conversation cache
        const conversation = await this.getConversation(conversationId, false);
        await cacheService.cacheConversation(conversation);

        // Update unread counts for other participants
        const participants = await this.getConversationParticipants(conversationId);
        for (const participant of participants) {
            if (participant.user_id !== senderId) {
                const currentCount = await this.getUnreadCount(conversationId, participant.user_id, false);
                await cacheService.cacheConversationUnreadCount(conversationId, participant.user_id, (currentCount || 0) + 1);
            }
        }

        return message;
    }

    async searchInConversation(conversationId, searchTerm, userId = null, useCache = true) {
        const cacheKey = `search:conversation:${conversationId}:${searchTerm}:${userId || 'all'}`;

        if (useCache) {
            const cachedResults = await cacheService.getSearchResultsFromCache('conversation', searchTerm, userId);
            if (cachedResults) {
                return cachedResults;
            }
        }

        const messages = await conversationRepository.searchInConversation(conversationId, searchTerm, userId);

        if (useCache) {
            await cacheService.cacheSearchResults('conversation', searchTerm, messages, userId);
        }

        return messages;
    }

    async warmConversationCache(conversationId) {
        const conversation = await this.getConversation(conversationId, false);
        const participants = await this.getConversationParticipants(conversationId, false);
        const messages = await this.getConversationMessages(conversationId, { limit: 50 }, false);

        await cacheService.cacheConversation(conversation);
        await cacheService.cacheConversationParticipants(conversationId, participants);
        await cacheService.cacheConversationMessages(conversationId, messages, 1, 50);

        // Cache for each participant
        for (const participant of participants) {
            const userConversations = await this.getUserConversations(participant.user_id, {}, false);
            await cacheService.cacheUserConversations(participant.user_id, userConversations);
        }
    }

    async getConversationStats(conversationId) {
        const conversation = await this.getConversation(conversationId);
        const participants = await this.getConversationParticipants(conversationId);
        const messages = await this.getConversationMessages(conversationId, { limit: 1 });

        return {
            ...conversation,
            participant_count: participants.length,
            online_participants: participants.filter(p => p.is_online).length,
            total_messages: await this.getTotalMessageCount(conversationId),
            last_message: messages[0] || null,
            created_date: conversation.created_at
        };
    }

    async getTotalMessageCount(conversationId) {
        // This might need a separate repository method
        // For now, we'll estimate from cache or make a DB call
        const messages = await this.getConversationMessages(conversationId, { limit: 1000 }, false);
        return messages.length;
    }
}

// Extend cache service for conversation messages
cacheService.cacheConversationLastMessage = async function (conversationId, message) {
    await this.set(`conversation:${conversationId}:last_message`, message, 300);
};

cacheService.invalidateConversationMessagesCache = async function (conversationId) {
    const pattern = `conversation:${conversationId}:messages:*`;
    await this.flushPattern(pattern);
};

module.exports = new ConversationService();