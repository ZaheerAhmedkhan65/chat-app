// Refresh token every 58 minutes
setInterval(() => {
    fetch('/auth/refresh-token', {
        method: 'POST',
        credentials: 'include'
    }).then(response => {
        if (!response.ok) {
            window.location.href = '/auth/login';
        }
    });
}, 30 * 60 * 1000);