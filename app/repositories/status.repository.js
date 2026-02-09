const db = require('../../config/database');

class StatusRepository {
    async createStatus(statusData) {
        const sql = `
            INSERT INTO statuses 
            (user_id, type, content, media_url, background_color, text_color, font_style, expires_at)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
        `;
        const params = [
            statusData.user_id,
            statusData.type,
            statusData.content,
            statusData.media_url,
            statusData.background_color,
            statusData.text_color,
            statusData.font_style,
            statusData.expires_at
        ];

        const result = await db.query(sql, params);
        return await this.getStatusById(result.insertId);
    }

    async getStatusById(statusId) {
        const sql = `
            SELECT s.*, 
                   u.name as user_name,
                   u.avatar_url as user_avatar,
                   COUNT(DISTINCT sv.id) as view_count
            FROM statuses s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN status_views sv ON s.id = sv.status_id
            WHERE s.id = ?
            GROUP BY s.id
        `;
        const [status] = await db.query(sql, [statusId]);
        return status;
    }

    async getUserStatuses(userId, includeArchived = false) {
        let sql = `
            SELECT s.*, 
                   COUNT(DISTINCT sv.id) as view_count,
                   EXISTS(
                       SELECT 1 FROM status_views sv2 
                       WHERE sv2.status_id = s.id AND sv2.viewer_id = ?
                   ) as has_viewed
            FROM statuses s
            LEFT JOIN status_views sv ON s.id = sv.status_id
            WHERE s.user_id = ?
            AND s.expires_at > NOW()
        `;

        const params = [userId, userId];

        if (!includeArchived) {
            sql += ' AND s.is_archived = FALSE';
        }

        sql += ' GROUP BY s.id ORDER BY s.created_at DESC';

        return await db.query(sql, params);
    }

    async getContactStatuses(userId, limit = 100) {
        const sql = `
            SELECT s.*, 
                   u.name as user_name,
                   u.avatar_url as user_avatar,
                   COUNT(DISTINCT sv.id) as view_count,
                   EXISTS(
                       SELECT 1 FROM status_views sv2 
                       WHERE sv2.status_id = s.id AND sv2.viewer_id = ?
                   ) as has_viewed
            FROM statuses s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN status_views sv ON s.id = sv.status_id
            WHERE s.user_id IN (
                SELECT contact_user_id 
                FROM contacts 
                WHERE user_id = ? 
                AND is_blocked = FALSE
            )
            AND s.expires_at > NOW()
            AND s.is_archived = FALSE
            GROUP BY s.id
            ORDER BY s.created_at DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, userId, limit]);
    }

    async updateStatus(statusId, updateData) {
        const fields = [];
        const values = [];

        Object.keys(updateData).forEach(key => {
            if (updateData[key] !== undefined) {
                fields.push(`${key} = ?`);
                values.push(updateData[key]);
            }
        });

        if (fields.length === 0) {
            return await this.getStatusById(statusId);
        }

        values.push(statusId);
        const sql = `UPDATE statuses SET ${fields.join(', ')} WHERE id = ?`;
        await db.query(sql, values);

        return await this.getStatusById(statusId);
    }

    async deleteStatus(statusId) {
        const sql = 'DELETE FROM statuses WHERE id = ?';
        await db.query(sql, [statusId]);
    }

    async archiveStatus(statusId) {
        const sql = 'UPDATE statuses SET is_archived = TRUE WHERE id = ?';
        await db.query(sql, [statusId]);

        return await this.getStatusById(statusId);
    }

    async incrementViewCount(statusId) {
        const sql = 'UPDATE statuses SET view_count = view_count + 1 WHERE id = ?';
        await db.query(sql, [statusId]);
    }

    async getExpiredStatuses() {
        const sql = 'SELECT * FROM statuses WHERE expires_at <= NOW() AND is_archived = FALSE';
        return await db.query(sql);
    }

    async getStatusStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_statuses,
                COUNT(CASE WHEN expires_at > NOW() THEN 1 END) as active_statuses,
                COUNT(CASE WHEN type = 'text' THEN 1 END) as text_statuses,
                COUNT(CASE WHEN type = 'image' THEN 1 END) as image_statuses,
                COUNT(CASE WHEN type = 'video' THEN 1 END) as video_statuses,
                SUM(view_count) as total_views,
                MAX(view_count) as max_views,
                MIN(created_at) as first_status,
                MAX(created_at) as last_status
            FROM statuses
            WHERE user_id = ?
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats;
    }

    async searchStatuses(searchTerm, userId = null) {
        let sql = `
            SELECT s.*, 
                   u.name as user_name,
                   u.avatar_url as user_avatar,
                   COUNT(DISTINCT sv.id) as view_count
            FROM statuses s
            JOIN users u ON s.user_id = u.id
            LEFT JOIN status_views sv ON s.id = sv.status_id
            WHERE s.expires_at > NOW()
            AND s.is_archived = FALSE
            AND (s.content LIKE ? OR u.name LIKE ?)
        `;

        const params = [`%${searchTerm}%`, `%${searchTerm}%`];

        if (userId) {
            sql += ` AND s.user_id IN (
                SELECT contact_user_id 
                FROM contacts 
                WHERE user_id = ? 
                AND is_blocked = FALSE
                UNION
                SELECT ?
            )`;
            params.push(userId, userId);
        }

        sql += ' GROUP BY s.id ORDER BY s.created_at DESC LIMIT 50';

        return await db.query(sql, params);
    }
}

module.exports = new StatusRepository();