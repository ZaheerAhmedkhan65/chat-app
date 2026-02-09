module.exports = (io, socket) => {

    socket.on("user_disconnect", async () => {
        socket.disconnect();
    });

};