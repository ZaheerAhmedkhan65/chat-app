function editMessage(messageId, token, receiverId) {
    const messageContainer = document.getElementById(`message-container-${messageId}`);

    if (!messageContainer) {
      console.error(`Element not found: message-container-${messageId}`);
      return;
    }

    fetch(`/messages/edit/${messageId}?token=${token}&receiverId=${receiverId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`
      }
    })
      .then(response => {
        if (!response.ok) throw new Error('Unauthorized or bad request');
        return response.text();
      })
      .then(html => {
        messageContainer.innerHTML = html;
      })
      .catch(error => console.error('Error fetching edit form:', error));
  }

  function cancelEdit(messageId) {
    location.reload(); // Refresh to restore the original message
  }

  function deleteMessage(messageId, token, receiverId) {
    if(!confirm('Are you sure you want to delete this message?')){
      return;
    }
    fetch(`/messages/delete/${messageId}?token=${token}&receiverId=${receiverId}`, {
      method: 'DELETE',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        token: token,
        receiverId: receiverId
      })
    })
      .then(response => response.json())
      .then(data => {
        console.log(data); // Log the response to ensure it's as expected
        if (data.success) {
          // Successfully deleted the message
          location.reload();
        } else {
          alert('Error deleting message');
        }
      })
      .catch(error => console.error('Error:', error));

  }
