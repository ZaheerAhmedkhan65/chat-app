const db = require('../../config/db');

class StarredMessageRepository {
    async starMessage(userId, messageId) {
        const sql = `
            INSERT IGNORE INTO starred_messages (user_id, message_id, created_at)
            VALUES (?, ?, NOW())
        `;
        await db.query(sql, [userId, messageId]);

        return await this.getStarredMessage(userId, messageId);
    }

    async getStarredMessage(userId, messageId) {
        const sql = `
            SELECT sm.*, 
                   m.content as message_content,
                   m.message_type,
                   m.created_at as message_created,
                   u2.name as message_sender_name,
                   u2.avatar_url as message_sender_avatar,
                   c.type as conversation_type
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE sm.user_id = ? AND sm.message_id = ?
        `;
        const [starred] = await db.query(sql, [userId, messageId]);
        return starred;
    }

    async unstarMessage(userId, messageId) {
        const sql = 'DELETE FROM starred_messages WHERE user_id = ? AND message_id = ?';
        await db.query(sql, [userId, messageId]);
    }

    async getUserStarredMessages(userId, filters = {}) {
        let sql = `
            SELECT sm.*, 
                   m.content as message_content,
                   m.message_type,
                   m.attachment_url,
                   m.attachment_metadata,
                   m.created_at as message_created,
                   m.updated_at as message_updated,
                   u2.name as message_sender_name,
                   u2.avatar_url as message_sender_avatar,
                   c.type as conversation_type,
                   CASE 
                       WHEN c.type = 'direct' THEN (
                           SELECT u3.name 
                           FROM conversation_participants cp2
                           JOIN users u3 ON cp2.user_id = u3.id
                           WHERE cp2.conversation_id = c.id 
                           AND cp2.user_id != ?
                           LIMIT 1
                       )
                       WHEN c.type = 'group' THEN (
                           SELECT g.name 
                           FROM conversation_participants cp2
                           JOIN group_members gm ON cp2.user_id = gm.user_id
                           JOIN chat_groups g ON gm.group_id = g.id
                           WHERE cp2.conversation_id = c.id
                           LIMIT 1
                       )
                   END as conversation_name
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE sm.user_id = ?
            AND m.is_deleted = FALSE
        `;

        const params = [userId, userId];

        if (filters.conversationId) {
            sql += ' AND m.conversation_id = ?';
            params.push(filters.conversationId);
        }

        if (filters.conversationType) {
            sql += ' AND c.type = ?';
            params.push(filters.conversationType);
        }

        if (filters.messageType) {
            sql += ' AND m.message_type = ?';
            params.push(filters.messageType);
        }

        if (filters.senderId) {
            sql += ' AND m.sender_id = ?';
            params.push(filters.senderId);
        }

        if (filters.search) {
            sql += ' AND m.content LIKE ?';
            params.push(`%${filters.search}%`);
        }

        sql += ' ORDER BY sm.created_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        if (filters.offset) {
            sql += ' OFFSET ?';
            params.push(filters.offset);
        }

