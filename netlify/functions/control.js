import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import {
  getControlStore,
  isAdminRequest,
  requireAdmin,
  jsonResponse,
} from './lib/store.js';

const MEDIA_JSON_PATH = fileURLToPath(
  new URL('../../src/media.json', import.meta.url)
);

const DEFAULT_STATE = { active: false, currentIndex: null };

function loadMedia() {
  try {
    const raw = readFileSync(MEDIA_JSON_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function findByIndex(media, index) {
  return media.find((item) => item.index === index) || null;
}

function toPublicState(state, media) {
  if (!state.active) return { active: false };

  const item = state.currentIndex === null ? null : findByIndex(media, state.currentIndex);
  if (!item) return { active: true, index: null };

  return {
    active: true,
    index: item.index,
    name: item.name,
    type: item.type,
    url: item.url,
  };
}

export default async (request, context) => {
  const store = getControlStore();

  if (request.method === 'GET') {
    const state = (await store.get('state', { type: 'json' })) || DEFAULT_STATE;
    const media = loadMedia();
    const publicState = toPublicState(state, media);

    if (isAdminRequest(request)) {
      return jsonResponse({ ...publicState, items: media });
    }
    return jsonResponse(publicState);
  }

  if (request.method === 'POST') {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const body = await request.json().catch(() => ({}));
    const media = loadMedia();
    let state;

    if (body.action === 'start') {
      // No media requirement here on purpose: starting a session just
      // triggers the takeover screen (useful standalone, e.g. for testing),
      // and is a separate step from 'show', which does require a real item.
      state = { active: true, currentIndex: null };
    } else if (body.action === 'show') {
      const index = body.index;
      if (!findByIndex(media, index)) {
        return jsonResponse({ error: 'Índice de media inválido' }, 400);
      }
      state = { active: true, currentIndex: index };
    } else if (body.action === 'end') {
      state = { active: false, currentIndex: null };
    } else {
      return jsonResponse({ error: 'Acción inválida' }, 400);
    }

    state.updatedAt = new Date().toISOString();
    await store.setJSON('state', state);
    return jsonResponse({ ...toPublicState(state, media), items: media });
  }

  return jsonResponse({ error: 'Método no permitido' }, 405);
};

export const config = {
  path: '/api/control',
};
