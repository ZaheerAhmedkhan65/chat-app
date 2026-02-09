const db = require('../../config/database');

class MessageRepository {
    async createMessage(messageData) {
        const sql = `
            INSERT INTO messages 
            (conversation_id, sender_id, parent_message_id, message_type, 
             content, attachment_url, attachment_metadata, mentions, status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            messageData.conversation_id,
            messageData.sender_id,
            messageData.parent_message_id || null,
            messageData.message_type || 'text',
            messageData.content,
            messageData.attachment_url,
            messageData.attachment_metadata ? JSON.stringify(messageData.attachment_metadata) : null,
            messageData.mentions ? JSON.stringify(messageData.mentions) : null,
            messageData.status || 'sent'
        ];

        const result = await db.query(sql, params);
        const messageId = result.insertId;

        // Update conversation's last message
        const conversationRepo = require('./conversation.repository');
        await conversationRepo.updateLastMessage(messageData.conversation_id, messageId);

        return await this.getMessageById(messageId);
    }

    async getMessageById(messageId) {
        const sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar,
                   pm.content as parent_message_content,
                   pu.name as parent_message_sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            LEFT JOIN messages pm ON m.parent_message_id = pm.id
            LEFT JOIN users pu ON pm.sender_id = pu.id
            WHERE m.id = ?
        `;
        const [message] = await db.query(sql, [messageId]);
        return message;
    }

    async getConversationMessages(conversationId, filters = {}) {
        let sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar,
                   COUNT(DISTINCT mr.id) as reaction_count,
                   COUNT(DISTINCT mv.id) as view_count,
                   EXISTS(
                       SELECT 1 FROM starred_messages sm 
                       WHERE sm.message_id = m.id AND sm.user_id = ?
                   ) as is_starred
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            LEFT JOIN message_reactions mr ON m.id = mr.message_id
            LEFT JOIN message_views mv ON m.id = mv.message_id
            WHERE m.conversation_id = ?
            AND m.is_deleted = FALSE
        `;

        const params = [filters.userId || 0, conversationId];

        if (filters.beforeId) {
            sql += ' AND m.id < ?';
            params.push(filters.beforeId);
        }

        if (filters.afterId) {
            sql += ' AND m.id > ?';
            params.push(filters.afterId);
        }

        if (filters.senderId) {
            sql += ' AND m.sender_id = ?';
            params.push(filters.senderId);
        }

        if (filters.messageType) {
            sql += ' AND m.message_type = ?';
            params.push(filters.messageType);
        }

        if (filters.search) {
            sql += ' AND m.content LIKE ?';
            params.push(`%${filters.search}%`);
        }

        sql += ' GROUP BY m.id ORDER BY m.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await db.query(sql, params);
    }

    async updateMessage(messageId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                if (key === 'attachment_metadata' || key === 'mentions') {
                    fields.push(`${key} = ?`);
                    values.push(JSON.stringify(updateData[key]));
                } else {
                    fields.push(`${key} = ?`);
                    values.push(updateData[key]);
                }
            }
        });

        if (fields.length === 0) {
            return await this.getMessageById(messageId);
        }

        // If updating content, mark as edited
        if (updateData.content) {
            fields.push('is_edited = TRUE');
            fields.push('edited_at = NOW()');
        }

        values.push(messageId);
        const sql = `UPDATE messages SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, values);

