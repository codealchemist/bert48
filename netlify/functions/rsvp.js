import { getInviteesStore, jsonResponse } from './lib/store.js';

const VALID_MENU_PREFERENCES = ['tradicional', 'veggie', 'sin-gluten', 'keto'];
const MAX_GUEST_COUNT = 20;

function isValidGuestCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_GUEST_COUNT;
}

export default async (request, context) => {
  const { guid } = context.params;
  const store = getInviteesStore();
  const invitee = await store.get(guid, { type: 'json' });

  if (!invitee) {
    return jsonResponse({ error: 'Invitación no encontrada' }, 404);
  }

  if (request.method === 'GET') {
    return jsonResponse(invitee);
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'confirm') {
      if (!VALID_MENU_PREFERENCES.includes(body.menuPreference)) {
        return jsonResponse({ error: 'Preferencia de menú inválida' }, 400);
      }
      if (!isValidGuestCount(body.guestCount)) {
        return jsonResponse({ error: 'Cantidad de acompañantes inválida' }, 400);
      }
      invitee.status = 'confirmed';
      invitee.menuPreference = body.menuPreference;
      invitee.guestCount = body.guestCount;
    } else if (body.action === 'cancel') {
      invitee.status = 'cancelled';
    } else {
      return jsonResponse({ error: 'Acción inválida' }, 400);
    }

    invitee.updatedAt = new Date().toISOString();
    await store.setJSON(guid, invitee);
    return jsonResponse(invitee);
  }

  return jsonResponse({ error: 'Método no permitido' }, 405);
};

export const config = {
  path: '/api/rsvp/:guid',
};
