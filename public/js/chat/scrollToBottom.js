
  function scrollToBottom() {
    const chatWindow = document.getElementById('chat-window');
    chatWindow.scrollTop = chatWindow.scrollHeight;
  }

  function disableSubmitButton() {
    const submitButton = document.querySelector('#message-form button[type="submit"]');
    submitButton.disabled = true;
    submitButton.style.cursor = 'not-allowed';
    submitButton.style.opacity = '0.5';
    submitButton.classList.remove('btn-success');
  }

  document.addEventListener('DOMContentLoaded', () => {
    scrollToBottom();
    disableSubmitButton();
  });

  document.getElementById("message").addEventListener("input", () => {
    const submitButton = document.querySelector('#message-form button[type="submit"]');
    if (document.getElementById("message").value.length === 0) {
      disableSubmitButton();
    } else {
      submitButton.disabled = false;
      submitButton.style.cursor = 'pointer';
      submitButton.style.opacity = '1';
      submitButton.classList.add('btn-success');
    }
  });

  document.getElementById('message').addEventListener('keydown', (event) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      document.getElementById('message-form').dispatchEvent(new Event("submit"));
    }
  });