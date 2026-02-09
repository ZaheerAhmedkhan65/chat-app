const db = require('../../config/database');

class MessageReactionRepository {
    async addReaction(messageId, userId, reaction) {
        const sql = `
            INSERT INTO message_reactions (message_id, user_id, reaction)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE reaction = VALUES(reaction)
        `;
        await db.query(sql, [messageId, userId, reaction]);

        return await this.getReaction(messageId, userId);
    }

    async getReaction(messageId, userId) {
        const sql = `
            SELECT mr.*, u.name, u.avatar_url
            FROM message_reactions mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id = ? AND mr.user_id = ?
        `;
        const [reaction] = await db.query(sql, [messageId, userId]);
        return reaction;
    }

    async removeReaction(messageId, userId) {
        const sql = 'DELETE FROM message_reactions WHERE message_id = ? AND user_id = ?';
        await db.query(sql, [messageId, userId]);
    }

    async getMessageReactions(messageId) {
        const sql = `
            SELECT mr.*, u.name, u.avatar_url
            FROM message_reactions mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id = ?
            ORDER BY mr.created_at
        `;
        return await db.query(sql, [messageId]);
    }

    async getReactionSummary(messageId) {
        const sql = `
            SELECT 
                reaction,
                COUNT(*) as count,
                GROUP_CONCAT(u.name ORDER BY u.name SEPARATOR ', ') as users
            FROM message_reactions mr
            JOIN users u ON mr.user_id = u.id
            WHERE mr.message_id = ?
            GROUP BY reaction
            ORDER BY count DESC
        `;
        return await db.query(sql, [messageId]);
    }

    async getUserReactions(userId, limit = 100) {
        const sql = `
            SELECT mr.*, 
                   m.content as message_content,
                   m.message_type,
                   u2.name as message_sender_name,
                   c.type as conversation_type
            FROM message_reactions mr
            JOIN messages m ON mr.message_id = m.id
            JOIN users u2 ON m.sender_id = u2.id
            JOIN conversations c ON m.conversation_id = c.id
            WHERE mr.user_id = ?
            ORDER BY mr.created_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, limit]);
    }

    async getReactionStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_reactions,
                COUNT(DISTINCT message_id) as unique_messages,
                COUNT(DISTINCT reaction) as unique_reactions,
                reaction as most_used_reaction,
                COUNT(*) as most_used_count
            FROM message_reactions
            WHERE user_id = ?
            GROUP BY reaction
            ORDER BY most_used_count DESC
            LIMIT 1
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats || {};
    }
}

module.exports = new MessageReactionRepository();