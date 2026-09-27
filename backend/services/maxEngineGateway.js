const { sourceUrl } = require('../config/maxEngine');

async function request(method, path, authorization, body, query) {
  const url = new URL(sourceUrl() + path);
  for (const [key, value] of Object.entries(query || {})) {
    if (!(path.startsWith('/peak/workflows/') ? ['params'] : ['cursor', 'filters', 'ids', 'expand']).includes(key) || typeof value !== 'string') return { status: 422,
      body: { error: { code: 'INVALID_QUERY', message: '허용된 조회 조건만 지정해 주세요.', details: {} } } };
    url.searchParams.set(key, value);
  }
  const response = await fetch(url, { method, redirect: 'error', signal: AbortSignal.timeout(20000),
    headers: { 'Content-Type': 'application/json', ...(authorization ? { Authorization: authorization } : {}) },
    body: method === 'POST' ? JSON.stringify(body) : undefined });
  const result = await response.json();
  return { status: response.status, body: result };
}
module.exports = { request };
