const messageRepository = require('../repositories/message.repository');
const messageReactionRepository = require('../repositories/messageReaction.repository');
const messageViewRepository = require('../repositories/messageView.repository');
const starredMessageRepository = require('../repositories/starredMessage.repository');
const messageDraftRepository = require('../repositories/messageDraft.repository');
const cacheService = require('./cache.service');

class MessageService {
    async getMessage(messageId, useCache = true) {
        if (useCache) {
            const cachedMessage = await cacheService.getMessageFromCache(messageId);
            if (cachedMessage) {
                return cachedMessage;
            }
        }

        const message = await messageRepository.getMessageById(messageId);
        if (message) {
            await cacheService.cacheMessage(message);
        }

        return message;
    }

    async updateMessage(messageId, updateData, updaterId) {
        const message = await this.getMessage(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check permissions
        if (message.sender_id !== updaterId) {
            throw new Error('Only the sender can edit the message');
        }

        if (message.is_deleted) {
            throw new Error('Cannot edit deleted message');
        }

        const updatedMessage = await messageRepository.updateMessage(messageId, updateData);

        // Update cache
        await cacheService.cacheMessage(updatedMessage);
        await cacheService.invalidateConversationMessagesCache(updatedMessage.conversation_id);

        return updatedMessage;
    }

    async deleteMessage(messageId, deleterId) {
        const message = await this.getMessage(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check permissions
        const conversationService = require('./conversation.service');
        const isParticipant = await conversationService.isParticipant(message.conversation_id, deleterId);

        if (!isParticipant) {
            throw new Error('Not a participant in this conversation');
        }

        // Only sender or admin can delete
        const isSender = message.sender_id === deleterId;
        const isAdmin = await conversationService.isAdmin(message.conversation_id, deleterId);

        if (!isSender && !isAdmin) {
            throw new Error('Only sender or admin can delete message');
        }

        const deletedMessage = await messageRepository.deleteMessage(messageId, deleterId);

        // Update cache
        await cacheService.cacheMessage(deletedMessage);
        await cacheService.invalidateConversationMessagesCache(message.conversation_id);

        return deletedMessage;
    }

    async addReaction(messageId, userId, reaction) {
        const message = await this.getMessage(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check if user is participant
        const conversationService = require('./conversation.service');
        const isParticipant = await conversationService.isParticipant(message.conversation_id, userId);

        if (!isParticipant) {
            throw new Error('Not a participant in this conversation');
        }

        const reactionObj = await messageReactionRepository.addReaction(messageId, userId, reaction);

        // Invalidate message cache
        await cacheService.invalidateMessageCache(messageId, message.conversation_id);

        return reactionObj;
    }

    async removeReaction(messageId, userId) {
        await messageReactionRepository.removeReaction(messageId, userId);

        // Invalidate message cache
        const message = await this.getMessage(messageId);
        if (message) {
            await cacheService.invalidateMessageCache(messageId, message.conversation_id);
        }
    }

    async getMessageReactions(messageId, useCache = true) {
        const cacheKey = `message:${messageId}:reactions`;

        if (useCache) {
            const cachedReactions = await cacheService.getSearchResultsFromCache('reactions', messageId);
            if (cachedReactions) {
                return cachedReactions;
            }
        }

        const reactions = await messageReactionRepository.getMessageReactions(messageId);

        if (useCache) {
            await cacheService.cacheSearchResults('reactions', messageId, reactions);
        }

        return reactions;
    }

    async markAsViewed(messageId, userId) {
        const message = await this.getMessage(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check if user is participant and not the sender
        if (message.sender_id === userId) {
            return null; // Sender doesn't need to mark their own message as viewed
        }

        const conversationService = require('./conversation.service');
        const isParticipant = await conversationService.isParticipant(message.conversation_id, userId);

        if (!isParticipant) {
            throw new Error('Not a participant in this conversation');
        }

        const view = await messageViewRepository.addView(messageId, userId);

        // Update unread count in cache
        const unreadCount = await conversationService.getUnreadCount(message.conversation_id, userId, false);
        await cacheService.cacheConversationUnreadCount(message.conversation_id, userId, Math.max(0, unreadCount - 1));

        return view;
    }

    async starMessage(messageId, userId) {
        const message = await this.getMessage(messageId);

        if (!message) {
            throw new Error('Message not found');
        }

        // Check if user is participant
        const conversationService = require('./conversation.service');
        const isParticipant = await conversationService.isParticipant(message.conversation_id, userId);

        if (!isParticipant) {
            throw new Error('Not a participant in this conversation');
        }

        const starred = await starredMessageRepository.starMessage(userId, messageId);

        // Invalidate user's starred messages cache
        await cacheService.cacheUserStarredMessages(userId, null);

        return starred;
    }

    async unstarMessage(messageId, userId) {
        await starredMessageRepository.unstarMessage(userId, messageId);

        // Invalidate user's starred messages cache
        await cacheService.cacheUserStarredMessages(userId, null);
    }

    async getUserStarredMessages(userId, filters = {}, useCache = true) {
        if (useCache) {
            const cachedStarred = await cacheService.getUserStarredMessagesFromCache(userId);
            if (cachedStarred && cachedStarred.length > 0) {
                return this.applyStarredFilters(cachedStarred, filters);
            }
        }

        const starredMessages = await starredMessageRepository.getUserStarredMessages(userId, filters);

        if (useCache && !filters.search) {
            await cacheService.cacheUserStarredMessages(userId, starredMessages);
        }

        return starredMessages;
    }

    applyStarredFilters(starredMessages, filters) {
        let filtered = [...starredMessages];

        if (filters.conversationId) {
            filtered = filtered.filter(m => m.conversation_id === filters.conversationId);
        }

        if (filters.conversationType) {
            filtered = filtered.filter(m => m.conversation_type === filters.conversationType);
        }

        if (filters.messageType) {
            filtered = filtered.filter(m => m.message_type === filters.messageType);
        }

        if (filters.search) {
            const searchLower = filters.search.toLowerCase();
            filtered = filtered.filter(m =>
                m.message_content.toLowerCase().includes(searchLower)
            );
        }

        return filtered;
    }

    async saveDraft(userId, conversationId, draftData) {
        const draft = await messageDraftRepository.saveDraft({
            user_id: userId,
            conversation_id: conversationId,
            ...draftData
        });

        // Update cache
        await cacheService.cacheConversationDraft(userId, conversationId, draft);
        await cacheService.cacheUserDrafts(userId, null);

        return draft;
    }

    async getDraft(userId, conversationId, useCache = true) {
        if (useCache) {
            const cachedDraft = await cacheService.getConversationDraftFromCache(userId, conversationId);
            if (cachedDraft) {
                return cachedDraft;
            }
        }

        const draft = await messageDraftRepository.getDraft(userId, conversationId);

        if (useCache && draft) {
            await cacheService.cacheConversationDraft(userId, conversationId, draft);
        }

        return draft;
    }

    async getUserDrafts(userId, useCache = true) {
        if (useCache) {
            const cachedDrafts = await cacheService.getUserDraftsFromCache(userId);
            if (cachedDrafts && cachedDrafts.length > 0) {
                return cachedDrafts;
            }
        }

        const drafts = await messageDraftRepository.getUserDrafts(userId);

        if (useCache) {
            await cacheService.cacheUserDrafts(userId, drafts);
        }

        return drafts;
    }

    async deleteDraft(userId, conversationId) {
        await messageDraftRepository.deleteDraft(userId, conversationId);

        // Invalidate cache
        await cacheService.cacheConversationDraft(userId, conversationId, null);
        await cacheService.cacheUserDrafts(userId, null);
    }

    async convertDraftToMessage(userId, conversationId, messageData = {}) {
        const message = await messageDraftRepository.convertDraftToMessage(userId, conversationId, messageData);

        // Invalidate caches
        await cacheService.cacheConversationDraft(userId, conversationId, null);
        await cacheService.cacheUserDrafts(userId, null);

        // Cache the new message
        await cacheService.cacheMessage(message);

        return message;
    }

    async searchMessages(userId, searchTerm, limit = 50, useCache = true) {
        const cacheKey = `search:messages:${userId}:${searchTerm}`;

        if (useCache) {
            const cachedResults = await cacheService.getSearchResultsFromCache('messages', searchTerm, userId);
            if (cachedResults) {
                return cachedResults.slice(0, limit);
            }
        }

        const messages = await messageRepository.searchMessages(userId, searchTerm, limit * 2);

        if (useCache) {
            await cacheService.cacheSearchResults('messages', searchTerm, messages, userId);
        }

        return messages.slice(0, limit);
    }

    async getMessageThread(messageId, userId = null, useCache = true) {
        const cacheKey = `message_thread:${messageId}:${userId || 'all'}`;

        if (useCache) {
            const cachedThread = await cacheService.getSearchResultsFromCache('thread', messageId, userId);
            if (cachedThread) {
                return cachedThread;
            }
        }

        const thread = await messageRepository.getMessageThread(messageId, userId);

        if (useCache) {
            await cacheService.cacheSearchResults('thread', messageId, thread, userId);
        }

        return thread;
    }

    async getMessagesWithAttachments(conversationId, attachmentType = null, useCache = true) {
        const cacheKey = `attachments:${conversationId}:${attachmentType || 'all'}`;

        if (useCache) {
            const cachedAttachments = await cacheService.getSearchResultsFromCache('attachments', conversationId);
            if (cachedAttachments) {
                if (attachmentType) {
                    return cachedAttachments.filter(a => a.message_type === attachmentType);
                }
                return cachedAttachments;
            }
        }

        const attachments = await messageRepository.getMessagesWithAttachments(conversationId, attachmentType);

        if (useCache) {
            await cacheService.cacheSearchResults('attachments', conversationId, attachments);
        }

        return attachments;
    }

    async getMentionedMessages(userId, limit = 50, useCache = true) {
        if (useCache) {
            const cachedMentions = await cacheService.getSearchResultsFromCache('mentions', userId);
            if (cachedMentions) {
                return cachedMentions.slice(0, limit);
            }
        }

        const mentions = await messageRepository.getMentionedMessages(userId, limit * 2);

        if (useCache) {
            await cacheService.cacheSearchResults('mentions', userId, mentions);
        }

        return mentions.slice(0, limit);
    }

    async warmMessageCache(messageId) {
        const message = await this.getMessage(messageId, false);
        const reactions = await this.getMessageReactions(messageId, false);

        // Cache message and reactions
        await cacheService.cacheMessage(message);
        await cacheService.cacheSearchResults('reactions', messageId, reactions);

        // If it's part of a conversation, warm conversation cache too
        if (message && message.conversation_id) {
            const conversationService = require('./conversation.service');
            await conversationService.warmConversationCache(message.conversation_id);
        }
    }

    async getMessageStats(messageId) {
        const message = await this.getMessage(messageId);
        const reactions = await this.getMessageReactions(messageId);
        const viewCount = await messageViewRepository.getMessageViewCount(messageId);
        const starredCount = await starredMessageRepository.getMessageStarCount(messageId);

        return {
            message,
            reactions_count: reactions.length,
            view_count: viewCount,
            starred_count: starredCount,
            has_replies: await this.hasReplies(messageId)
        };
    }

    async hasReplies(messageId) {
        const replies = await messageRepository.getMessageReplies(messageId);
        return replies.length > 0;
    }
}

module.exports = new MessageService();