        return await db.query(sql, params);
    }

    async getMessageStarCount(messageId) {
        const sql = 'SELECT COUNT(*) as count FROM starred_messages WHERE message_id = ?';
        const [result] = await db.query(sql, [messageId]);
        return result.count;
    }

    async getMessageStarredBy(messageId) {
        const sql = `
            SELECT sm.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online
            FROM starred_messages sm
            JOIN users u ON sm.user_id = u.id
            WHERE sm.message_id = ?
            ORDER BY sm.created_at
        `;
        return await db.query(sql, [messageId]);
    }

    async isStarred(userId, messageId) {
        const sql = 'SELECT COUNT(*) as count FROM starred_messages WHERE user_id = ? AND message_id = ?';
        const [result] = await db.query(sql, [userId, messageId]);
        return result.count > 0;
    }

    async getStarredMessageCount(userId) {
        const sql = 'SELECT COUNT(*) as count FROM starred_messages WHERE user_id = ?';
        const [result] = await db.query(sql, [userId]);
        return result.count;
    }

    async getRecentStarredMessages(userId, days = 7) {
        const sql = `
            SELECT sm.*, 
                   m.content as message_content,
                   m.message_type,
                   m.created_at as message_created,
                   u2.name as message_sender_name,
                   c.type as conversation_type
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE sm.user_id = ?
            AND sm.created_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            AND m.is_deleted = FALSE
            ORDER BY sm.created_at DESC
        `;
        return await db.query(sql, [userId, days]);
    }

    async getStarredStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_starred,
                COUNT(DISTINCT m.conversation_id) as conversations_with_starred,
                COUNT(DISTINCT m.sender_id) as unique_senders_starred,
                COUNT(CASE WHEN m.message_type = 'text' THEN 1 END) as text_starred,
                COUNT(CASE WHEN m.message_type = 'image' THEN 1 END) as image_starred,
                COUNT(CASE WHEN m.message_type = 'video' THEN 1 END) as video_starred,
                COUNT(CASE WHEN m.message_type = 'audio' THEN 1 END) as audio_starred,
                MIN(sm.created_at) as first_starred,
                MAX(sm.created_at) as last_starred
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            WHERE sm.user_id = ?
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats;
    }

    async getMostStarredMessages(userId, limit = 10) {
        const sql = `
            SELECT 
                m.*,
                COUNT(DISTINCT sm2.user_id) as star_count,
                u2.name as sender_name,
                u2.avatar_url as sender_avatar,
                c.type as conversation_type
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            LEFT JOIN starred_messages sm2 ON m.id = sm2.message_id
            WHERE sm.user_id = ?
            AND m.is_deleted = FALSE
            GROUP BY m.id
            ORDER BY star_count DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, limit]);
    }

    async bulkStarMessages(userId, messageIds) {
        if (messageIds.length === 0) return [];

        // Filter out already starred messages
        const placeholders = messageIds.map(() => '?').join(',');
        const alreadyStarredSql = `
            SELECT message_id 
            FROM starred_messages 
            WHERE user_id = ? 
            AND message_id IN (${placeholders})
        `;
        const alreadyStarred = await db.query(alreadyStarredSql, [userId, ...messageIds]);
        const alreadyStarredIds = alreadyStarred.map(row => row.message_id);

        const newMessageIds = messageIds.filter(id => !alreadyStarredIds.includes(id));

        if (newMessageIds.length === 0) return [];

        // Insert new starred messages
        const insertPlaceholders = newMessageIds.map(() => '(?, ?, NOW())').join(',');
        const insertValues = [];

        newMessageIds.forEach(messageId => {
            insertValues.push(userId, messageId);
        });

        const insertSql = `
            INSERT INTO starred_messages (user_id, message_id, created_at)
            VALUES ${insertPlaceholders}
        `;

        await db.query(insertSql, insertValues);

        return newMessageIds;
    }

    async bulkUnstarMessages(userId, messageIds) {
        if (messageIds.length === 0) return 0;

        const placeholders = messageIds.map(() => '?').join(',');
        const sql = `
            DELETE FROM starred_messages 
            WHERE user_id = ? 
            AND message_id IN (${placeholders})
        `;
        const result = await db.query(sql, [userId, ...messageIds]);
        return result.affectedRows;
    }

    async searchStarredMessages(userId, searchTerm) {
        const sql = `
            SELECT sm.*, 
                   m.content as message_content,
                   m.message_type,
                   m.created_at as message_created,
                   u2.name as message_sender_name,
                   u2.avatar_url as message_sender_avatar,
                   c.type as conversation_type
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE sm.user_id = ?
            AND m.is_deleted = FALSE
            AND (m.content LIKE ? OR u2.name LIKE ?)
            ORDER BY sm.created_at DESC
            LIMIT 50
        `;
        return await db.query(sql, [userId, `%${searchTerm}%`, `%${searchTerm}%`]);
    }

    async getStarredByConversation(userId) {
        const sql = `
            SELECT 
                c.id as conversation_id,
                c.type as conversation_type,
                COUNT(DISTINCT sm.message_id) as starred_count,
                MAX(sm.created_at) as last_starred,
                CASE 
                    WHEN c.type = 'direct' THEN (
                        SELECT u3.name 
                        FROM conversation_participants cp2
                        JOIN users u3 ON cp2.user_id = u3.id
                        WHERE cp2.conversation_id = c.id 
                        AND cp2.user_id != ?
                        LIMIT 1
                    )
                    WHEN c.type = 'group' THEN (
                        SELECT g.name 
                        FROM conversation_participants cp2
                        JOIN group_members gm ON cp2.user_id = gm.user_id
                        JOIN chat_groups g ON gm.group_id = g.id
                        WHERE cp2.conversation_id = c.id
                        LIMIT 1
                    )
                END as conversation_name
            FROM starred_messages sm
            JOIN messages m ON sm.message_id = m.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE sm.user_id = ?
            AND m.is_deleted = FALSE
            GROUP BY c.id
            ORDER BY last_starred DESC
        `;
        return await db.query(sql, [userId, userId]);
    }
}

module.exports = new StarredMessageRepository();