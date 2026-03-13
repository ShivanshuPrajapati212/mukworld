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

export async function setTrainingRate(rate) {
  const res = await fetch(`${API_URL}/api/train`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ rate })
  });
  return res.json();
}

export async function sellData() {
  const res = await fetch(`${API_URL}/api/sell`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({})
  });
  return res.json();
}
