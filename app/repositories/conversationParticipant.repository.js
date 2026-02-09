const db = require('../../config/db');

class ConversationParticipantRepository {
    async addParticipant(conversationId, userId, isAdmin = false) {
        const sql = `
            INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                left_at = NULL,
                is_admin = COALESCE(?, is_admin)
        `;
        await db.query(sql, [conversationId, userId, isAdmin, isAdmin]);

        return await this.getParticipant(conversationId, userId);
    }

    async getParticipant(conversationId, userId) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   u.last_seen_at
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ? AND cp.user_id = ?
        `;
        const [participant] = await db.query(sql, [conversationId, userId]);
        return participant;
    }

    async getParticipants(conversationId) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   u.last_seen_at
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            ORDER BY cp.is_admin DESC, u.name
        `;
        return await db.query(sql, [conversationId]);
    }

    async removeParticipant(conversationId, userId) {
        const sql = 'UPDATE conversation_participants SET left_at = NOW() WHERE conversation_id = ? AND user_id = ?';
        await db.query(sql, [conversationId, userId]);
    }

    async updateParticipant(conversationId, userId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.getParticipant(conversationId, userId);
        }

        values.push(conversationId, userId);
        const sql = `UPDATE conversation_participants SET ${fields.join(', ')} WHERE conversation_id = ? AND user_id = ?`;
        await db.query(sql, values);

        return await this.getParticipant(conversationId, userId);
    }

    async isParticipant(conversationId, userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM conversation_participants 
            WHERE conversation_id = ? 
            AND user_id = ? 
            AND left_at IS NULL
        `;
        const [result] = await db.query(sql, [conversationId, userId]);
        return result.count > 0;
    }

    async isAdmin(conversationId, userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM conversation_participants 
            WHERE conversation_id = ? 
            AND user_id = ? 
            AND left_at IS NULL
            AND is_admin = TRUE
        `;
        const [result] = await db.query(sql, [conversationId, userId]);
        return result.count > 0;
    }

    async toggleMute(conversationId, userId) {
        const sql = `
            UPDATE conversation_participants 
            SET is_muted = NOT is_muted 
            WHERE conversation_id = ? AND user_id = ?
        `;
        await db.query(sql, [conversationId, userId]);

        const [participant] = await db.query(
            'SELECT is_muted FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
            [conversationId, userId]
        );
        return participant.is_muted;
    }

    async toggleAdmin(conversationId, userId) {
        const sql = `
            UPDATE conversation_participants 
            SET is_admin = NOT is_admin 
            WHERE conversation_id = ? AND user_id = ?
        `;
        await db.query(sql, [conversationId, userId]);

        const [participant] = await db.query(
            'SELECT is_admin FROM conversation_participants WHERE conversation_id = ? AND user_id = ?',
            [conversationId, userId]
        );
        return participant.is_admin;
    }

    async getParticipantCount(conversationId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM conversation_participants 
            WHERE conversation_id = ? 
            AND left_at IS NULL
        `;
        const [result] = await db.query(sql, [conversationId]);
        return result.count;
    }

    async getOnlineParticipants(conversationId) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url, 
                   u.last_seen_at
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            AND u.is_online = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [conversationId]);
    }

    async getMutedParticipants(conversationId) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            AND cp.is_muted = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [conversationId]);
    }

    async getAdmins(conversationId) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            AND cp.is_admin = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [conversationId]);
    }

    async getUserConversations(userId, filters = {}) {
        let sql = `
            SELECT 
                cp.*,
                c.type as conversation_type,
                c.updated_at as conversation_updated,
                (SELECT COUNT(*) FROM messages m 
                 WHERE m.conversation_id = c.id 
                 AND m.sender_id != ?
                 AND m.created_at > cp.joined_at
                 AND NOT EXISTS (
                     SELECT 1 FROM message_views mv 
                     WHERE mv.message_id = m.id AND mv.user_id = ?
                 )) as unread_count
            FROM conversation_participants cp
            JOIN conversations c ON cp.conversation_id = c.id
            WHERE cp.user_id = ?
            AND cp.left_at IS NULL
        `;

        const params = [userId, userId, userId];

        if (filters.conversationType) {
            sql += ' AND c.type = ?';
            params.push(filters.conversationType);
        }

        if (filters.isMuted !== undefined) {
            sql += ' AND cp.is_muted = ?';
            params.push(filters.isMuted);
        }

        sql += ' ORDER BY c.updated_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await db.query(sql, params);
    }

    async bulkAddParticipants(conversationId, userIds, isAdmin = false) {
        if (userIds.length === 0) return [];

        const placeholders = userIds.map(() => '(?, ?, ?)').join(',');
        const values = [];

        userIds.forEach(userId => {
            values.push(conversationId, userId, isAdmin);
        });

        const sql = `
            INSERT INTO conversation_participants (conversation_id, user_id, is_admin)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE 
                left_at = NULL,
                is_admin = COALESCE(VALUES(is_admin), is_admin)
        `;

        await db.query(sql, values);

        // Return added participants
        const placeholders2 = userIds.map(() => '?').join(',');
        const sql2 = `
            SELECT cp.*, u.name, u.avatar_url
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ? AND cp.user_id IN (${placeholders2})
        `;

        return await db.query(sql2, [conversationId, ...userIds]);
    }

    async getParticipantStats(conversationId) {
        const sql = `
            SELECT 
                COUNT(DISTINCT cp.user_id) as total_participants,
                COUNT(DISTINCT CASE WHEN u.is_online = TRUE THEN cp.user_id END) as online_participants,
                COUNT(DISTINCT CASE WHEN cp.is_admin = TRUE THEN cp.user_id END) as admin_count,
                COUNT(DISTINCT CASE WHEN cp.is_muted = TRUE THEN cp.user_id END) as muted_count,
                MIN(cp.joined_at) as first_joined,
                MAX(cp.joined_at) as last_joined
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
        `;
        const [stats] = await db.query(sql, [conversationId]);
        return stats;
    }

    async searchParticipants(conversationId, searchTerm) {
        const sql = `
            SELECT cp.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   u.last_seen_at
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            AND u.name LIKE ?
            ORDER BY cp.is_admin DESC, u.name
        `;
        return await db.query(sql, [conversationId, `%${searchTerm}%`]);
    }

    async updateLastRead(conversationId, userId, messageId = null) {
        if (messageId) {
            // Update based on specific message
            const sql = `
                UPDATE conversation_participants 
                SET last_read_message_id = ? 
                WHERE conversation_id = ? 
                AND user_id = ?
            `;
            await db.query(sql, [messageId, conversationId, userId]);
        } else {
            // Update to current max message
            const sql = `
                UPDATE conversation_participants cp
                SET last_read_message_id = (
                    SELECT MAX(id) 
                    FROM messages 
                    WHERE conversation_id = ?
                )
                WHERE cp.conversation_id = ? 
                AND cp.user_id = ?
            `;
            await db.query(sql, [conversationId, conversationId, userId]);
        }

        return await this.getParticipant(conversationId, userId);
    }

    async getUnreadParticipants(conversationId, messageId) {
        const sql = `
            SELECT cp.*, u.name, u.avatar_url
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ?
            AND cp.left_at IS NULL
            AND cp.user_id != (
                SELECT sender_id FROM messages WHERE id = ?
            )
            AND (
                cp.last_read_message_id IS NULL 
                OR cp.last_read_message_id < ?
            )
        `;
        return await db.query(sql, [conversationId, messageId, messageId]);
    }
}

module.exports = new ConversationParticipantRepository();