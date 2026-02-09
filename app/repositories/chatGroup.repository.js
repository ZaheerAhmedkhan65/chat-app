const db = require('../../config/database');

class ChatGroupRepository {
    async createGroup(groupData) {
        const sql = `
            INSERT INTO chat_groups 
            (name, description, avatar_url, creator_id, is_private, invite_link, max_members)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            groupData.name,
            groupData.description,
            groupData.avatar_url,
            groupData.creator_id,
            groupData.is_private || false,
            groupData.invite_link,
            groupData.max_members || 1000
        ];

        const result = await db.query(sql, params);
        const groupId = result.insertId;

        // Add creator as admin member
        const memberRepo = require('./groupMember.repository');
        await memberRepo.addMember(groupId, groupData.creator_id, 'admin');

        return await this.getGroupById(groupId);
    }

    async getGroupById(groupId) {
        const sql = `
            SELECT g.*, 
                   u.name as creator_name,
                   u.avatar_url as creator_avatar,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM chat_groups g
            JOIN users u ON g.creator_id = u.id
            WHERE g.id = ?
        `;
        const [group] = await db.query(sql, [groupId]);
        return group;
    }

    async updateGroup(groupId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.getGroupById(groupId);
        }

        values.push(groupId);
        const sql = `UPDATE chat_groups SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, values);

        return await this.getGroupById(groupId);
    }

    async deleteGroup(groupId) {
        const sql = 'DELETE FROM chat_groups WHERE id = ?';
        await db.query(sql, [groupId]);
    }

    async getUserGroups(userId, filters = {}) {
        let sql = `
            SELECT g.*, 
                   gm.role,
                   gm.joined_at,
                   gm.nickname_in_group,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                   u.name as creator_name
            FROM chat_groups g
            JOIN group_members gm ON g.id = gm.group_id
            JOIN users u ON g.creator_id = u.id
            WHERE gm.user_id = ?
        `;
        const params = [userId];

        if (filters.is_private !== undefined) {
            sql += ' AND g.is_private = ?';
            params.push(filters.is_private);
        }

        if (filters.search) {
            sql += ' AND g.name LIKE ?';
            params.push(`%${filters.search}%`);
        }

        sql += ' ORDER BY g.updated_at DESC';

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

    async searchGroups(searchTerm, userId = null, limit = 50) {
        let sql = `
            SELECT g.*, 
                   u.name as creator_name,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count,
                   g.is_private
            FROM chat_groups g
            JOIN users u ON g.creator_id = u.id
            WHERE g.name LIKE ? 
            AND g.is_private = FALSE
        `;
        const params = [`%${searchTerm}%`];

        if (userId) {
            sql += ` AND g.id NOT IN (
                SELECT group_id FROM group_members WHERE user_id = ?
            )`;
            params.push(userId);
        }

        sql += ' ORDER BY member_count DESC LIMIT ?';
        params.push(limit);

        return await db.query(sql, params);
    }

    async getGroupMembers(groupId) {
        const sql = `
            SELECT gm.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   u.last_seen_at
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
            ORDER BY 
                CASE gm.role 
                    WHEN 'admin' THEN 1
                    WHEN 'moderator' THEN 2
                    WHEN 'member' THEN 3
                END,
                u.name
        `;
        return await db.query(sql, [groupId]);
    }

    async getGroupAdmins(groupId) {
        const sql = `
            SELECT gm.*, u.name, u.avatar_url, u.is_online
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ? AND gm.role IN ('admin', 'moderator')
            ORDER BY gm.role, u.name
        `;
        return await db.query(sql, [groupId]);
    }

    async updateGroupAvatar(groupId, avatarUrl) {
        const sql = 'UPDATE chat_groups SET avatar_url = ? WHERE id = ?';
        await db.query(sql, [avatarUrl, groupId]);
        return await this.getGroupById(groupId);
    }

    async updateGroupInviteLink(groupId, inviteLink) {
        const sql = 'UPDATE chat_groups SET invite_link = ? WHERE id = ?';
        await db.query(sql, [inviteLink, groupId]);
        return await this.getGroupById(groupId);
    }

    async getGroupByInviteLink(inviteLink) {
        const sql = 'SELECT * FROM chat_groups WHERE invite_link = ?';
        const [group] = await db.query(sql, [inviteLink]);
        return group;
    }

    async isGroupFull(groupId) {
        const sql = `
            SELECT 
                g.max_members,
                COUNT(gm.id) as current_members
            FROM chat_groups g
            LEFT JOIN group_members gm ON g.id = gm.group_id
            WHERE g.id = ?
            GROUP BY g.id
        `;
        const [result] = await db.query(sql, [groupId]);

        if (!result) return true;
        return result.current_members >= result.max_members;
    }

    async getGroupStats(groupId) {
        const sql = `
            SELECT 
                COUNT(DISTINCT gm.user_id) as total_members,
                COUNT(DISTINCT CASE WHEN u.is_online = TRUE THEN u.id END) as online_members,
                COUNT(DISTINCT CASE WHEN gm.role = 'admin' THEN gm.user_id END) as admin_count,
                COUNT(DISTINCT CASE WHEN gm.role = 'moderator' THEN gm.user_id END) as moderator_count,
                MIN(gm.joined_at) as first_member_joined,
                MAX(gm.joined_at) as last_member_joined
            FROM group_members gm
            JOIN users u ON gm.user_id = u.id
            WHERE gm.group_id = ?
        `;
        const [stats] = await db.query(sql, [groupId]);
        return stats;
    }
}

module.exports = new ChatGroupRepository();