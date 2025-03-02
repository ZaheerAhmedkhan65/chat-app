function editMessage(messageId, receiverId) {

  // Find the message container
  const messageContainer = document.getElementById(`message-container-${messageId}`);
  if (!messageContainer) {
    return;
  }

  // Get the message content
  const messageContent = messageContainer.querySelector(".message-content p").textContent.trim();

 // Get the message image (if it exists)
 const messageImageElement = messageContainer.querySelector(".message-content img");
 const messageImage = messageImageElement ? messageImageElement.src : null;
  
  // Store the original message in a data attribute
  messageContainer.dataset.originalMessage = messageContent;

  // Replace the message content with the edit form
  messageContainer.innerHTML = `
    <div class="message-content ${receiverId === userId ? 'received' : 'sent'} px-2 py-1 mb-2 rounded position-relative">
      ${messageImage ? `<img src="${messageImage}" alt="Message Image" class="message-image">` : ""}
      <form id="edit-message-form-${messageId}">
        <input type="text" name="newMessage" id="edit-message-input-${messageId}" value="${messageContent}" class="form-control" required>
        <input type="hidden" name="receiverId" value="${receiverId}" class="d-none">
        <div class="d-flex gap-2 align-items-center justify-content-end">
          <button type="submit" class="btn btn-primary btn-sm mt-1">Update</button>
          <button type="button" class="btn btn-secondary btn-sm mt-1" onclick="cancelEdit('${messageId}')">Cancel</button>
        </div>
      </form>
    </div>
  `;

  // Add an event listener for the edit form submission
  const editMessageForm = document.getElementById(`edit-message-form-${messageId}`);
  editMessageForm.addEventListener("submit", (event) => {
    event.preventDefault();
    const newMessage = document.getElementById(`edit-message-input-${messageId}`).value;
    if (newMessage) {
      socket.emit("update_message", {
        messageId,
        newMessage,
        receiverId,
        imageUrl: messageImage,
        senderId: userId,
      });
    }
  });
}

function cancelEdit(messageId) {
  // Find the message container
  const messageContainer = document.getElementById(`message-container-${messageId}`);
  if (!messageContainer) {
    console.error("Message container not found");
    return;
  }

  // Get the message image (if it exists)
 const messageImageElement = messageContainer.querySelector(".message-content img");
 const messageImage = messageImageElement ? messageImageElement.src : null;
  

  // Get the original message content from the data attribute
  const originalMessage = messageContainer.dataset.originalMessage;

  // Restore the original message content
  messageContainer.innerHTML = `
    <div class="message-content ${receiverId === userId ? 'received' : 'sent'} px-2 py-1 mb-2 rounded position-relative">
    <div class="message-dropdown position-absolute">
        <div class="btn-group dropstart">
          <button type="button" style="padding: 0 0 4px !important;"
            class="btn btn-sm bg-transparent p-0 border-0 m-0 rounded-circle"
            data-bs-toggle="dropdown" aria-expanded="false">
            <i class="ri-arrow-down-wide-line"></i>
          </button>
          <ul class="dropdown-menu">
            <li class="dropdown-item">
              <button class="dropdown-item"
                onclick="editMessage('${messageId}', '${receiverId}')">
                <i class="ri-pencil-line"></i> Edit
              </button>
            </li>
            <li class="dropdown-item">
              <button type="button" class="dropdown-item"
                onclick="deleteMessage('${messageId}', '${receiverId}')">
                <i class="ri-delete-bin-5-line"></i> Delete
              </button>
            </li>
          </ul>
        </div>
      </div>
    ${messageImage ? `
      <div class="message-image-content">
        ${messageImage ? `<img src="${messageImage}" alt="Message Image" class="message-image">` : ""}
      </div>
      `:""
    }
      
      <div class="message-text-content">
        <p class="mb-1">
          ${originalMessage}
        </p>
        <small class="text-muted">
          ${new Date().toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true })}
        </small>
      </div>
    </div>
  `;
}


function deleteMessage(messageId, token, receiverId) {
  if (!confirm('Are you sure you want to delete this message?')) {
    return;
  }

  // Send the delete request to the server
  fetch(`/messages/delete/${messageId}?receiverId=${receiverId}`, {
    method: 'DELETE',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      token: token,
      receiverId: receiverId
    })
  })
    .then(response => response.json())
    .then(data => {
      if (data.success) {
        // Emit event to delete the message
        socket.emit("delete_message", {
          messageId,
          receiverId
        });
      } else {
        alert('Error deleting message');
      }
    })
    .catch(error => console.error('Error:', error));
}