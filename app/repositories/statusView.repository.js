const db = require('../../config/db');

class StatusViewRepository {
    async addView(statusId, viewerId) {
        const sql = `
            INSERT IGNORE INTO status_views (status_id, viewer_id, viewed_at)
            VALUES (?, ?, NOW())
        `;
        await db.query(sql, [statusId, viewerId]);

        // Update status view count
        await db.query('UPDATE statuses SET view_count = view_count + 1 WHERE id = ?', [statusId]);

        return await this.getView(statusId, viewerId);
    }

    async getView(statusId, viewerId) {
        const sql = `
            SELECT sv.*, 
                   u.name as viewer_name,
                   u.avatar_url as viewer_avatar
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.status_id = ? AND sv.viewer_id = ?
        `;
        const [view] = await db.query(sql, [statusId, viewerId]);
        return view;
    }

    async getStatusViews(statusId) {
        const sql = `
            SELECT sv.*, 
                   u.name, 
                   u.avatar_url, 
                   u.is_online,
                   sv.viewed_at
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.status_id = ?
            ORDER BY sv.viewed_at DESC
        `;
        return await db.query(sql, [statusId]);
    }

    async getStatusViewCount(statusId) {
        const sql = 'SELECT COUNT(*) as count FROM status_views WHERE status_id = ?';
        const [result] = await db.query(sql, [statusId]);
        return result.count;
    }

    async hasViewed(statusId, viewerId) {
        const sql = 'SELECT COUNT(*) as count FROM status_views WHERE status_id = ? AND viewer_id = ?';
        const [result] = await db.query(sql, [statusId, viewerId]);
        return result.count > 0;
    }

    async getUserViewedStatuses(userId, filters = {}) {
        let sql = `
            SELECT sv.*, 
                   s.content as status_content,
                   s.type as status_type,
                   s.media_url,
                   s.expires_at,
                   u.name as status_owner_name,
                   u.avatar_url as status_owner_avatar
            FROM status_views sv
            JOIN statuses s ON sv.status_id = s.id
            JOIN users u ON s.user_id = u.id
            WHERE sv.viewer_id = ?
            AND s.expires_at > NOW()
        `;

        const params = [userId];

        if (filters.statusType) {
            sql += ' AND s.type = ?';
            params.push(filters.statusType);
        }

        if (filters.startDate) {
            sql += ' AND sv.viewed_at >= ?';
            params.push(filters.startDate);
        }

        if (filters.endDate) {
            sql += ' AND sv.viewed_at <= ?';
            params.push(filters.endDate);
        }

        sql += ' ORDER BY sv.viewed_at DESC';

        if (filters.limit) {
            sql += ' LIMIT ?';
            params.push(filters.limit);
        }

        return await db.query(sql, params);
    }

    async getStatusViewsByUser(statusOwnerId, viewerId = null) {
        let sql = `
            SELECT sv.*, 
                   s.content as status_content,
                   s.type as status_type,
                   u.name as viewer_name,
                   u.avatar_url as viewer_avatar
            FROM status_views sv
            JOIN statuses s ON sv.status_id = s.id
            JOIN users u ON sv.viewer_id = u.id
            WHERE s.user_id = ?
            AND s.expires_at > NOW()
        `;

        const params = [statusOwnerId];

        if (viewerId) {
            sql += ' AND sv.viewer_id = ?';
            params.push(viewerId);
        }

        sql += ' ORDER BY sv.viewed_at DESC';

        return await db.query(sql, params);
    }

    async getRecentViewers(statusOwnerId, hours = 24) {
        const sql = `
            SELECT DISTINCT sv.viewer_id, 
                   u.name, 
                   u.avatar_url,
                   MAX(sv.viewed_at) as last_viewed
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.id
            JOIN statuses s ON sv.status_id = s.id
            WHERE s.user_id = ?
            AND sv.viewed_at >= DATE_SUB(NOW(), INTERVAL ? HOUR)
            GROUP BY sv.viewer_id
            ORDER BY last_viewed DESC
        `;
        return await db.query(sql, [statusOwnerId, hours]);
    }

