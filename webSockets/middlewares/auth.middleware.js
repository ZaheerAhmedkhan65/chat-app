const jwt = require("jsonwebtoken");

module.exports = (socket, next) => {
    try {
        const token =
            socket.handshake.auth?.token ||
            socket.handshake.query?.token ||
            socket.handshake.headers?.authorization?.split(" ")[1];

        if (!token) {
            return next(new Error("Authentication token missing"));
        }

        const decoded = jwt.verify(token, process.env.JWT_SECRET);

        // attach user info to socket
        socket.user = {
            id: decoded.id,
            email: decoded.email,
        };

        next();
    } catch (err) {
        next(new Error("Invalid or expired token"));
    }
};