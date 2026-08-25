import { getInviteesStore, jsonResponse } from './lib/store.js';

const VALID_MENU_PREFERENCES = ['tradicional', 'veggie', 'sin-gluten'];
const MAX_GUEST_COUNT = 4;

function isValidGuestCount(value) {
  return Number.isInteger(value) && value >= 0 && value <= MAX_GUEST_COUNT;
}

function isValidMenuPreferences(value, guestCount) {
  return (
    Array.isArray(value) &&
    value.length === guestCount + 1 &&
    value.every((pref) => VALID_MENU_PREFERENCES.includes(pref))
  );
}

// The alias is an admin-only note and must never reach the invitee's browser.
function toPublicInvitee(invitee) {
  const { alias, ...publicInvitee } = invitee;
  return publicInvitee;
}

export default async (request, context) => {
  const { guid } = context.params;
  const store = getInviteesStore();
  const invitee = await store.get(guid, { type: 'json' });

  if (!invitee) {
    return jsonResponse({ error: 'Invitación no encontrada' }, 404);
  }

  if (request.method === 'GET') {
    return jsonResponse(toPublicInvitee(invitee));
  }

  if (request.method === 'POST') {
    const body = await request.json().catch(() => ({}));

    if (body.action === 'confirm') {
      if (!isValidGuestCount(body.guestCount)) {
        return jsonResponse({ error: 'Cantidad de acompañantes inválida' }, 400);
      }
      if (!isValidMenuPreferences(body.menuPreferences, body.guestCount)) {
        return jsonResponse({ error: 'Preferencia de menú inválida' }, 400);
      }
      invitee.status = 'confirmed';
      invitee.menuPreferences = body.menuPreferences;
      invitee.guestCount = body.guestCount;
    } else if (body.action === 'cancel') {
      invitee.status = 'cancelled';
    } else if (body.action === 'restore') {
      if (invitee.status !== 'cancelled') {
        return jsonResponse({ error: 'La invitación no está cancelada' }, 400);
      }
      const hadConfirmedData =
        isValidGuestCount(invitee.guestCount) &&
        isValidMenuPreferences(invitee.menuPreferences, invitee.guestCount);
      invitee.status = hadConfirmedData ? 'confirmed' : 'pending';
    } else {
      return jsonResponse({ error: 'Acción inválida' }, 400);
    }

    invitee.updatedAt = new Date().toISOString();
    await store.setJSON(guid, invitee);
    return jsonResponse(toPublicInvitee(invitee));
  }

  return jsonResponse({ error: 'Método no permitido' }, 405);
};

export const config = {
  path: '/api/rsvp/:guid',
};
