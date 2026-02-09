const db = require('../../config/database');

class ConversationRepository {
    async createConversation(type, userIds = [], groupId = null) {
        // Start transaction
        return await db.transaction(async (connection) => {
            // Create conversation
            const [result] = await connection.execute(
                'INSERT INTO conversations (type) VALUES (?)',
                [type]
            );
            const conversationId = result.insertId;

            // Add participants
            if (userIds.length > 0) {
                const placeholders = userIds.map(() => '(?, ?)').join(',');
                const values = [];

                userIds.forEach(userId => {
                    values.push(conversationId, userId);
                });

                await connection.execute(
                    `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders}`,
                    values
                );
            }

            // For group conversations, get all group members
            if (type === 'group' && groupId) {
                const [members] = await connection.execute(
                    'SELECT user_id FROM group_members WHERE group_id = ?',
                    [groupId]
                );

                if (members.length > 0) {
                    const placeholders = members.map(() => '(?, ?)').join(',');
                    const values = [];

                    members.forEach(member => {
                        values.push(conversationId, member.user_id);
                    });

                    await connection.execute(
                        `INSERT INTO conversation_participants (conversation_id, user_id) VALUES ${placeholders}`,
                        values
                    );
                }
            }

            return await this.getConversationById(conversationId);
        });
    }

    async getConversationById(conversationId) {
        const sql = `
            SELECT c.*, 
                   m.content as last_message_content,
                   m.message_type as last_message_type,
                   m.created_at as last_message_at,
                   u.name as last_message_sender_name
            FROM conversations c
            LEFT JOIN messages m ON c.last_message_id = m.id
            LEFT JOIN users u ON m.sender_id = u.id
            WHERE c.id = ?
        `;
        const [conversation] = await db.query(sql, [conversationId]);
        return conversation;
    }

    async getDirectConversation(userId1, userId2) {
        const sql = `
            SELECT c.* 
            FROM conversations c
            INNER JOIN conversation_participants cp1 ON c.id = cp1.conversation_id
            INNER JOIN conversation_participants cp2 ON c.id = cp2.conversation_id
            WHERE c.type = 'direct'
            AND cp1.user_id = ?
            AND cp2.user_id = ?
            AND cp1.left_at IS NULL
            AND cp2.left_at IS NULL
            LIMIT 1
        `;
        const [conversation] = await db.query(sql, [userId1, userId2]);
        return conversation;
    }

    async getGroupConversation(groupId) {
        const sql = `
            SELECT c.* 
            FROM conversations c
            WHERE c.type = 'group'
            AND EXISTS (
                SELECT 1 FROM conversation_participants cp
                JOIN group_members gm ON cp.user_id = gm.user_id
                WHERE cp.conversation_id = c.id
                AND gm.group_id = ?
                LIMIT 1
            )
            LIMIT 1
        `;
        const [conversation] = await db.query(sql, [groupId]);
        return conversation;
    }

