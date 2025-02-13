// sockets/socketHandler.js
const db = require('../config/db');

module.exports = (io) => {

    io.on("connection", (socket) => {
        console.log("A user connected: ", socket.id);
      
        // Handle sending messages
        socket.on("send_message", (data) => {
          db.query("INSERT INTO messages (sender_id, receiver_id, message) VALUES (?, ?, ?)", [data.senderId, data.receiverId, data.message], (err, results) => {
            if (err) {
              console.error(err);
              return;
            }
            console.log(results);
          });
          io.emit("receive_message", data);
        });
      
        socket.on("typing", (data) => {
          socket.broadcast.emit("typing", data);
        });
      
        socket.on("stop typing", () => {
          socket.broadcast.emit("stop typing");
        });
      
      });
}