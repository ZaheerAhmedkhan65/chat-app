const app = require('./app');
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");
const db = require('./config/db');

const server = http.createServer(app);
const io = socketIo(server);

io.on("connection", (socket) => {
  console.log("A user connected: ", socket.id);
  
  // Handle disconnections
  socket.on("disconnect", () => {
    console.log("User disconnected: ", socket.id);
  });
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

// Start the server using `server.listen`
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
