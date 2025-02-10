const db = require('../config/db');

class Message {
  static async create(senderId, receiverId, message) {
    const [result] = await db.execute(
      'INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)',
      [senderId, receiverId, message]
    );
    return result.insertId;
  }

  static async findByUsers(senderId, receiverId) {
    const [rows] = await db.execute(
      `SELECT m.*, u.username as receiver_username 
       FROM messages m
       JOIN users u ON m.receiver_id = u.id
       WHERE (m.sender_id = ? AND m.receiver_id = ?) 
       OR (m.sender_id = ? AND m.receiver_id = ?) 
       ORDER BY m.created_at`,
      [senderId, receiverId, receiverId, senderId]
    );
    return rows;
  }
  
  static async update(messageId, newMessage) {
    await db.execute('UPDATE messages SET message = ? WHERE id = ?', [newMessage, messageId]);
  }

  static async delete(messageId) {
    await db.execute('UPDATE messages SET is_deleted = TRUE WHERE id = ?', [messageId]);
  }
  static async findById(id) {
    const [rows] = await db.execute('SELECT * FROM messages WHERE id = ?', [id]);
    return rows[0];
  };

}
  
module.exports = Message;