const db = require('../../config/database');

class ContactRepository {
    async createContact(userId, contactUserId, nickname = null) {
        const sql = `
            INSERT INTO contacts (user_id, contact_user_id, nickname)
            VALUES (?, ?, ?)
            ON DUPLICATE KEY UPDATE nickname = COALESCE(?, nickname)
        `;
        await db.query(sql, [userId, contactUserId, nickname, nickname]);

        return await this.getContact(userId, contactUserId);
    }

    async getContact(userId, contactUserId) {
        const sql = `
            SELECT c.*, 
                   u.name as contact_name,
                   u.avatar_url as contact_avatar,
                   u.about as contact_about,
                   u.is_online as contact_is_online
            FROM contacts c
            JOIN users u ON c.contact_user_id = u.id
            WHERE c.user_id = ? AND c.contact_user_id = ?
        `;
        const [contact] = await db.query(sql, [userId, contactUserId]);
        return contact;
    }

    async getUserContacts(userId, filters = {}) {
        let sql = `
            SELECT c.*, 
                   u.name as contact_name,
                   u.email as contact_email,
                   u.avatar_url as contact_avatar,
                   u.about as contact_about,
                   u.status_emoji as contact_status_emoji,
                   u.status_text as contact_status_text,
                   u.is_online as contact_is_online,
                   u.last_seen_at as contact_last_seen
            FROM contacts c
            JOIN users u ON c.contact_user_id = u.id
            WHERE c.user_id = ? AND u.is_active = TRUE
        `;
        const params = [userId];

        if (filters.is_favorite !== undefined) {
            sql += ' AND c.is_favorite = ?';
            params.push(filters.is_favorite);
        }

        if (filters.is_blocked !== undefined) {
            sql += ' AND c.is_blocked = ?';
            params.push(filters.is_blocked);
        }

        if (filters.search) {
            sql += ' AND u.name LIKE ?';
            params.push(`%${filters.search}%`);
        }

        sql += ' ORDER BY u.is_online DESC, u.name ASC';

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

    async updateContact(userId, contactUserId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.getContact(userId, contactUserId);
        }

        values.push(userId, contactUserId);
        const sql = `UPDATE contacts SET ${fields.join(', ')} WHERE user_id = ? AND contact_user_id = ?`;
        await db.query(sql, values);

        return await this.getContact(userId, contactUserId);
    }

    async deleteContact(userId, contactUserId) {
        const sql = 'DELETE FROM contacts WHERE user_id = ? AND contact_user_id = ?';
        await db.query(sql, [userId, contactUserId]);
    }

    async toggleFavorite(userId, contactUserId) {
        const sql = `
            UPDATE contacts 
            SET is_favorite = NOT is_favorite 
            WHERE user_id = ? AND contact_user_id = ?
        `;
        await db.query(sql, [userId, contactUserId]);

        const [contact] = await db.query(
            'SELECT is_favorite FROM contacts WHERE user_id = ? AND contact_user_id = ?',
            [userId, contactUserId]
        );
        return contact.is_favorite;
    }

    async toggleBlock(userId, contactUserId) {
        const sql = `
            UPDATE contacts 
            SET is_blocked = NOT is_blocked 
            WHERE user_id = ? AND contact_user_id = ?
        `;
        await db.query(sql, [userId, contactUserId]);

        const [contact] = await db.query(
            'SELECT is_blocked FROM contacts WHERE user_id = ? AND contact_user_id = ?',
            [userId, contactUserId]
        );
        return contact.is_blocked;
    }

    async getBlockedContacts(userId) {
        const sql = `
            SELECT c.*, u.name, u.avatar_url
            FROM contacts c
            JOIN users u ON c.contact_user_id = u.id
            WHERE c.user_id = ? AND c.is_blocked = TRUE
            ORDER BY u.name
        `;
        return await db.query(sql, [userId]);
    }

    async getFavoriteContacts(userId) {
        const sql = `
            SELECT c.*, u.name, u.avatar_url, u.is_online, u.last_seen_at
            FROM contacts c
            JOIN users u ON c.contact_user_id = u.id
            WHERE c.user_id = ? AND c.is_favorite = TRUE AND u.is_active = TRUE
            ORDER BY u.is_online DESC, u.name
        `;
        return await db.query(sql, [userId]);
    }

    async isContact(userId, contactUserId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM contacts 
            WHERE user_id = ? AND contact_user_id = ? AND is_blocked = FALSE
        `;
        const [result] = await db.query(sql, [userId, contactUserId]);
        return result.count > 0;
    }

    async isBlocked(userId, contactUserId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM contacts 
            WHERE user_id = ? AND contact_user_id = ? AND is_blocked = TRUE
        `;
        const [result] = await db.query(sql, [userId, contactUserId]);
        return result.count > 0;
    }

    async getMutualContacts(userId, otherUserId) {
        const sql = `
            SELECT u.id, u.name, u.avatar_url, u.is_online
            FROM contacts c1
            JOIN contacts c2 ON c1.contact_user_id = c2.contact_user_id
            JOIN users u ON c1.contact_user_id = u.id
            WHERE c1.user_id = ? 
            AND c2.user_id = ?
            AND c1.is_blocked = FALSE
            AND c2.is_blocked = FALSE
            AND u.is_active = TRUE
            ORDER BY u.is_online DESC, u.name
        `;
        return await db.query(sql, [userId, otherUserId]);
    }
}

module.exports = new ContactRepository();