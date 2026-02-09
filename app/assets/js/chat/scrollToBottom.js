
const chatWindow = document.getElementById('chat-window');
const scrollButton = document.getElementById('bottom-scroll-button');

chatWindow.addEventListener('scroll', () => {
  // Allow a small tolerance for floating point inaccuracies
  const atBottom = Math.abs(chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight) < 2;
  if (atBottom) {
    scrollButton.style.display = 'none'; // Hide button
  } else {
    scrollButton.style.display = 'block'; // Show button
  }
});


// Function to scroll to bottom
function bottomScroll() {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
}

function scrollToBottom() {
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function disableSubmitButton() {
  const submitButton = document.querySelector('#message-form button[type="submit"]');
  submitButton.disabled = true;
  submitButton.style.cursor = "not-allowed";
  submitButton.style.opacity = '0.5';
  submitButton.classList.remove("text-primary");
}

document.addEventListener("DOMContentLoaded", () => {
  scrollToBottom();
  disableSubmitButton();
});

document.getElementById("message").addEventListener("input", () => {
  const submitButton = document.querySelector('#message-form button[type="submit"]');
  if (document.getElementById("message").value.length === 0) {
    disableSubmitButton();
  } else {
    submitButton.disabled = false;
    submitButton.style.cursor = "pointer";
    submitButton.style.opacity = '1';
    submitButton.classList.add("text-primary");
  }
});

document.getElementById("message").addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    document.getElementById('message-form').dispatchEvent(new Event("submit"));
  }
});