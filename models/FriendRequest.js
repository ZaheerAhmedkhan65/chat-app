const db = require('../config/db');

class FriendRequest {
    static async create(senderId, receiverId) {
        console.log('Inserting into DB:', senderId, receiverId);

        try {
            const [result] = await db.execute(
                'INSERT INTO friend_requests (sender_id, receiver_id, status) VALUES (?, ?, ?)',
                [senderId, receiverId, 'pending']
            );

            console.log('Database Insert Result:', result);
            return result.insertId;
        } catch (error) {
            console.error('Database Insert Error:', error);
            throw error;
        }
    }



    static async findByReceiverId(receiverId) {
        const [rows] = await db.execute(
            `SELECT fr.*, u.username as sender_username 
       FROM friend_requests fr
       JOIN users u ON fr.sender_id = u.id
       WHERE fr.receiver_id = ? AND fr.status = 'pending'`,
            [receiverId]
        );
        return rows;
    }

    static async acceptRequest(requestId) {
        try {
            console.log('Updating friend request status for ID:', requestId);

            const [result] = await db.execute(
                'UPDATE friend_requests SET status = ? WHERE id = ?',
                ['accepted', requestId]
            );

            console.log('Update result:', result);
            return result;
        } catch (error) {
            console.error('Database error in acceptRequest:', error);
            throw error;
        }
    }

    static async findById(requestId) {
        try {
            console.log('Fetching friend request details for ID:', requestId);

            const [rows] = await db.execute(
                'SELECT * FROM friend_requests WHERE id = ?',
                [requestId]
            );

            if (rows.length === 0) return null;
            return rows[0];
        } catch (error) {
            console.error('Database error in findById:', error);
            throw error;
        }
    }

    static async rejectRequest(requestId) {
        await db.execute(
            'UPDATE friend_requests SET status = "rejected" WHERE id = ?',
            [requestId]
        );
    }

    static async getFriends(userId) {
        const query = `
          SELECT u.id, u.username
          FROM users u
          JOIN friend_requests f ON (f.sender_id = u.id OR f.receiver_id = u.id)
          WHERE (f.sender_id = ? OR f.receiver_id = ?) AND f.status = 'accepted' AND u.id != ?;
        `;
        
        const [rows] = await db.execute(query, [userId, userId, userId]);
        return rows;
    }
}

module.exports = FriendRequest;