const TOKEN_KEY = 'adminToken';

const loginView = document.getElementById('loginView');
const panelView = document.getElementById('panelView');
const passwordInput = document.getElementById('passwordInput');
const loginBtn = document.getElementById('loginBtn');
const loginError = document.getElementById('loginError');
const createForm = document.getElementById('createForm');
const nameInput = document.getElementById('nameInput');
const createError = document.getElementById('createError');
const inviteesBody = document.getElementById('inviteesBody');
const emptyMsg = document.getElementById('emptyMsg');
const totalPeopleValue = document.getElementById('totalPeopleValue');
const statTotal = document.getElementById('statTotal');
const statPending = document.getElementById('statPending');
const statConfirmed = document.getElementById('statConfirmed');
const statCancelled = document.getElementById('statCancelled');
const menuBreakdown = document.getElementById('menuBreakdown');
const exportBtn = document.getElementById('exportBtn');

const STATUS_LABELS = {
  pending: { label: 'Pendiente', icon: 'fi-rr-clock', className: 'status-pending' },
  confirmed: { label: 'Confirmó', icon: 'fi-rr-check-circle', className: 'status-confirmed' },
  cancelled: { label: 'Canceló', icon: 'fi-rr-cross-circle', className: 'status-cancelled' },
};

const MENU_LABELS = {
  tradicional: 'Asado / Tradicional',
  veggie: 'Vegetariano / Vegano',
  'sin-gluten': 'Sin Gluten',
  keto: 'Keto',
};

let currentInvitees = [];

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || '';
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token);
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY);
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getToken()}`,
    },
  });

  if (response.status === 401) {
    clearToken();
    showLogin('La contraseña ya no es válida, ingresá de nuevo.');
    throw new Error('unauthorized');
  }

  return response;
}

function showLogin(errorMessage = '') {
  loginView.hidden = false;
  panelView.hidden = true;
  loginError.textContent = errorMessage;
}

function showPanel() {
  loginView.hidden = true;
  panelView.hidden = false;
}

function renderInvitees(invitees) {
  currentInvitees = invitees;

  inviteesBody.innerHTML = '';
  emptyMsg.hidden = invitees.length > 0;

  const sorted = [...invitees].sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  for (const invitee of sorted) {
    const status = STATUS_LABELS[invitee.status] || STATUS_LABELS.pending;
    const link = `${location.origin}/i/${invitee.id}`;
    const guestCount = invitee.guestCount || 0;

    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${escapeHtml(invitee.name)}</td>
      <td><span class="status-badge ${status.className}"><i class="fi ${status.icon}"></i> ${status.label}</span></td>
      <td>${guestCount}</td>
      <td>
        <div class="link-cell">
          <code>${escapeHtml(link)}</code>
          <button type="button" class="copy-btn" data-link="${escapeHtml(link)}"><i class="fi fi-rr-copy"></i></button>
        </div>
      </td>
    `;
    inviteesBody.appendChild(row);
  }

  renderSummary(invitees);
}

function renderSummary(invitees) {
  const confirmedInvitees = invitees.filter((invitee) => invitee.status === 'confirmed');

  statTotal.textContent = invitees.length;
  statPending.textContent = invitees.filter((invitee) => invitee.status === 'pending').length;
  statConfirmed.textContent = confirmedInvitees.length;
  statCancelled.textContent = invitees.filter((invitee) => invitee.status === 'cancelled').length;

  const totalConfirmedPeople = confirmedInvitees.reduce(
    (sum, invitee) => sum + 1 + (invitee.guestCount || 0),
    0
  );
  totalPeopleValue.textContent = totalConfirmedPeople;

  menuBreakdown.innerHTML = Object.entries(MENU_LABELS)
    .map(([value, label]) => {
      const count = confirmedInvitees
        .filter((invitee) => invitee.menuPreference === value)
        .reduce((sum, invitee) => sum + 1 + (invitee.guestCount || 0), 0);
      return `<span class="menu-chip">${escapeHtml(label)}: ${count}</span>`;
    })
    .join('');
}

function escapeHtml(value) {
  const div = document.createElement('div');
  div.textContent = value;
  return div.innerHTML;
}

async function loadInvitees() {
  const response = await apiFetch('/api/invitees');
  if (!response.ok) return;
  const invitees = await response.json();
  renderInvitees(invitees);
}

async function tryLogin(password) {
  setToken(password);
  try {
    await loadInvitees();
    showPanel();
  } catch {
    // showLogin already triggered by apiFetch on 401
  }
}

loginBtn.addEventListener('click', () => {
  const password = passwordInput.value.trim();
  if (!password) return;
  tryLogin(password);
});

passwordInput.addEventListener('keydown', (event) => {
  if (event.key === 'Enter') loginBtn.click();
});

createForm.addEventListener('submit', async (event) => {
  event.preventDefault();
  createError.textContent = '';
  const name = nameInput.value.trim();
  if (!name) return;

  try {
    const response = await apiFetch('/api/invitees', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name }),
    });

    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      createError.textContent = data.error || 'No se pudo crear la invitación.';
      return;
    }

    nameInput.value = '';
    await loadInvitees();
  } catch {
    // unauthorized already handled
  }
});

function toCsvField(value) {
  const str = String(value ?? '');
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str;
}

function buildInviteesCsv(invitees) {
  const header = ['Nombre', 'Estado', 'Preferencia de menú', 'Acompañantes', 'Link', 'Creado', 'Actualizado'];
  const rows = invitees.map((invitee) => [
    invitee.name,
    (STATUS_LABELS[invitee.status] || {}).label || invitee.status,
    MENU_LABELS[invitee.menuPreference] || '',
    invitee.guestCount || 0,
    `${location.origin}/i/${invitee.id}`,
    invitee.createdAt,
    invitee.updatedAt,
  ]);
  return [header, ...rows].map((row) => row.map(toCsvField).join(',')).join('\r\n');
}

exportBtn.addEventListener('click', () => {
  const csv = buildInviteesCsv(currentInvitees);
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'invitados.csv';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
});

inviteesBody.addEventListener('click', async (event) => {
  const button = event.target.closest('.copy-btn');
  if (!button) return;
  await navigator.clipboard.writeText(button.dataset.link);
  const icon = button.querySelector('i');
  icon.className = 'fi fi-rr-check';
  setTimeout(() => {
    icon.className = 'fi fi-rr-copy';
  }, 1200);
});

if (getToken()) {
  loadInvitees().then(showPanel).catch(() => {});
} else {
  showLogin();
}
