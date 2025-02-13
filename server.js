const app = require('./app');
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");

const socketHandler = require('./webSockets/socketHandler');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",  // Change this to your frontend URL in production
    methods: ["GET", "POST"]
  }
});


// called the socket handler
socketHandler(io);

// Server is listening on port 3000
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});