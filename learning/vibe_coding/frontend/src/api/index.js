export const API_URL = 'http://localhost:3000';

export async function fetchState() {
  const res = await fetch(`${API_URL}/api/state`);
  return res.json();
}

export async function buildInfrastructure(type, x, y) {
  const res = await fetch(`${API_URL}/api/build`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ type, x, y })
  });
  return res.json();
}

export async function expandRoom(x, y) {
  const res = await fetch(`${API_URL}/api/expand`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ x, y })
  });
  return res.json();
}
