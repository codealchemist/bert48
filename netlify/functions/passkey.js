import {
  generateRegistrationOptions,
  verifyRegistrationResponse,
  generateAuthenticationOptions,
  verifyAuthenticationResponse,
} from '@simplewebauthn/server';
import {
  getPasskeyStore,
  requireAdmin,
  jsonResponse,
} from './lib/store.js';

const RP_NAME = 'BERT48 Admin';
const CHALLENGE_TTL_MS = 5 * 60 * 1000;

const EMPTY_STATE = { userID: null, credential: null };

async function loadState(store) {
  return (await store.get('state', { type: 'json' })) || { ...EMPTY_STATE };
}

async function saveState(store, state) {
  await store.setJSON('state', state);
}

async function loadChallenge(store, expectedType) {
  const record = await store.get('challenge', { type: 'json' });
  if (!record) return null;
  if (record.type !== expectedType) return null;
  if (Date.now() - record.createdAt > CHALLENGE_TTL_MS) return null;
  return record.challenge;
}

async function saveChallenge(store, type, challenge) {
  await store.setJSON('challenge', { type, challenge, createdAt: Date.now() });
}

async function clearChallenge(store) {
  await store.delete('challenge');
}

function toPublicCredential(cred) {
  if (!cred) return null;
  return { label: cred.label, createdAt: cred.createdAt };
}

function decodePublicKey(base64url) {
  return new Uint8Array(Buffer.from(base64url, 'base64url'));
}

export default async (request, context) => {
  const url = new URL(request.url);
  const rpID = url.hostname;
  const origin = url.origin;
  const store = getPasskeyStore();

  if (request.method === 'GET') {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const state = await loadState(store);
    return jsonResponse({ credential: toPublicCredential(state.credential) });
  }

  if (request.method !== 'POST') {
    return jsonResponse({ error: 'Método no permitido' }, 405);
  }

  const body = await request.json().catch(() => ({}));

  if (body.action === 'register-options') {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const state = await loadState(store);
    if (!state.userID) {
      state.userID = Buffer.from(crypto.getRandomValues(new Uint8Array(32))).toString(
        'base64url'
      );
      await saveState(store, state);
    }

    const options = await generateRegistrationOptions({
      rpName: RP_NAME,
      rpID,
      userName: 'admin',
      userID: decodePublicKey(state.userID),
      attestationType: 'none',
      excludeCredentials: state.credential
        ? [{ id: state.credential.id, transports: state.credential.transports }]
        : [],
      authenticatorSelection: {
        residentKey: 'preferred',
        userVerification: 'preferred',
      },
    });

    await saveChallenge(store, 'registration', options.challenge);
    return jsonResponse(options);
  }

  if (body.action === 'register-verify') {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const expectedChallenge = await loadChallenge(store, 'registration');
    if (!expectedChallenge) {
      return jsonResponse({ error: 'El registro expiró, probá de nuevo' }, 400);
    }

    let verification;
    try {
      verification = await verifyRegistrationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }

    await clearChallenge(store);

    if (!verification.verified) {
      return jsonResponse({ error: 'No se pudo verificar la passkey' }, 400);
    }

    const { credential } = verification.registrationInfo;
    const state = await loadState(store);
    // A new registration replaces whatever was registered before — this
    // site only ever needs one passkey for its one admin.
    state.credential = {
      id: credential.id,
      publicKey: Buffer.from(credential.publicKey).toString('base64url'),
      counter: credential.counter,
      transports: credential.transports || [],
      label: (body.label || '').trim() || 'Passkey',
      createdAt: new Date().toISOString(),
    };
    await saveState(store, state);

    return jsonResponse({ credential: toPublicCredential(state.credential) });
  }

  if (body.action === 'remove') {
    const unauthorized = requireAdmin(request);
    if (unauthorized) return unauthorized;

    const state = await loadState(store);
    state.credential = null;
    await saveState(store, state);
    return jsonResponse({ credential: null });
  }

  if (body.action === 'has-credentials') {
    const state = await loadState(store);
    return jsonResponse({ hasCredentials: Boolean(state.credential) });
  }

  if (body.action === 'auth-options') {
    const state = await loadState(store);
    if (!state.credential) {
      return jsonResponse({ error: 'No hay una passkey registrada' }, 400);
    }

    const options = await generateAuthenticationOptions({
      rpID,
      allowCredentials: [
        { id: state.credential.id, transports: state.credential.transports },
      ],
      userVerification: 'preferred',
    });

    await saveChallenge(store, 'authentication', options.challenge);
    return jsonResponse(options);
  }

  if (body.action === 'auth-verify') {
    const expectedChallenge = await loadChallenge(store, 'authentication');
    if (!expectedChallenge) {
      return jsonResponse({ error: 'El inicio de sesión expiró, probá de nuevo' }, 400);
    }

    const state = await loadState(store);
    const stored = state.credential;
    if (!stored || stored.id !== body.response?.id) {
      return jsonResponse({ error: 'Credencial no reconocida' }, 400);
    }

    let verification;
    try {
      verification = await verifyAuthenticationResponse({
        response: body.response,
        expectedChallenge,
        expectedOrigin: origin,
        expectedRPID: rpID,
        credential: {
          id: stored.id,
          publicKey: decodePublicKey(stored.publicKey),
          counter: stored.counter,
          transports: stored.transports,
        },
      });
    } catch (err) {
      return jsonResponse({ error: err.message }, 400);
    }

    await clearChallenge(store);

    if (!verification.verified) {
      return jsonResponse({ error: 'No se pudo verificar la passkey' }, 401);
    }

    stored.counter = verification.authenticationInfo.newCounter;
    await saveState(store, state);

    if (!process.env.ADMIN_PASSWORD) {
      return jsonResponse({ error: 'El servidor no tiene ADMIN_PASSWORD configurado' }, 500);
    }
    return jsonResponse({ token: process.env.ADMIN_PASSWORD });
  }

  return jsonResponse({ error: 'Acción inválida' }, 400);
};

export const config = {
  path: '/api/passkey',
};
