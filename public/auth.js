// In-memory user state (No localStorage/sessionStorage)
let currentUser = null;

document.addEventListener('DOMContentLoaded', () => {
    initSession();
});

// Check active session on load via HttpOnly cookie
async function initSession() {
    try {
        const response = await fetch('/api/auth/me', {
            method: 'GET',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include'
        });

        if (response.ok) {
            const data = await response.json();
            currentUser = data.user;
            renderAppView(currentUser);
        } else {
            showAuthGate();
        }
    } catch (err) {
        showAuthGate();
    }
}

// Handle Login Submission
async function handleLogin(event) {
    if (event) event.preventDefault();
    clearGateError();

    const usernameInput = document.getElementById('login-username');
    const passwordInput = document.getElementById('login-password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        showGateError('Please fill in both username and password.');
        return;
    }

    try {
        const response = await fetch('/api/auth/login', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showGateError(data.error || 'Authentication failed.');
            return;
        }

        currentUser = data.user;
        renderAppView(currentUser);
    } catch (err) {
        showGateError('Network error. Unable to authenticate.');
    }
}

// Handle Registration Submission
async function handleRegister(event) {
    if (event) event.preventDefault();
    clearGateError();

    const usernameInput = document.getElementById('reg-username');
    const passwordInput = document.getElementById('reg-password');
    const username = usernameInput ? usernameInput.value.trim() : '';
    const password = passwordInput ? passwordInput.value : '';

    if (!username || !password) {
        showGateError('Username and password are required.');
        return;
    }

    try {
        const response = await fetch('/api/auth/register', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            credentials: 'include',
            body: JSON.stringify({ username, password })
        });

        const data = await response.json();

        if (!response.ok) {
            showGateError(data.error || 'Account creation failed.');
            return;
        }

        currentUser = data.user;
        renderAppView(currentUser);
    } catch (err) {
        showGateError('Network error. Unable to register.');
    }
}

// Handle Logout
async function handleLogout() {
    try {
        await fetch('/api/auth/logout', {
            method: 'POST',
            credentials: 'include'
        });
    } catch (_) {}

    currentUser = null;
    showAuthGate();
}

function renderAppView(user) {
    document.getElementById('auth-gate').classList.add('hidden');
    const mainApp = document.getElementById('main-app');
    mainApp.classList.remove('hidden');
    mainApp.classList.add('flex');

    const homeDisplayName = document.getElementById('home-display-name');
    if (homeDisplayName) homeDisplayName.innerText = user.username;
}

function showAuthGate() {
    const mainApp = document.getElementById('main-app');
    if (mainApp) {
        mainApp.classList.add('hidden');
        mainApp.classList.remove('flex');
    }
    document.getElementById('auth-gate').classList.remove('hidden');
}

function showGateError(message) {
    const errorEl = document.getElementById('gate-error-msg');
    if (errorEl) {
        errorEl.textContent = message;
        errorEl.classList.remove('hidden');
    }
}

function clearGateError() {
    const errorEl = document.getElementById('gate-error-msg');
    if (errorEl) {
        errorEl.textContent = '';
        errorEl.classList.add('hidden');
    }
}