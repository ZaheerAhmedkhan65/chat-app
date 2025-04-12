const app = require('./app');
const PORT = process.env.PORT || 3000;
const http = require("http");
const socketIo = require("socket.io");

const socketHandler = require('./webSockets/socketHandler');

const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

socketHandler(io);

server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});