export const API_URL = 'http://localhost:3000';

function getAuthHeaders() {
  const token = localStorage.getItem('token');
  return {
    'Content-Type': 'application/json',
    ...(token ? { 'Authorization': `Bearer ${token}` } : {})
  };
}

export async function register(username, password) {
  const res = await fetch(`${API_URL}/api/register`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function login(username, password) {
  const res = await fetch(`${API_URL}/api/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username, password })
  });
  return res.json();
}

export async function fetchState() {
  const res = await fetch(`${API_URL}/api/state`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function buildInfrastructure(type, x, y) {
  const res = await fetch(`${API_URL}/api/build`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ type, x, y })
  });
  return res.json();
}

export async function expandRoom(x, y) {
  const res = await fetch(`${API_URL}/api/expand`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ x, y })
  });
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API_URL}/api/leaderboard`, {
    headers: getAuthHeaders()
  });
  return res.json();
}
