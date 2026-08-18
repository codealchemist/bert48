const content = document.getElementById('rsvpContent');
const greeting = document.getElementById('inviteeGreeting');

const MENU_LABELS = {
  tradicional: 'Asado / Tradicional',
  veggie: 'Vegetariano / Vegano',
  'sin-gluten': 'Sin Gluten',
  keto: 'Keto',
};

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

function menuOptionsHtml(selected) {
  return Object.entries(MENU_LABELS)
    .map(([value, label]) => {
      const isSelected = value === selected ? ' selected' : '';
      return `<option value="${value}"${isSelected}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function showGreeting(name) {
  greeting.textContent = `¡Hola ${name}!`;
  greeting.hidden = false;
}

function renderNoGuid() {
  content.innerHTML = `
    <p class="rsvp-message">Esta invitación es personal. Pedile tu link a Bert para confirmar tu asistencia.</p>
  `;
}

function renderNotFound() {
  content.innerHTML = `
    <p class="rsvp-message">No encontramos tu invitación. Consultá con Bert por tu link.</p>
  `;
}

function renderError() {
  content.innerHTML = `
    <p class="rsvp-message">No pudimos cargar tu invitación. Intentá de nuevo en un rato.</p>
  `;
}

function renderPending(invitee, guid) {
  content.innerHTML = `
    <div class="form-group">
      <label for="menu">PREFERENCIA DE MENÚ:</label>
      <select id="menu">${menuOptionsHtml(invitee.menuPreference)}</select>
    </div>
    <div class="form-group">
      <label for="guestCount">¿CUÁNTOS ACOMPAÑANTES VIENEN CON VOS?</label>
      <input type="number" id="guestCount" min="0" max="20" value="${invitee.guestCount || 0}">
    </div>
    <button type="button" class="btn-submit" id="confirmBtn">CONFIRMAR ASISTENCIA</button>
    <div class="rsvp-message" id="actionError"></div>
  `;

  document.getElementById('confirmBtn').addEventListener('click', async () => {
    const menuPreference = document.getElementById('menu').value;
    const guestCount = Number(document.getElementById('guestCount').value);
    const errorEl = document.getElementById('actionError');
    errorEl.textContent = '';

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', menuPreference, guestCount }),
      });

      if (!response.ok) {
        errorEl.textContent = 'No pudimos confirmar tu asistencia. Probá de nuevo.';
        return;
      }

      const updated = await response.json();
      renderConfirmed(updated, guid);
    } catch {
      errorEl.textContent = 'No pudimos confirmar tu asistencia. Probá de nuevo.';
    }
  });
}

function renderConfirmed(invitee, guid) {
  content.innerHTML = `
    <div class="rsvp-confirmed-badge"><i class="fi fi-rr-check-circle"></i> ¡CONFIRMASTE TU ASISTENCIA!</div>
    <div class="form-group">
      <label for="menu">PREFERENCIA DE MENÚ:</label>
      <select id="menu">${menuOptionsHtml(invitee.menuPreference)}</select>
    </div>
    <div class="form-group">
      <label for="guestCount">¿CUÁNTOS ACOMPAÑANTES VIENEN CON VOS?</label>
      <input type="number" id="guestCount" min="0" max="20" value="${invitee.guestCount || 0}">
    </div>
    <button type="button" class="btn-submit" id="updateBtn">ACTUALIZAR DATOS</button>
    <button type="button" class="btn-cancel" id="cancelBtn">CANCELAR ASISTENCIA</button>
    <div class="rsvp-message" id="actionError"></div>
  `;

  document.getElementById('updateBtn').addEventListener('click', async () => {
    const menuPreference = document.getElementById('menu').value;
    const guestCount = Number(document.getElementById('guestCount').value);
    const errorEl = document.getElementById('actionError');
    errorEl.textContent = '';

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', menuPreference, guestCount }),
      });

      if (!response.ok) {
        errorEl.textContent = 'No pudimos actualizar tus datos. Probá de nuevo.';
        return;
      }

      const updated = await response.json();
      renderConfirmed(updated, guid);
      const successEl = document.getElementById('actionError');
      successEl.textContent = 'Datos actualizados.';
    } catch {
      errorEl.textContent = 'No pudimos actualizar tus datos. Probá de nuevo.';
    }
  });

  document.getElementById('cancelBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError');
    errorEl.textContent = '';

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' }),
      });

      if (!response.ok) {
        errorEl.textContent = 'No pudimos cancelar tu asistencia. Probá de nuevo.';
        return;
      }

      const updated = await response.json();
      renderPending(updated, guid);
    } catch {
      errorEl.textContent = 'No pudimos cancelar tu asistencia. Probá de nuevo.';
    }
  });
}

function getGuidFromUrl() {
  const pathMatch = location.pathname.match(/^\/i\/([^/]+)\/?$/);
  if (pathMatch) return pathMatch[1];
  return new URLSearchParams(location.search).get('guid');
}

async function init() {
  const guid = getGuidFromUrl();

  if (!guid) {
    renderNoGuid();
    return;
  }

  try {
    const response = await fetch(`/api/rsvp/${guid}`);

    if (response.status === 404) {
      renderNotFound();
      return;
    }

    if (!response.ok) {
      renderError();
      return;
    }

    const invitee = await response.json();
    showGreeting(invitee.name);

    if (invitee.status === 'confirmed') {
      renderConfirmed(invitee, guid);
    } else {
      renderPending(invitee, guid);
    }
  } catch {
    renderError();
  }
}

init();
