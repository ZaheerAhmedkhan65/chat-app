const db = require('../../config/database');

class UserRepository {
    async create(userData) {
        const sql = `
            INSERT INTO users 
            (name, email, phone, password_hash, about, avatar_url, status_emoji, status_text, privacy_settings)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            userData.name,
            userData.email,
            userData.phone,
            userData.password_hash,
            userData.about || 'Hey! I am using eChat.',
            userData.avatar_url || 'avatars/default.png',
            userData.status_emoji,
            userData.status_text,
            userData.privacy_settings ? JSON.stringify(userData.privacy_settings) : null
        ];

        const result = await db.query(sql, params);
        return { id: result.insertId, ...userData };
    }

    async findById(id) {
        const sql = 'SELECT * FROM users WHERE id = ? AND is_active = TRUE';
        const [user] = await db.query(sql, [id]);
        return user;
    }

    async findByEmail(email) {
        const sql = 'SELECT * FROM users WHERE email = ? AND is_active = TRUE';
        const [user] = await db.query(sql, [email]);
        return user;
    }

    async findByName(name) {
        const sql = 'SELECT * FROM users WHERE name = ? AND is_active = TRUE';
        const [user] = await db.query(sql, [name]);
        return user;
    }

    async update(id, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (key === 'privacy_settings' && updateData[key]) {
                fields.push(`${key} = ?`);
                values.push(JSON.stringify(updateData[key]));
            } else if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.findById(id);
        }

        values.push(id);
        const sql = `UPDATE users SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, values);

        return await this.findById(id);
    }

    async updateOnlineStatus(id, isOnline) {
        const sql = `
            UPDATE users 
            SET is_online = ?, 
                last_seen_at = ${isOnline ? 'NULL' : 'NOW()'}
            WHERE id = ?
        `;
        await db.query(sql, [isOnline, id]);
    }

    async searchUsers(searchTerm, limit = 50, offset = 0) {
        const sql = `
            SELECT id, name, email, avatar_url, about, is_online, last_seen_at
            FROM users 
            WHERE (name LIKE ? OR email LIKE ?) 
            AND is_active = TRUE
            ORDER BY is_online DESC, name ASC
            LIMIT ? OFFSET ?
        `;
        const searchPattern = `%${searchTerm}%`;
        return await db.query(sql, [searchPattern, searchPattern, limit, offset]);
    }

    async getOnlineUsers(limit = 100) {
        const sql = `
            SELECT id, name, avatar_url, about, status_emoji, status_text
            FROM users 
            WHERE is_online = TRUE 
            AND is_active = TRUE
            ORDER BY last_seen_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [limit]);
    }

    async deactivateAccount(id) {
        const sql = 'UPDATE users SET is_active = FALSE WHERE id = ?';
        await db.query(sql, [id]);
    }

    async updatePrivacySettings(id, privacySettings) {
        const sql = 'UPDATE users SET privacy_settings = ? WHERE id = ?';
        await db.query(sql, [JSON.stringify(privacySettings), id]);

        const [user] = await db.query('SELECT privacy_settings FROM users WHERE id = ?', [id]);
        return JSON.parse(user.privacy_settings || '{}');
    }

    async existsByEmailOrPhone(email, phone) {
        const sql = 'SELECT id FROM users WHERE email = ? OR phone = ?';
        const users = await db.query(sql, [email, phone]);
        return users.length > 0;
    }
}

module.exports = new UserRepository();