const db = require('../../config/db');

class MessageViewRepository {
    async addView(messageId, userId) {
        const sql = `
            INSERT IGNORE INTO message_views (message_id, user_id, viewed_at)
            VALUES (?, ?, NOW())
        `;
        await db.query(sql, [messageId, userId]);

        return await this.getView(messageId, userId);
    }

    async getView(messageId, userId) {
        const sql = `
            SELECT mv.*, 
                   u.name as viewer_name,
                   u.avatar_url as viewer_avatar
            FROM message_views mv
            JOIN users u ON mv.user_id = u.id
            WHERE mv.message_id = ? AND mv.user_id = ?
        `;
        const [view] = await db.query(sql, [messageId, userId]);
        return view;
    }

    async getMessageViews(messageId) {
        const sql = `
            SELECT mv.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online
            FROM message_views mv
            JOIN users u ON mv.user_id = u.id
            WHERE mv.message_id = ?
            ORDER BY mv.viewed_at
        `;
        return await db.query(sql, [messageId]);
    }

    async getMessageViewCount(messageId) {
        const sql = 'SELECT COUNT(*) as count FROM message_views WHERE message_id = ?';
        const [result] = await db.query(sql, [messageId]);
        return result.count;
    }

    async hasViewed(messageId, userId) {
        const sql = 'SELECT COUNT(*) as count FROM message_views WHERE message_id = ? AND user_id = ?';
        const [result] = await db.query(sql, [messageId, userId]);
        return result.count > 0;
    }

    async getUnviewedMessages(conversationId, userId) {
        const sql = `
            SELECT m.*
            FROM messages m
            WHERE m.conversation_id = ?
            AND m.sender_id != ?
            AND NOT EXISTS (
                SELECT 1 FROM message_views mv 
                WHERE mv.message_id = m.id AND mv.user_id = ?
            )
            ORDER BY m.created_at
        `;
        return await db.query(sql, [conversationId, userId, userId]);
    }

    async getUserViewedMessages(userId, filters = {}) {
        let sql = `
            SELECT mv.*, 
                   m.content as message_content,
                   m.message_type,
                   m.sender_id as message_sender_id,
                   u2.name as message_sender_name,
                   c.type as conversation_type
            FROM message_views mv
            JOIN messages m ON mv.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE mv.user_id = ?
        `;

        const params = [userId];

        if (filters.conversationId) {
            sql += ' AND m.conversation_id = ?';
            params.push(filters.conversationId);
        }

        if (filters.startDate) {
            sql += ' AND mv.viewed_at >= ?';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            sql += ' AND mv.viewed_at <= ?';
            params.push(filters.endDate);
        }

        sql += ' ORDER BY mv.viewed_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await db.query(sql, params);
    }

    async getConversationViews(conversationId, userId = null) {
        let sql = `
            SELECT 
                m.id as message_id,
                m.sender_id,
                m.created_at as message_created,
                COUNT(DISTINCT mv.user_id) as view_count,
                GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as viewers
            FROM messages m
            LEFT JOIN message_views mv ON m.id = mv.message_id
            LEFT JOIN users u ON mv.user_id = u.id
            WHERE m.conversation_id = ?
        `;

        const params = [conversationId];

        if (userId) {
            sql += ' AND m.sender_id = ?';
            params.push(userId);
        }

        sql += ' GROUP BY m.id ORDER BY m.created_at DESC';

        return await db.query(sql, params);
    }

    async getViewStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_views,
                COUNT(DISTINCT message_id) as unique_messages,
                COUNT(DISTINCT m.conversation_id) as unique_conversations,
                MIN(viewed_at) as first_view,
                MAX(viewed_at) as last_view,
                COUNT(CASE WHEN m.sender_id != ? THEN 1 END) as others_messages_viewed
            FROM message_views mv
            JOIN messages m ON mv.message_id = m.id
            WHERE mv.user_id = ?
        `;
        const [stats] = await db.query(sql, [userId, userId]);
        return stats;
    }

    async getMessagesViewedByUser(userId, messageIds) {
        if (messageIds.length === 0) return [];

        const placeholders = messageIds.map(() => '?').join(',');
        const sql = `
            SELECT message_id 
            FROM message_views 
            WHERE user_id = ? 
            AND message_id IN (${placeholders})
        `;
        const results = await db.query(sql, [userId, ...messageIds]);
        return results.map(row => row.message_id);
    }

    async bulkAddViews(messageIds, userId) {
        if (messageIds.length === 0) return [];

        const placeholders = messageIds.map(() => '(?, ?, NOW())').join(',');
        const values = [];

        messageIds.forEach(messageId => {
            values.push(messageId, userId);
        });

        const sql = `
            INSERT IGNORE INTO message_views (message_id, user_id, viewed_at)
            VALUES ${placeholders}
        `;

        await db.query(sql, values);

        // Return viewed message IDs
        const placeholders2 = messageIds.map(() => '?').join(',');
        const sql2 = `
            SELECT message_id 
            FROM message_views 
            WHERE user_id = ? 
            AND message_id IN (${placeholders2})
        `;

        const results = await db.query(sql2, [userId, ...messageIds]);
        return results.map(row => row.message_id);
    }

    async getRecentViews(userId, hours = 24) {
        const sql = `
            SELECT mv.*, 
                   m.content as message_content,
                   m.message_type,
                   u2.name as message_sender_name,
                   u2.avatar_url as message_sender_avatar,
                   c.type as conversation_type
            FROM message_views mv
            JOIN messages m ON mv.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE mv.user_id = ?
            AND mv.viewed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            ORDER BY mv.viewed_at DESC
        `;
        return await db.query(sql, [userId, hours]);
    }

    async getUnreadConversations(userId) {
        const sql = `
            SELECT 
                c.id as conversation_id,
                c.type,
                COUNT(DISTINCT m.id) as unread_count,
                MAX(m.created_at) as last_unread_message
            FROM conversations c
            JOIN conversation_participants cp ON c.id = cp.conversation_id
            JOIN messages m ON c.id = m.conversation_id
            WHERE cp.user_id = ?
            AND cp.left_at IS NULL
            AND m.sender_id != ?
            AND NOT EXISTS (
                SELECT 1 FROM message_views mv 
                WHERE mv.message_id = m.id AND mv.user_id = ?
            )
            GROUP BY c.id
            HAVING unread_count > 0
            ORDER BY last_unread_message DESC
        `;
        return await db.query(sql, [userId, userId, userId]);
    }
}

module.exports = new MessageViewRepository();