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

export async function moveInfrastructure(fromX, fromY, toX, toY, newType) {
  const res = await fetch(`${API_URL}/api/move`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ fromX, fromY, toX, toY, newType })
  });
  return res.json();
}

export async function expandRoom(x, y, size = 1) {
  const res = await fetch(`${API_URL}/api/expand`, {
    method: 'POST',
    headers: getAuthHeaders(),
    body: JSON.stringify({ x, y, size })
  });
  return res.json();
}

export async function fetchLeaderboard() {
  const res = await fetch(`${API_URL}/api/leaderboard`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function fetchPlayerState(username) {
  const res = await fetch(`${API_URL}/api/player/${encodeURIComponent(username)}`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function fetchPlayers(page = 1, limit = 20) {
  const res = await fetch(`${API_URL}/api/players?page=${page}&limit=${limit}`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function searchPlayers(query) {
  const res = await fetch(`${API_URL}/api/players/search?q=${encodeURIComponent(query)}`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

export async function fetchRandomPlayer() {
  const res = await fetch(`${API_URL}/api/players/random`, {
    headers: getAuthHeaders()
  });
  return res.json();
}

