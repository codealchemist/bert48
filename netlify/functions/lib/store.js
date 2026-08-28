import { getStore } from '@netlify/blobs';

export function getInviteesStore() {
  // Default (eventual) consistency can leave store.list() lagging behind a
  // just-written blob indefinitely; the admin list needs to see writes right away.
  return getStore({ name: 'invitees', consistency: 'strong' });
}

export function getControlStore() {
  return getStore({ name: 'control', consistency: 'strong' });
}

export function getPasskeyStore() {
  return getStore({ name: 'passkeys', consistency: 'strong' });
}

export function isAdminRequest(request) {
  const auth = request.headers.get('authorization') || '';
  const token = auth.startsWith('Bearer ') ? auth.slice(7) : '';
  return Boolean(process.env.ADMIN_PASSWORD) && token === process.env.ADMIN_PASSWORD;
}

export function requireAdmin(request) {
  if (!isAdminRequest(request)) {
    return new Response(JSON.stringify({ error: 'No autorizado' }), {
      status: 401,
      headers: { 'content-type': 'application/json' },
    });
  }

  return null;
}

export function jsonResponse(data, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'content-type': 'application/json' },
  });
}
