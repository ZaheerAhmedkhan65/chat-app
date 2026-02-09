const db = require("../config/db");

module.exports = (io, socket) => {

    socket.on("send_message", async (data) => {
        try {
            const [result] = await db.query(
                "INSERT INTO messages (sender_id, receiver_id, message, image_url) VALUES (?, ?, ?, ?)",
                [data.senderId, data.receiverId, data.message, data.imageUrl]
            );

            io.emit("receive_message", {
                ...data,
                id: result.insertId
            });
        } catch (err) {
            console.error("send_message error:", err);
        }
    });

    socket.on("update_message", async (data) => {
        try {
            await db.query(
                "UPDATE messages SET message = ? WHERE id = ?",
                [data.newMessage, data.messageId]
            );

            io.emit("message_updated", data);
        } catch (err) {
            console.error("update_message error:", err);
        }
    });

    socket.on("delete_message", async (data) => {
        try {
            await db.query(
                "UPDATE messages SET is_deleted = TRUE WHERE id = ?",
                [data.messageId]
            );

            io.emit("message_deleted", data);
        } catch (err) {
            console.error("delete_message error:", err);
        }
    });

};