        return await this.getMessageById(messageId);
    }

    async deleteMessage(messageId, deletedBy = null) {
        const sql = `
            UPDATE messages 
            SET is_deleted = TRUE, 
                deleted_at = NOW(), 
                deleted_by = ?,
                content = '[This message was deleted]',
                attachment_url = NULL,
                attachment_metadata = NULL
            WHERE id = ?
        `;
        await db.query(sql, [deletedBy, messageId]);

        return await this.getMessageById(messageId);
    }

    async getMessageReplies(parentMessageId, userId = null) {
        let sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.parent_message_id = ?
            AND m.is_deleted = FALSE
        `;

        const params = [parentMessageId];

        if (userId) {
            sql += ' AND (m.deleted_by IS NULL OR m.deleted_by = ?)';
            params.push(userId);
        }

        sql += ' ORDER BY m.created_at ASC';

        return await db.query(sql, params);
    }

    async getMessageThread(messageId, userId = null) {
        // Get the message and all its replies recursively
        const sql = `
            WITH RECURSIVE message_thread AS (
                SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, 0 as depth
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.id = ?
                
                UNION ALL
                
                SELECT m.*, u.name as sender_name, u.avatar_url as sender_avatar, mt.depth + 1
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                JOIN message_thread mt ON m.parent_message_id = mt.id
                WHERE m.is_deleted = FALSE
            )
            SELECT * FROM message_thread
            WHERE is_deleted = FALSE
            ORDER BY depth, created_at
        `;

        return await db.query(sql, [messageId]);
    }

    async updateMessageStatus(messageId, status) {
        const sql = 'UPDATE messages SET status = ? WHERE id = ?';
        await db.query(sql, [status, messageId]);

        return await this.getMessageById(messageId);
    }

    async bulkUpdateStatus(messageIds, status) {
        if (messageIds.length === 0) return;

        const placeholders = messageIds.map(() => '?').join(',');
        const sql = `UPDATE messages SET status = ? WHERE id IN (${placeholders})`;
        await db.query(sql, [status, ...messageIds]);
    }

    async getUnsentMessages(userId) {
        const sql = `
            SELECT m.*, c.type as conversation_type
            FROM messages m
            JOIN conversations c ON m.conversation_id = c.id
            WHERE m.sender_id = ? 
            AND m.status = 'sending'
            ORDER BY m.created_at
        `;
        return await db.query(sql, [userId]);
    }

    async getMessagesWithAttachments(conversationId, attachmentType = null) {
        let sql = `
            SELECT m.*, u.name as sender_name
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            AND m.attachment_url IS NOT NULL
            AND m.is_deleted = FALSE
        `;

        const params = [conversationId];

        if (attachmentType) {
            sql += ' AND m.message_type = ?';
            params.push(attachmentType);
        }

        sql += ' ORDER BY m.created_at DESC';

        return await db.query(sql, params);
    }

    async searchMessages(userId, searchTerm, limit = 50) {
        const sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar,
                   c.type as conversation_type
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            JOIN conversations c ON m.conversation_id = c.id
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = ?
            AND cp.left_at IS NULL
            AND m.is_deleted = FALSE
            AND (m.content LIKE ? OR u.name LIKE ?)
            AND (m.deleted_by IS NULL OR m.deleted_by = ?)
            ORDER BY m.created_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, `%${searchTerm}%`, `%${searchTerm}%`, userId, limit]);
    }

    async getMessageStats(conversationId) {
        const sql = `
            SELECT 
                COUNT(*) as total_messages,
                COUNT(DISTINCT sender_id) as unique_senders,
                MIN(created_at) as first_message,
                MAX(created_at) as last_message,
                COUNT(CASE WHEN message_type = 'text' THEN 1 END) as text_count,
                COUNT(CASE WHEN message_type = 'image' THEN 1 END) as image_count,
                COUNT(CASE WHEN message_type = 'video' THEN 1 END) as video_count,
                COUNT(CASE WHEN message_type = 'audio' THEN 1 END) as audio_count,
                COUNT(CASE WHEN message_type = 'file' THEN 1 END) as file_count,
                COUNT(CASE WHEN is_edited = TRUE THEN 1 END) as edited_count
            FROM messages
            WHERE conversation_id = ?
            AND is_deleted = FALSE
        `;
        const [stats] = await db.query(sql, [conversationId]);
        return stats;
    }

    async getMentionedMessages(userId, limit = 50) {
        const sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar,
                   c.type as conversation_type
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            JOIN conversations c ON m.conversation_id = c.id
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            WHERE cp.user_id = ?
            AND cp.left_at IS NULL
            AND m.is_deleted = FALSE
            AND JSON_CONTAINS(m.mentions, JSON_ARRAY(?))
            ORDER BY m.created_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, userId, limit]);
    }
}

module.exports = new MessageRepository();