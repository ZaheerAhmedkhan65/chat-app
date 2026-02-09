const ApiResponse = require('../utils/response');
const {
    NotFoundError,
    ValidationError,
    ForbiddenError,
    ConflictError
} = require('../utils/error');
const conversationService = require('../services/conversation.service');
const messageService = require('../services/message.service');
const notificationService = require('../services/notification.service');

class ConversationController {
    async createDirectConversation(req, res, next) {
        try {
            const userId = req.user.id;
            const { other_user_id } = req.body;

            if (!other_user_id) {
                throw new ValidationError('Other user ID is required');
            }

            if (userId === other_user_id) {
                throw new ValidationError('Cannot create conversation with yourself');
            }

            const conversation = await conversationService.createDirectConversation(userId, other_user_id);

            res.status(201).json(ApiResponse.success({
                conversation
            }, 'Conversation created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async createGroupConversation(req, res, next) {
        try {
            const userId = req.user.id;
            const { group_id } = req.body;

            if (!group_id) {
                throw new ValidationError('Group ID is required');
            }

            // Check if user is group member
            const groupService = require('../services/group.service');
            const isMember = await groupService.isMember(group_id, userId);
            if (!isMember) {
                throw new ForbiddenError('You are not a member of this group');
            }

            const conversation = await conversationService.createGroupConversation(group_id);

            res.status(201).json(ApiResponse.success({
                conversation
            }, 'Group conversation created successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getConversation(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            // Check if user is participant
            const isParticipant = await conversationService.isParticipant(conversationId, userId);
            if (!isParticipant) {
                throw new ForbiddenError('You are not a participant in this conversation');
            }

            const conversation = await conversationService.getConversation(conversationId);

            res.json(ApiResponse.success({
                conversation
            }, 'Conversation retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUserConversations(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                type,
                search,
                limit = 50,
                offset = 0
            } = req.query;

            const filters = {};
            if (type) filters.type = type;
            if (search) filters.search = search;
            if (limit) filters.limit = parseInt(limit);
            if (offset) filters.offset = parseInt(offset);

            const conversations = await conversationService.getUserConversations(userId, filters);

            // Get unread counts for each conversation
            const conversationsWithUnread = await Promise.all(
                conversations.map(async (conv) => {
                    const unreadCount = await conversationService.getUnreadCount(conv.id, userId);
                    return {
                        ...conv,
                        unread_count: unreadCount
                    };
                })
            );

            res.json(ApiResponse.paginate(conversationsWithUnread, {
                total: conversationsWithUnread.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async updateMessage(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);
            const { content } = req.body;

            if (!content) {
                throw new ValidationError('Content is required');
            }

            const message = await messageService.updateMessage(messageId, { content }, userId);

            res.json(ApiResponse.success({
                message
            }, 'Message updated successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getConversationMessages(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);
            const {
                before_id,
                after_id,
                sender_id,
                message_type,
                search,
                limit = 50,
                page = 1
            } = req.query;

            // Check if user is participant
            const isParticipant = await conversationService.isParticipant(conversationId, userId);
            if (!isParticipant) {
                throw new ForbiddenError('You are not a participant in this conversation');
            }

            const filters = {};
            if (before_id) filters.beforeId = parseInt(before_id);
            if (after_id) filters.afterId = parseInt(after_id);
            if (sender_id) filters.senderId = parseInt(sender_id);
            if (message_type) filters.messageType = message_type;
            if (search) filters.search = search;
            if (limit) filters.limit = parseInt(limit);
            filters.userId = userId; // For starred flag

            const messages = await conversationService.getConversationMessages(conversationId, filters);

            // Mark messages as viewed if this is the latest page
            if (page === 1) {
                await conversationService.markAsRead(conversationId, userId);
            }

            res.json(ApiResponse.paginate(messages, {
                total: messages.length,
                limit: parseInt(limit),
                page: parseInt(page)
            }));
        } catch (error) {
            next(error);
        }
    }

    async sendMessage(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);
            const {
                content,
                message_type = 'text',
                attachment_url,
                attachment_metadata,
                parent_message_id,
                mentions
            } = req.body;

            if (!content && !attachment_url) {
                throw new ValidationError('Message content or attachment is required');
            }

            const message = await conversationService.sendMessage(conversationId, userId, {
                content,
                message_type,
                attachment_url,
                attachment_metadata,
                parent_message_id,
                mentions: mentions ? JSON.parse(mentions) : null
            });

            // Send notifications to other participants
            await notificationService.sendMessageNotification(userId, conversationId, message);

            // Send mention notifications
            if (mentions) {
                const mentionedUsers = JSON.parse(mentions);
                for (const mentionedUserId of mentionedUsers) {
                    if (mentionedUserId !== userId) {
                        await notificationService.sendMentionNotification(mentionedUserId, userId, message.id);
                    }
                }
            }

            res.status(201).json(ApiResponse.success({
                message
            }, 'Message sent successfully'));
        } catch (error) {
            next(error);
        }
    }

    async searchInConversation(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);
            const { search } = req.query;

            if (!search || search.trim().length < 2) {
                throw new ValidationError('Search term must be at least 2 characters');
            }

            const messages = await conversationService.searchInConversation(conversationId, search, userId);

            res.json(ApiResponse.success(messages, 'Search results retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteMessage(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            const message = await messageService.deleteMessage(messageId, userId);

            res.json(ApiResponse.success({
                message
            }, 'Message deleted successfully'));
        } catch (error) {
            next(error);
        }
    }

    async addReaction(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);
            const { reaction } = req.body;

            if (!reaction) {
                throw new ValidationError('Reaction is required');
            }

            const reactionObj = await messageService.addReaction(messageId, userId, reaction);

            // Send notification
            await notificationService.sendReactionNotification(userId, messageId, reaction);

            res.status(201).json(ApiResponse.success({
                reaction: reactionObj
            }, 'Reaction added successfully'));
        } catch (error) {
            next(error);
        }
    }

    async removeReaction(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            await messageService.removeReaction(messageId, userId);

            res.json(ApiResponse.success(null, 'Reaction removed successfully'));
        } catch (error) {
            next(error);
        }
    }

    async markAsViewed(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            const view = await messageService.markAsViewed(messageId, userId);

            res.json(ApiResponse.success({
                view
            }, 'Message marked as viewed'));
        } catch (error) {
            next(error);
        }
    }

    async starMessage(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            const starred = await messageService.starMessage(messageId, userId);

            res.status(201).json(ApiResponse.success({
                starred
            }, 'Message starred successfully'));
        } catch (error) {
            next(error);
        }
    }

    async unstarMessage(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            await messageService.unstarMessage(messageId, userId);

            res.json(ApiResponse.success(null, 'Message unstarred successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getStarredMessages(req, res, next) {
        try {
            const userId = req.user.id;
            const {
                conversation_id,
                conversation_type,
                message_type,
                search,
                limit = 50,
                offset = 0
            } = req.query;

            const filters = {};
            if (conversation_id) filters.conversationId = parseInt(conversation_id);
            if (conversation_type) filters.conversationType = conversation_type;
            if (message_type) filters.messageType = message_type;
            if (search) filters.search = search;
            if (limit) filters.limit = parseInt(limit);
            if (offset) filters.offset = parseInt(offset);

            const starredMessages = await messageService.getUserStarredMessages(userId, filters);

            res.json(ApiResponse.paginate(starredMessages, {
                total: starredMessages.length,
                limit: parseInt(limit),
                offset: parseInt(offset)
            }));
        } catch (error) {
            next(error);
        }
    }

    async getConversationStats(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            // Check if user is participant
            const isParticipant = await conversationService.isParticipant(conversationId, userId);
            if (!isParticipant) {
                throw new ForbiddenError('You are not a participant in this conversation');
            }

            const stats = await conversationService.getConversationStats(conversationId);

            res.json(ApiResponse.success(stats, 'Conversation stats retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getUnreadCount(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            const unreadCount = await conversationService.getUnreadCount(conversationId, userId);

            res.json(ApiResponse.success({
                unread_count: unreadCount
            }, 'Unread count retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async markAllAsRead(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            await conversationService.markAsRead(conversationId, userId);

            res.json(ApiResponse.success(null, 'All messages marked as read'));
        } catch (error) {
            next(error);
        }
    }

    async getMessageThread(req, res, next) {
        try {
            const userId = req.user.id;
            const messageId = parseInt(req.params.messageId);

            const thread = await messageService.getMessageThread(messageId, userId);

            res.json(ApiResponse.success(thread, 'Message thread retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getAttachments(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);
            const { type } = req.query;

            // Check if user is participant
            const isParticipant = await conversationService.isParticipant(conversationId, userId);
            if (!isParticipant) {
                throw new ForbiddenError('You are not a participant in this conversation');
            }

            const attachments = await messageService.getMessagesWithAttachments(conversationId, type);

            res.json(ApiResponse.success(attachments, 'Attachments retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getMentionedMessages(req, res, next) {
        try {
            const userId = req.user.id;
            const { limit = 50 } = req.query;

            const mentionedMessages = await messageService.getMentionedMessages(userId, parseInt(limit));

            res.json(ApiResponse.success(mentionedMessages, 'Mentioned messages retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async saveDraft(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);
            const { content, attachments } = req.body;

            const draft = await messageService.saveDraft(userId, conversationId, {
                content,
                attachments: attachments ? JSON.parse(attachments) : null
            });

            res.status(201).json(ApiResponse.success({
                draft
            }, 'Draft saved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async getDraft(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            const draft = await messageService.getDraft(userId, conversationId);

            res.json(ApiResponse.success({
                draft
            }, 'Draft retrieved successfully'));
        } catch (error) {
            next(error);
        }
    }

    async deleteDraft(req, res, next) {
        try {
            const userId = req.user.id;
            const conversationId = parseInt(req.params.conversationId);

            await messageService.deleteDraft(userId, conversationId);

            res.json(ApiResponse.success(null, 'Draft deleted successfully'));
        } catch (error) {
            next(error);
        }
    }
}

module.exports = new ConversationController();