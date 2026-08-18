import { getInviteesStore, requireAdmin, jsonResponse } from './lib/store.js';

export default async (request) => {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const store = getInviteesStore();

  if (request.method === 'GET') {
    const { blobs } = await store.list();
    const invitees = await Promise.all(
      blobs.map((blob) => store.get(blob.key, { type: 'json' }))
    );
    return jsonResponse(invitees.filter(Boolean));
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));
    const name = (body.name || '').trim();

    if (!name) {
      return jsonResponse({ error: 'El nombre es obligatorio' }, 400);
    }

    const now = new Date().toISOString();
    const invitee = {
      id: crypto.randomUUID(),
      name,
      status: 'pending',
      menuPreference: null,
      guestCount: 0,
      createdAt: now,
      updatedAt: now,
    };

    await store.setJSON(invitee.id, invitee);
    return jsonResponse({ ...invitee, link: `/i/${invitee.id}` }, 201);
  }

  return jsonResponse({ error: 'Método no permitido' }, 405);
};

export const config = {
  path: '/api/invitees',
};
