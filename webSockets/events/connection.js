const Users = require("../models/Users");

module.exports = async (io, socket) => {
    const userId = socket.user.id;

    try {
        await Users.updateOnlineStatus(userId, 1);
        console.log(`User ${userId} connected`);

        socket.broadcast.emit("user_online", {
            userId,
            is_online: 1
        });
    } catch (err) {
        console.error("Connection error:", err);
    }

    socket.on("disconnect", async () => {
        try {
            await Users.updateOnlineStatus(userId, 0);
            console.log(`User ${userId} disconnected`);

            io.emit("user_offline", {
                userId,
                is_online: 0
            });
        } catch (err) {
            console.error("Disconnect error:", err);
        }
    });
};