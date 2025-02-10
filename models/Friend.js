const db = require('../config/db');

class Friend {
  static async create(userId, friendId) {
    const [result] = await db.execute(
      'INSERT INTO friends (user_id, friend_id) VALUES (?, ?)',
      [userId, friendId]
    );
    return result.insertId;
  }

  static async isFriend(userId, friendId) {
    const [rows] = await db.execute(
      'SELECT * FROM friends WHERE user_id = ? AND friend_id = ?',
      [userId, friendId]
    );
    return rows.length > 0;
  }

  static async findByUserId(userId) {
    const [rows] = await db.execute(
      `SELECT f.*, u.username as friend_username 
       FROM friends f
       JOIN users u ON f.friend_id = u.id
       WHERE f.user_id = ?`,
      [userId]
    );
    return rows;
  }
}

module.exports = Friend;