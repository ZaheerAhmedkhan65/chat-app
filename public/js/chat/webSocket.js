const socket = io();
const userId = "<%= userId %>";
const messageForm = document.getElementById("message-form");
const messageInput = document.getElementById("message");
const typingContainer = document.querySelector(".typing");
let typingTimeout;
function stopTyping() {
    socket.emit("stop typing");
}

messageInput.addEventListener("input", () => {
    socket.emit("typing", "Typing . . .");
    clearTimeout(typingTimeout);
    typingTimeout = setTimeout(stopTyping, 500);
});
messageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const message = messageInput.value.trim();
    if (message) {
        messageInput.value = "";
        socket.emit("send_message", {
            message,
            receiverId: "<%= receiverId %>",
            senderId: userId,
            token: "<%= token %>"
        });
    }
});

socket.on("receive_message", (data) => {
    const messageContainer = document.createElement("div");
    console.log(data);
    if (data.senderId === userId) {
        messageContainer.classList.add("message", "sent", "p-2", "mb-2", "rounded");
        messageContainer.id = `message-container-${data.id}`;
    } else {
        messageContainer.classList.add("message", "received", "p-2", "mb-2", "rounded");
        messageContainer.id = `message-container-${data.id}`;
    }
    messageContainer.innerHTML = `
          <div class="message-content">
            <p class="mb-1">
              ${data.message}
            </p>
            <small class="text-muted">
              ${data.created_at ? data.created_at : new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
            </small>
          </div>
        `;
    document.getElementById("chat-window").appendChild(messageContainer);
    scrollToBottom();
});


socket.on("typing", () => {
    typingContainer.textContent = "Typing . . .";
});

socket.on("stop typing", () => {
    typingContainer.textContent = "";
});