const API_URL = '/api';

function getToken() {
    return localStorage.getItem('token');
}

function saveToken(token) {
    localStorage.setItem('token', token);
}

function logout() {
    localStorage.removeItem('token');
    window.location.href = '/index.html';
}

async function apiFetch(path, options = {}) {
    const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
    const token = getToken();
    if (token) {
        headers.Authorization = `Bearer ${token}`;
    }

    const response = await fetch(`${API_URL}${path}`, { ...options, headers });
    const data = await response.json().catch(() => ({}));

    // Token vencido o inválido: cerrar sesión
    if (response.status === 401 && token) {
        logout();
        throw new Error('Tu sesión expiró, inicia sesión de nuevo');
    }
    if (!response.ok) {
        throw new Error(data.message || 'Error inesperado');
    }
    return data;
}