    async getViewStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_views_given,
                COUNT(DISTINCT sv.status_id) as unique_statuses_viewed,
                COUNT(DISTINCT s.user_id) as unique_users_viewed,
                MIN(sv.viewed_at) as first_view,
                MAX(sv.viewed_at) as last_view
            FROM status_views sv
            JOIN statuses s ON sv.status_id = s.id
            WHERE sv.viewer_id = ?
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats;
    }

    async getViewsReceivedStats(userId) {
        const sql = `
            SELECT 
                COUNT(*) as total_views_received,
                COUNT(DISTINCT sv.viewer_id) as unique_viewers,
                COUNT(DISTINCT sv.status_id) as unique_statuses,
                MIN(sv.viewed_at) as first_view_received,
                MAX(sv.viewed_at) as last_view_received
            FROM status_views sv
            JOIN statuses s ON sv.status_id = s.id
            WHERE s.user_id = ?
        `;
        const [stats] = await db.query(sql, [userId]);
        return stats;
    }

    async bulkAddViews(statusIds, viewerId) {
        if (statusIds.length === 0) return [];

        // Filter out already viewed statuses
        const placeholders = statusIds.map(() => '?').join(',');
        const alreadyViewedSql = `
            SELECT status_id 
            FROM status_views 
            WHERE viewer_id = ? 
            AND status_id IN (${placeholders})
        `;
        const alreadyViewed = await db.query(alreadyViewedSql, [viewerId, ...statusIds]);
        const alreadyViewedIds = alreadyViewed.map(row => row.status_id);

        const newStatusIds = statusIds.filter(id => !alreadyViewedIds.includes(id));

        if (newStatusIds.length === 0) return [];

        // Insert new views
        const insertPlaceholders = newStatusIds.map(() => '(?, ?, NOW())').join(',');
        const insertValues = [];

        newStatusIds.forEach(statusId => {
            insertValues.push(statusId, viewerId);
        });

        const insertSql = `
            INSERT INTO status_views (status_id, viewer_id, viewed_at)
            VALUES ${insertPlaceholders}
        `;

        await db.query(insertSql, insertValues);

        // Update status view counts
        const updatePlaceholders = newStatusIds.map(() => '?').join(',');
        const updateSql = `
            UPDATE statuses 
            SET view_count = view_count + 1 
            WHERE id IN (${updatePlaceholders})
        `;
        await db.query(updateSql, newStatusIds);

        return newStatusIds;
    }

    async getMutualViewers(statusOwnerId, viewerId) {
        const sql = `
            SELECT DISTINCT sv.viewer_id, 
                   u.name, 
                   u.avatar_url
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.id
            JOIN statuses s ON sv.status_id = s.id
            WHERE s.user_id = ?
            AND sv.viewer_id IN (
                SELECT contact_user_id 
                FROM contacts 
                WHERE user_id = ?
                AND is_blocked = FALSE
            )
            ORDER BY u.name
        `;
        return await db.query(sql, [statusOwnerId, viewerId]);
    }

    async getPopularStatuses(userId, limit = 10) {
        const sql = `
            SELECT s.*, 
                   u.name as user_name,
                   u.avatar_url as user_avatar,
                   COUNT(DISTINCT sv.viewer_id) as view_count
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
            ORDER BY view_count DESC
            LIMIT ?
        `;
        return await db.query(sql, [userId, limit]);
    }

    async getViewHistory(statusId, days = 7) {
        const sql = `
            SELECT 
                DATE(sv.viewed_at) as view_date,
                COUNT(*) as view_count,
                GROUP_CONCAT(DISTINCT u.name ORDER BY u.name SEPARATOR ', ') as viewers
            FROM status_views sv
            JOIN users u ON sv.viewer_id = u.id
            WHERE sv.status_id = ?
            AND sv.viewed_at >= DATE_SUB(NOW(), INTERVAL ? DAY)
            GROUP BY DATE(sv.viewed_at)
            ORDER BY view_date DESC
        `;
        return await db.query(sql, [statusId, days]);
    }

    async removeView(statusId, viewerId) {
        const sql = 'DELETE FROM status_views WHERE status_id = ? AND viewer_id = ?';
        await db.query(sql, [statusId, viewerId]);

        // Update status view count
        await db.query('UPDATE statuses SET view_count = GREATEST(0, view_count - 1) WHERE id = ?', [statusId]);
    }
}

module.exports = new StatusViewRepository();