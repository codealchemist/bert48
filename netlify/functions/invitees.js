import { getInviteesStore, requireAdmin, jsonResponse } from './lib/store.js';

export default async (request, context) => {
  const unauthorized = requireAdmin(request);
  if (unauthorized) return unauthorized;

  const store = getInviteesStore();
  const { id } = context.params;

  if (request.method === 'DELETE') {
    if (!id) return jsonResponse({ error: 'Falta el id del invitado' }, 400);
    await store.delete(id);
    return jsonResponse({ ok: true });
  }

  if (request.method === 'PATCH') {
    if (!id) return jsonResponse({ error: 'Falta el id del invitado' }, 400);
    const body = await request.json().catch(() => ({}));
    if (!('alias' in body)) {
      return jsonResponse({ error: 'Falta el alias' }, 400);
    }

    const invitee = await store.get(id, { type: 'json' });
    if (!invitee) return jsonResponse({ error: 'Invitado no encontrado' }, 404);

    invitee.alias = (body.alias || '').trim();
    invitee.updatedAt = new Date().toISOString();
    await store.setJSON(id, invitee);
    return jsonResponse(invitee);
  }

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
      alias: null,
      status: 'pending',
      menuPreferences: [],
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
  path: ['/api/invitees', '/api/invitees/:id'],
};
