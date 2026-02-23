const BASE = '/api';

let _token = localStorage.getItem('zc_token') || null;

export function setToken(t) {
  _token = t;
  localStorage.setItem('zc_token', t);
}

export function getToken() {
  return _token;
}

async function req(method, path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(_token ? { Authorization: `Bearer ${_token}` } : {}),
    },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  const data = await res.json();
  if (!res.ok) throw new Error(data.error || 'Request failed');
  return data;
}

export const api = {
  auth:         (initData, testUser) => req('POST', '/auth', { initData, testUser }),
  getAnimals:   ()        => req('GET',  '/matches/animals'),
  getOpen:      ()        => req('GET',  '/matches/open'),
  getMy:        ()        => req('GET',  '/matches/my'),
  createMatch:  ()        => req('POST', '/matches'),
  joinMatch:    (id)      => req('POST', `/matches/${id}/join`),
  getMatch:     (id)      => req('GET',  `/matches/${id}`),
  setHand:      (id, layout) => req('POST', `/matches/${id}/hand`,  { layout }),
  submitGuess:  (id, guess)  => req('POST', `/matches/${id}/guess`, { guess }),
};
