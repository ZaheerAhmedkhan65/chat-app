const db = require('../../config/database');

class ContactRequestRepository {
    async createRequest(requesterId, recipientId, message = null) {
        // Check if request already exists
        const existing = await this.getRequest(requesterId, recipientId);
        if (existing) {
            return existing;
        }

        const sql = `
            INSERT INTO contact_requests (requester_id, recipient_id, message, status)
            VALUES (?, ?, ?, 'pending')
        `;
        await db.query(sql, [requesterId, recipientId, message]);

        return await this.getRequest(requesterId, recipientId);
    }

    async getRequest(requesterId, recipientId) {
        const sql = `
            SELECT cr.*, 
                   ur.name as requester_name,
                   ur.avatar_url as requester_avatar,
                   ue.name as recipient_name,
                   ue.avatar_url as recipient_avatar
            FROM contact_requests cr
            JOIN users ur ON cr.requester_id = ur.id
            JOIN users ue ON cr.recipient_id = ue.id
            WHERE cr.requester_id = ? AND cr.recipient_id = ?
        `;
        const [request] = await db.query(sql, [requesterId, recipientId]);
        return request;
    }

    async getRequestById(requestId) {
        const sql = `
            SELECT cr.*, 
                   ur.name as requester_name,
                   ur.avatar_url as requester_avatar,
                   ue.name as recipient_name,
                   ue.avatar_url as recipient_avatar
            FROM contact_requests cr
            JOIN users ur ON cr.requester_id = ur.id
            JOIN users ue ON cr.recipient_id = ue.id
            WHERE cr.id = ?
        `;
        const [request] = await db.query(sql, [requestId]);
        return request;
    }

    async getPendingRequests(userId) {
        const sql = `
            SELECT cr.*, 
                   ur.name as requester_name,
                   ur.avatar_url as requester_avatar,
                   ur.about as requester_about
            FROM contact_requests cr
            JOIN users ur ON cr.requester_id = ur.id
            WHERE cr.recipient_id = ? 
            AND cr.status = 'pending'
            ORDER BY cr.created_at DESC
        `;
        return await db.query(sql, [userId]);
    }

    async getSentRequests(userId) {
        const sql = `
            SELECT cr.*, 
                   ue.name as recipient_name,
                   ue.avatar_url as recipient_avatar,
                   ue.about as recipient_about
            FROM contact_requests cr
            JOIN users ue ON cr.recipient_id = ue.id
            WHERE cr.requester_id = ? 
            AND cr.status = 'pending'
            ORDER BY cr.created_at DESC
        `;
        return await db.query(sql, [userId]);
    }

    async updateRequestStatus(requestId, status, recipientId = null) {
        let sql = 'UPDATE contact_requests SET status = ? WHERE id = ?';
        let params = [status, requestId];

        if (recipientId) {
            sql += ' AND recipient_id = ?';
            params.push(recipientId);
        }

        await db.query(sql, params);

        const request = await this.getRequestById(requestId);

        // If accepted, create contact relationship both ways
        if (status === 'accepted' && request) {
            const contactRepo = require('./contact.repository');
            await contactRepo.createContact(request.requester_id, request.recipient_id);
            await contactRepo.createContact(request.recipient_id, request.requester_id);
        }

        return request;
    }

    async deleteRequest(requestId, userId = null) {
        let sql = 'DELETE FROM contact_requests WHERE id = ?';
        let params = [requestId];

        if (userId) {
            sql += ' AND (requester_id = ? OR recipient_id = ?)';
            params.push(userId, userId);
        }

        await db.query(sql, params);
    }

    async hasPendingRequest(requesterId, recipientId) {
        const sql = `
            SELECT COUNT(*) as count 
            FROM contact_requests 
            WHERE requester_id = ? 
            AND recipient_id = ? 
            AND status = 'pending'
        `;
        const [result] = await db.query(sql, [requesterId, recipientId]);
        return result.count > 0;
    }

    async getRequestCounts(userId) {
        const sql = `
            SELECT 
                COUNT(CASE WHEN recipient_id = ? AND status = 'pending' THEN 1 END) as pending_received,
                COUNT(CASE WHEN requester_id = ? AND status = 'pending' THEN 1 END) as pending_sent,
                COUNT(CASE WHEN recipient_id = ? AND status = 'accepted' THEN 1 END) as accepted_received,
                COUNT(CASE WHEN requester_id = ? AND status = 'accepted' THEN 1 END) as accepted_sent
            FROM contact_requests
        `;
        const [result] = await db.query(sql, [userId, userId, userId, userId]);
        return result;
    }

    async searchRequests(userId, searchTerm, type = 'received') {
        const isReceived = type === 'received';
        const userField = isReceived ? 'requester_id' : 'recipient_id';
        const otherField = isReceived ? 'recipient_id' : 'requester_id';
        const userTable = isReceived ? 'ur' : 'ue';
        const otherTable = isReceived ? 'ue' : 'ur';

        const sql = `
            SELECT cr.*, 
                   ${userTable}.name as other_name,
                   ${userTable}.avatar_url as other_avatar,
                   ${userTable}.about as other_about
            FROM contact_requests cr
            JOIN users ur ON cr.requester_id = ur.id
            JOIN users ue ON cr.recipient_id = ue.id
            WHERE cr.${otherField} = ?
            AND ${userTable}.name LIKE ?
            ORDER BY cr.created_at DESC
        `;

        return await db.query(sql, [userId, `%${searchTerm}%`]);
    }
}

module.exports = new ContactRequestRepository();