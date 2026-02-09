const app = require('./config/app');
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");

const socketServer = require('./webSockets');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

socketServer(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});