    async getUserConversations(userId, filters = {}) {
        let sql = `
            SELECT 
                c.*,
                cp.joined_at as user_joined_at,
                cp.is_muted as user_muted,
                m.content as last_message_content,
                m.message_type as last_message_type,
                m.created_at as last_message_at,
                m.sender_id as last_message_sender_id,
                u.name as last_message_sender_name,
                u.avatar_url as last_message_sender_avatar,
                COUNT(DISTINCT m2.id) as unread_count,
                CASE 
                    WHEN c.type = 'direct' THEN (
                        SELECT u2.name 
                        FROM conversation_participants cp2
                        JOIN users u2 ON cp2.user_id = u2.id
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
                END as conversation_name,
                CASE 
                    WHEN c.type = 'direct' THEN (
                        SELECT u2.avatar_url 
                        FROM conversation_participants cp2
                        JOIN users u2 ON cp2.user_id = u2.id
                        WHERE cp2.conversation_id = c.id 
                        AND cp2.user_id != ?
                        LIMIT 1
                    )
                    WHEN c.type = 'group' THEN (
                        SELECT g.avatar_url 
                        FROM conversation_participants cp2
                        JOIN group_members gm ON cp2.user_id = gm.user_id
                        JOIN chat_groups g ON gm.group_id = g.id
                        WHERE cp2.conversation_id = c.id
                        LIMIT 1
                    )
                END as conversation_avatar
            FROM conversations c
            INNER JOIN conversation_participants cp ON c.id = cp.conversation_id
            LEFT JOIN messages m ON c.last_message_id = m.id
            LEFT JOIN users u ON m.sender_id = u.id
            LEFT JOIN messages m2 ON c.id = m2.conversation_id 
                AND m2.created_at > cp.joined_at 
                AND m2.sender_id != ?
                AND NOT EXISTS (
                    SELECT 1 FROM message_views mv 
                    WHERE mv.message_id = m2.id AND mv.user_id = ?
                )
            WHERE cp.user_id = ? 
            AND cp.left_at IS NULL
        `;

        const params = [userId, userId, userId, userId, userId];

        if (filters.type) {
            sql += ' AND c.type = ?';
            params.push(filters.type);
        }

        if (filters.search) {
            sql += ` AND (
                c.type = 'direct' AND EXISTS (
                    SELECT 1 FROM conversation_participants cp2
                    JOIN users u2 ON cp2.user_id = u2.id
                    WHERE cp2.conversation_id = c.id 
                    AND cp2.user_id != ?
                    AND u2.name LIKE ?
                )
                OR
                c.type = 'group' AND EXISTS (
                    SELECT 1 FROM conversation_participants cp2
                    JOIN group_members gm ON cp2.user_id = gm.user_id
                    JOIN chat_groups g ON gm.group_id = g.id
                    WHERE cp2.conversation_id = c.id
                    AND g.name LIKE ?
                )
            )`;
            params.push(userId, `%${filters.search}%`, `%${filters.search}%`);
        }

        sql += `
            GROUP BY c.id
            ORDER BY 
                CASE WHEN c.last_message_id IS NULL THEN 1 ELSE 0 END,
                c.updated_at DESC
        `;

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

    async updateLastMessage(conversationId, messageId) {
        const sql = 'UPDATE conversations SET last_message_id = ?, updated_at = NOW() WHERE id = ?';
        await db.query(sql, [messageId, conversationId]);
    }

    async markAsRead(conversationId, userId) {
        const sql = `
            INSERT INTO message_views (message_id, user_id, viewed_at)
            SELECT m.id, ?, NOW()
            FROM messages m
            WHERE m.conversation_id = ?
            AND m.sender_id != ?
            AND NOT EXISTS (
                SELECT 1 FROM message_views mv 
                WHERE mv.message_id = m.id AND mv.user_id = ?
            )
        `;
        await db.query(sql, [userId, conversationId, userId, userId]);
    }

    async getUnreadCount(conversationId, userId) {
        const sql = `
            SELECT COUNT(*) as count
            FROM messages m
            WHERE m.conversation_id = ?
            AND m.sender_id != ?
            AND NOT EXISTS (
                SELECT 1 FROM message_views mv 
                WHERE mv.message_id = m.id AND mv.user_id = ?
            )
        `;
        const [result] = await db.query(sql, [conversationId, userId, userId]);
        return result.count;
    }

    async getConversationParticipants(conversationId) {
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

    async removeParticipant(conversationId, userId) {
        const sql = 'UPDATE conversation_participants SET left_at = NOW() WHERE conversation_id = ? AND user_id = ?';
        await db.query(sql, [conversationId, userId]);
    }

    async getParticipant(conversationId, userId) {
        const sql = `
            SELECT cp.*, u.name, u.avatar_url
            FROM conversation_participants cp
            JOIN users u ON cp.user_id = u.id
            WHERE cp.conversation_id = ? AND cp.user_id = ?
        `;
        const [participant] = await db.query(sql, [conversationId, userId]);
        return participant;
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

    async getConversationStats(conversationId) {
        const sql = `
            SELECT 
                c.type,
                COUNT(DISTINCT cp.user_id) as participant_count,
                COUNT(DISTINCT CASE WHEN u.is_online = TRUE THEN u.id END) as online_count,
                MIN(m.created_at) as first_message_at,
                MAX(m.created_at) as last_message_at,
                COUNT(DISTINCT m.id) as total_messages
            FROM conversations c
            LEFT JOIN conversation_participants cp ON c.id = cp.conversation_id AND cp.left_at IS NULL
            LEFT JOIN users u ON cp.user_id = u.id
            LEFT JOIN messages m ON c.id = m.conversation_id
            WHERE c.id = ?
            GROUP BY c.id
        `;
        const [stats] = await db.query(sql, [conversationId]);
        return stats;
    }

    async searchInConversation(conversationId, searchTerm, userId = null) {
        let sql = `
            SELECT m.*, 
                   u.name as sender_name,
                   u.avatar_url as sender_avatar
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.conversation_id = ?
            AND m.is_deleted = FALSE
            AND (m.content LIKE ? OR u.name LIKE ?)
        `;
        const params = [conversationId, `%${searchTerm}%`, `%${searchTerm}%`];

        if (userId) {
            sql += ' AND (m.deleted_by IS NULL OR m.deleted_by = ?)';
            params.push(userId);
        }

        sql += ' ORDER BY m.created_at DESC LIMIT 100';

        return await db.query(sql, params);
    }
}

module.exports = new ConversationRepository();