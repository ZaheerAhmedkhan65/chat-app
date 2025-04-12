// sockets/socketHandler.js
const db = require('../config/db');
const Users = require("../models/Users.js")
module.exports = (io) => {
  io.on("connection", (socket) => {
    console.log("A user connected with ID:", socket.id);
    // Extract userId and token from handshake query
    const { userId, token } = socket.handshake.query;
    
    // Immediately handle the connection
    const handleConnection = async () => {
      try {
        if (userId) {
          await Users.updateOnlineStatus(userId, 1);
          console.log(`User ${userId} is now online`);
          // Broadcast to all except the current user
          socket.broadcast.emit("user_online", { userId, is_online: 1 });
        }
      } catch (err) {
        console.error("Error updating online status:", err);
      }
    };
    
    // Handle initial connection
    handleConnection();
    
    // Handle manual disconnection event
    socket.on("user_disconnect", async () => {
      await handleDisconnection(userId);
    });
    
    // Handle socket disconnect
    socket.on("disconnect", async () => {
      await handleDisconnection(userId);
    });
    
    // Common disconnection handler
    const handleDisconnection = async (userId) => {
      try {
        if (userId) {
          await Users.updateOnlineStatus(userId, 0);
          console.log(`User ${userId} is now offline`);
          // Broadcast to all except the current user (who's already disconnected)
          io.emit("user_offline", { userId, is_online: 0 });
        }
      } catch (err) {
        console.error("Error updating offline status:", err);
      }
    };



    
    // Handle sending messages
    socket.on("send_message", async (data) => {

      try {
        // Insert the message into the database
        const [results] = await db.query(
          "INSERT INTO messages (sender_id, receiver_id, message, image_url) VALUES (?, ?, ?, ?)",
          [data.senderId, data.receiverId, data.message, data.imageUrl]
        );

        // Retrieve the ID of the newly inserted message
        const messageId = results.insertId;

        // Add the ID and timestamp to the data object
        const messageData = {
          ...data,
          id: messageId
        };
        console.log("message : ", messageData);
        console.log("image : ", messageData.imageUrl);
        // Emit the message with the ID and timestamp
        io.emit("receive_message", messageData);
      } catch (err) {
        console.error("Database query error:", err);
      }
    });

    socket.on("update_message", async (data) => {

      try {
        // Update the message in the database
        const [results] = await db.query(
          "UPDATE messages SET message = ? WHERE id = ?",
          [data.newMessage, data.messageId]
        );

        console.log("Updated message:", data);

        // Broadcast the updated message to all clients
        io.emit("message_updated", {
          messageId: data.messageId,
          newMessage: data.newMessage,
          imageUrl: data.imageUrl,
          senderId: data.senderId,
          receiverId: data.receiverId,
        });
      } catch (err) {
        console.error("Database query error:", err);
      }
    });

    socket.on("delete_message", async (data) => {
      try {
        // Flag the message as deleted in the database
        await db.execute('UPDATE messages SET is_deleted = TRUE WHERE id = ?', [data.messageId]);

        // Broadcast the deleted message ID to all clients
        io.emit("message_deleted", {
          messageId: data.messageId,
          receiverId: data.receiverId
        });
      } catch (err) {
        console.error("Database query error:", err);
      }
    });

    socket.on("typing", (data) => {
      socket.broadcast.emit("typing", data);
    });

    socket.on("stop typing", () => {
      socket.broadcast.emit("stop typing");
    });

  });
}