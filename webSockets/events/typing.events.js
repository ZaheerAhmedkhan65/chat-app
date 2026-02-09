module.exports = (io, socket) => {

    socket.on("typing", (data) => {
        socket.broadcast.emit("typing", data);
    });

    socket.on("stop typing", () => {
        socket.broadcast.emit("stop typing");
    });

};