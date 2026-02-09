const authMiddleware = require("./middlewares/auth.middleware");

module.exports = (io) => {
    io.use(authMiddleware);
    
    io.on("connection", (socket) => {
        require("./events/connection")(io, socket);
        require("./events/message.events")(io, socket);
        require("./events/typing.events")(io, socket);
        require("./events/userStatus.events")(io, socket);
    });
};