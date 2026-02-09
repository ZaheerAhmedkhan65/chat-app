const db = require('../../config/db');

class GroupInvitationRepository {
    async createInvitation(invitationData) {
        const sql = `
            INSERT INTO group_invitations 
            (group_id, inviter_id, invitee_id, invitee_email, token, status, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            invitationData.group_id,
            invitationData.inviter_id,
            invitationData.invitee_id || null,
            invitationData.invitee_email || null,
            invitationData.token,
            invitationData.status || 'pending',
            invitationData.expires_at
        ];

        const result = await db.query(sql, params);
        return await this.getInvitationById(result.insertId);
    }

    async getInvitationById(invitationId) {
        const sql = `
            SELECT gi.*, 
                   g.name as group_name,
                   g.avatar_url as group_avatar,
                   ui.name as inviter_name,
                   ui.avatar_url as inviter_avatar,
                   ue.name as invitee_name,
                   ue.avatar_url as invitee_avatar
            FROM group_invitations gi
            JOIN chat_groups g ON gi.group_id = g.id
            JOIN users ui ON gi.inviter_id = ui.id
            LEFT JOIN users ue ON gi.invitee_id = ue.id
            WHERE gi.id = ?
        `;
        const [invitation] = await db.query(sql, [invitationId]);
        return invitation;
    }

    async getInvitationByToken(token) {
        const sql = `
            SELECT gi.*, 
                   g.name as group_name,
                   g.description as group_description,
                   g.avatar_url as group_avatar,
                   g.is_private,
                   ui.name as inviter_name,
                   ui.avatar_url as inviter_avatar
            FROM group_invitations gi
            JOIN chat_groups g ON gi.group_id = g.id
            JOIN users ui ON gi.inviter_id = ui.id
            WHERE gi.token = ?
            AND gi.status = 'pending'
            AND (gi.expires_at IS NULL OR gi.expires_at > NOW())
        `;
        const [invitation] = await db.query(sql, [token]);
        return invitation;
    }

    async getUserInvitations(userId, status = null) {
        let sql = `
            SELECT gi.*, 
                   g.name as group_name,
                   g.avatar_url as group_avatar,
                   g.description as group_description,
                   ui.name as inviter_name,
                   ui.avatar_url as inviter_avatar,
                   (SELECT COUNT(*) FROM group_members WHERE group_id = g.id) as member_count
            FROM group_invitations gi
            JOIN chat_groups g ON gi.group_id = g.id
            JOIN users ui ON gi.inviter_id = ui.id
            WHERE gi.invitee_id = ?
            AND (gi.expires_at IS NULL OR gi.expires_at > NOW())
        `;

        const params = [userId];

        if (status) {
            sql += ' AND gi.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY gi.created_at DESC';

        return await db.query(sql, params);
    }

    async getGroupInvitations(groupId, status = null) {
        let sql = `
            SELECT gi.*, 
                   ui.name as inviter_name,
                   ui.avatar_url as inviter_avatar,
                   ue.name as invitee_name,
                   ue.avatar_url as invitee_avatar,
                   ue.email as invitee_email
            FROM group_invitations gi
            JOIN users ui ON gi.inviter_id = ui.id
            LEFT JOIN users ue ON gi.invitee_id = ue.id
            WHERE gi.group_id = ?
        `;

        const params = [groupId];

        if (status) {
            sql += ' AND gi.status = ?';
            params.push(status);
        }

        sql += ' ORDER BY gi.created_at DESC';

        return await db.query(sql, params);
    }

    async updateInvitationStatus(invitationId, status, inviteeId = null) {
        let sql = 'UPDATE group_invitations SET status = ? WHERE id = ?';
        const params = [status, invitationId];

        if (inviteeId) {
            sql += ' AND invitee_id = ?';
            params.push(inviteeId);
        }

        await db.query(sql, params);

        const invitation = await this.getInvitationById(invitationId);

        // If accepted, add user to group
        if (status === 'accepted' && invitation && invitation.invitee_id) {
            const groupMemberRepo = require('./groupMember.repository');
            await groupMemberRepo.addMember(invitation.group_id, invitation.invitee_id, 'member');
        }

        return invitation;
    }

    async deleteInvitation(invitationId, userId = null) {
        let sql = 'DELETE FROM group_invitations WHERE id = ?';
        const params = [invitationId];

        if (userId) {
            sql += ' AND (inviter_id = ? OR invitee_id = ?)';
            params.push(userId, userId);
        }

        await db.query(sql, params);
    }

    async hasPendingInvitation(groupId, inviteeId = null, inviteeEmail = null) {
        let sql = `
            SELECT COUNT(*) as count 
            FROM group_invitations 
            WHERE group_id = ? 
            AND status = 'pending'
            AND (expires_at IS NULL OR expires_at > NOW())
        `;
        const params = [groupId];

        if (inviteeId) {
            sql += ' AND invitee_id = ?';
            params.push(inviteeId);
        } else if (inviteeEmail) {
            sql += ' AND invitee_email = ?';
            params.push(inviteeEmail);
        }

        const [result] = await db.query(sql, params);
        return result.count > 0;
    }

    async getInvitationByEmail(groupId, email) {
        const sql = `
            SELECT gi.*
            FROM group_invitations gi
            WHERE gi.group_id = ?
            AND gi.invitee_email = ?
            AND gi.status = 'pending'
            AND (gi.expires_at IS NULL OR gi.expires_at > NOW())
        `;
        const [invitation] = await db.query(sql, [groupId, email]);
        return invitation;
    }

    async updateInvitationEmail(invitationId, userId, email) {
        const sql = `
            UPDATE group_invitations 
            SET invitee_id = ?, 
                invitee_email = NULL 
            WHERE id = ? 
            AND invitee_email = ?
            AND status = 'pending'
        `;
        const result = await db.query(sql, [userId, invitationId, email]);

        if (result.affectedRows > 0) {
            return await this.getInvitationById(invitationId);
        }
        return null;
    }

    async expireInvitations(groupId = null) {
        let sql = `
            UPDATE group_invitations 
            SET status = 'expired' 
            WHERE status = 'pending'
            AND expires_at IS NOT NULL
            AND expires_at <= NOW()
        `;
        const params = [];

        if (groupId) {
            sql += ' AND group_id = ?';
            params.push(groupId);
        }

        await db.query(sql, params);
    }

    async getInvitationStats(userId) {
        const sql = `
            SELECT 
                COUNT(CASE WHEN inviter_id = ? THEN 1 END) as sent_count,
                COUNT(CASE WHEN invitee_id = ? THEN 1 END) as received_count,
                COUNT(CASE WHEN inviter_id = ? AND status = 'pending' THEN 1 END) as pending_sent,
                COUNT(CASE WHEN invitee_id = ? AND status = 'pending' THEN 1 END) as pending_received,
                COUNT(CASE WHEN inviter_id = ? AND status = 'accepted' THEN 1 END) as accepted_sent,
                COUNT(CASE WHEN invitee_id = ? AND status = 'accepted' THEN 1 END) as accepted_received
            FROM group_invitations
        `;
        const [stats] = await db.query(sql, [userId, userId, userId, userId, userId, userId]);
        return stats;
    }

    async searchInvitations(searchTerm, userId = null) {
        let sql = `
            SELECT gi.*, 
                   g.name as group_name,
                   g.avatar_url as group_avatar,
                   ui.name as inviter_name,
                   ui.avatar_url as inviter_avatar,
                   ue.name as invitee_name,
                   ue.avatar_url as invitee_avatar
            FROM group_invitations gi
            JOIN chat_groups g ON gi.group_id = g.id
            JOIN users ui ON gi.inviter_id = ui.id
            LEFT JOIN users ue ON gi.invitee_id = ue.id
            WHERE (g.name LIKE ? OR ui.name LIKE ? OR ue.name LIKE ? OR gi.invitee_email LIKE ?)
        `;

        const params = [
            `%${searchTerm}%`,
            `%${searchTerm}%`,
            `%${searchTerm}%`,
            `%${searchTerm}%`
        ];

        if (userId) {
            sql += ' AND (gi.inviter_id = ? OR gi.invitee_id = ?)';
            params.push(userId, userId);
        }

        sql += ' ORDER BY gi.created_at DESC LIMIT 50';

        return await db.query(sql, params);
    }

    async bulkCreateInvitations(groupId, inviterId, invitations) {
        if (invitations.length === 0) return [];

        const placeholders = invitations.map(() => '(?, ?, ?, ?, ?, ?, ?)').join(',');
        const values = [];
        const tokens = [];

        invitations.forEach(invite => {
            const token = require('crypto').randomBytes(32).toString('hex');
            tokens.push(token);
            values.push(
                groupId,
                inviterId,
                invite.userId || null,
                invite.email || null,
                token,
                'pending',
                invite.expires_at || new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days default
            );
        });

        const sql = `
            INSERT INTO group_invitations 
            (group_id, inviter_id, invitee_id, invitee_email, token, status, expires_at)
            VALUES ${placeholders}
        `;

        await db.query(sql, values);

        // Return created invitations with tokens
        const tokenPlaceholders = tokens.map(() => '?').join(',');
        const selectSql = `
            SELECT gi.*, 
                   g.name as group_name,
                   ui.name as inviter_name
            FROM group_invitations gi
            JOIN chat_groups g ON gi.group_id = g.id
            JOIN users ui ON gi.inviter_id = ui.id
            WHERE gi.token IN (${tokenPlaceholders})
        `;

        return await db.query(selectSql, tokens);
    }
}

module.exports = new GroupInvitationRepository();