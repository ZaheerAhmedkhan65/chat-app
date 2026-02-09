const db = require('../../config/database');

class GroupMemberRepository {
    async addMember(groupId, userId, role = 'member', nickname = null) {
        const sql = `
            INSERT INTO group_members (group_id, user_id, role, nickname_in_group)
            VALUES (?, ?, ?, ?)
            ON DUPLICATE KEY UPDATE 
                role = VALUES(role),
                nickname_in_group = COALESCE(VALUES(nickname_in_group), nickname_in_group),
                is_muted = FALSE
        `;
        await db.query(sql, [groupId, userId, role, nickname]);

        return await this.getMember(groupId, userId);
    }

    async getMember(groupId, userId) {
        const sql = `
            SELECT gm.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   u.last_seen_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.user_id = ?
        `;
        const [member] = await db.query(sql, [groupId, userId]);
        return member;
    }

    async updateMember(groupId, userId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.getMember(groupId, userId);
        }

        values.push(groupId, userId);
        const sql = `UPDATE group_members SET ${fields.join(', ')} WHERE group_id = ? AND user_id = ?`;
        await db.query(sql, values);

        return await this.getMember(groupId, userId);
    }

    async removeMember(groupId, userId) {
        const sql = 'DELETE FROM group_members WHERE group_id = ? AND user_id = ?';
        await db.query(sql, [groupId, userId]);
    }

    async isMember(groupId, userId) {
        const sql = 'SELECT COUNT(*) as count FROM group_members WHERE group_id = ? AND user_id = ?';
        const [result] = await db.query(sql, [groupId, userId]);
        return result.count > 0;
    }

    async isAdmin(groupId, userId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM group_members 
            WHERE group_id = ? AND user_id = ? AND role IN ('admin', 'moderator')
        `;
        const [result] = await db.query(sql, [groupId, userId]);
        return result.count > 0;
    }

    async toggleMute(groupId, userId) {
        const sql = `
            UPDATE group_members 
            SET is_muted = NOT is_muted 
            WHERE group_id = ? AND user_id = ?
        `;
        await db.query(sql, [groupId, userId]);

        const [member] = await db.query(
            'SELECT is_muted FROM group_members WHERE group_id = ? AND user_id = ?',
            [groupId, userId]
        );
        return member.is_muted;
    }

    async changeRole(groupId, userId, newRole) {
        const sql = 'UPDATE group_members SET role = ? WHERE group_id = ? AND user_id = ?';
        await db.query(sql, [newRole, groupId, userId]);

        return await this.getMember(groupId, userId);
    }

    async getMemberCount(groupId) {
        const sql = 'SELECT COUNT(*) as count FROM group_members WHERE group_id = ?';
        const [result] = await db.query(sql, [groupId]);
        return result.count;
    }

    async getOnlineMembers(groupId) {
        const sql = `
            SELECT gm.*, u.name, u.avatar_url, u.last_seen_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND u.is_online = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [groupId]);
    }

    async getMutedMembers(groupId) {
        const sql = `
            SELECT gm.*, u.name, u.avatar_url
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.is_muted = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [groupId]);
    }

    async getMembersByRole(groupId, role) {
        const sql = `
            SELECT gm.*, u.name, u.avatar_url, u.is_online
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.role = ?
            ORDER BY u.name
        `;
        return await db.query(sql, [groupId, role]);
    }

    async searchMembers(groupId, searchTerm) {
        const sql = `
            SELECT gm.*, u.name, u.avatar_url, u.is_online
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND u.name LIKE ?
            ORDER BY gm.role, u.name
        `;
        return await db.query(sql, [groupId, `%${searchTerm}%`]);
    }

    async transferOwnership(groupId, fromUserId, toUserId) {
        // Start transaction
        return await db.transaction(async (connection) => {
            // Demote old owner to member
            await connection.execute(
                'UPDATE group_members SET role = "member" WHERE group_id = ? AND user_id = ?',
                [groupId, fromUserId]
            );

            // Promote new owner to admin
            await connection.execute(
                'UPDATE group_members SET role = "admin" WHERE group_id = ? AND user_id = ?',
                [groupId, toUserId]
            );

            // Update group creator
            await connection.execute(
                'UPDATE chat_groups SET creator_id = ? WHERE id = ?',
                [toUserId, groupId]
            );

            return true;
        });
    }

    async bulkAddMembers(groupId, userIds, role = 'member') {
        if (userIds.length === 0) return [];

        const placeholders = userIds.map(() => '(?, ?, ?)').join(',');
        const values = [];

        userIds.forEach(userId => {
            values.push(groupId, userId, role);
        });

        const sql = `
            INSERT INTO group_members (group_id, user_id, role)
            VALUES ${placeholders}
            ON DUPLICATE KEY UPDATE role = VALUES(role)
        `;

        await db.query(sql, values);

        // Return added members
        const placeholders2 = userIds.map(() => '?').join(',');
        const sql2 = `
            SELECT gm.*, u.name, u.avatar_url
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.user_id IN (${placeholders2})
        `;

        return await db.query(sql2, [groupId, ...userIds]);
    }
}

module.exports = new GroupMemberRepository();