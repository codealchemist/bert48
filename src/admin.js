import { MENU_LABELS, MENU_ICONS } from './constants.js'

const TOKEN_KEY = 'adminToken'

const loginView = document.getElementById('loginView')
const panelView = document.getElementById('panelView')
const passwordInput = document.getElementById('passwordInput')
const loginBtn = document.getElementById('loginBtn')
const loginError = document.getElementById('loginError')
const createForm = document.getElementById('createForm')
const nameInput = document.getElementById('nameInput')
const createError = document.getElementById('createError')
const inviteesBody = document.getElementById('inviteesBody')
const emptyMsg = document.getElementById('emptyMsg')
const totalPeopleValue = document.getElementById('totalPeopleValue')
const statTotal = document.getElementById('statTotal')
const statPending = document.getElementById('statPending')
const statConfirmed = document.getElementById('statConfirmed')
const statCancelled = document.getElementById('statCancelled')
const menuBreakdown = document.getElementById('menuBreakdown')
const exportBtn = document.getElementById('exportBtn')
const nameFilterInput = document.getElementById('nameFilterInput')
const statusFilterButtons = document.querySelectorAll(
  '.stat-filter[data-filter^="status:"]'
)

const STATUS_LABELS = {
  pending: {
    label: 'Pendiente',
    icon: 'fi-rr-clock',
    className: 'status-pending'
  },
  confirmed: {
    label: 'Confirmó',
    icon: 'fi-rr-check-circle',
    className: 'status-confirmed'
  },
  cancelled: {
    label: 'Canceló',
    icon: 'fi-rr-cross-circle',
    className: 'status-cancelled'
  }
}

let currentInvitees = []
let nameQuery = ''
const activeStatusFilters = new Set()
const activeMenuFilters = new Set()

function getToken() {
  return sessionStorage.getItem(TOKEN_KEY) || ''
}

function setToken(token) {
  sessionStorage.setItem(TOKEN_KEY, token)
}

function clearToken() {
  sessionStorage.removeItem(TOKEN_KEY)
}

async function apiFetch(path, options = {}) {
  const response = await fetch(path, {
    ...options,
    headers: {
      ...options.headers,
      Authorization: `Bearer ${getToken()}`
    }
  })

  if (response.status === 401) {
    clearToken()
    showLogin('La contraseña ya no es válida, ingresá de nuevo.')
    throw new Error('unauthorized')
  }

  return response
}

function showLogin(errorMessage = '') {
  loginView.hidden = false
  panelView.hidden = true
  loginError.textContent = errorMessage
}

function showPanel() {
  loginView.hidden = true
  panelView.hidden = false
}

function matchesFilters(invitee) {
  const statusOk =
    activeStatusFilters.size === 0 || activeStatusFilters.has(invitee.status)
  const menuOk =
    activeMenuFilters.size === 0 ||
    (invitee.menuPreferences || []).some(pref => activeMenuFilters.has(pref))
  const nameOk =
    !nameQuery || invitee.name.toLowerCase().includes(nameQuery)
  return statusOk && menuOk && nameOk
}

function renderAll() {
  renderSummary(currentInvitees)
  renderTable(currentInvitees.filter(matchesFilters))
}

function renderTable(invitees) {
  inviteesBody.innerHTML = ''
  emptyMsg.hidden = invitees.length > 0

  const sorted = [...invitees].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt)
  )

  for (const invitee of sorted) {
    const status = STATUS_LABELS[invitee.status] || STATUS_LABELS.pending
    const link = `${location.origin}/i/${invitee.id}`
    const guestCount = invitee.guestCount || 0
    const menuIcons = (invitee.menuPreferences || [])
      .map(
        pref =>
          `<i class="fi ${MENU_ICONS[pref] || 'fi-rr-question'}" title="${escapeHtml(MENU_LABELS[pref] || pref)}"></i>`
      )
      .join('')

    const row = document.createElement('tr')
    row.innerHTML = `
      <td>${escapeHtml(invitee.name)}</td>
      <td>
        <input
          type="text"
          class="alias-input"
          data-id="${invitee.id}"
          value="${escapeHtml(invitee.alias || '')}"
          placeholder="—"
          aria-label="Alias de ${escapeHtml(invitee.name)} (solo vos lo ves)"
        />
      </td>
      <td><span class="status-badge ${status.className}"><i class="fi ${status.icon}"></i> ${status.label}</span></td>
      <td>${guestCount}</td>
      <td><div class="menu-icons">${menuIcons || '<span class="menu-icons-empty">—</span>'}</div></td>
      <td>
        <div class="link-cell">
          <code>${escapeHtml(link)}</code>
          <button type="button" class="copy-btn" data-link="${escapeHtml(link)}"><i class="fi fi-rr-copy"></i></button>
        </div>
      </td>
      <td>
        <button type="button" class="delete-btn" data-id="${invitee.id}" data-name="${escapeHtml(invitee.name)}" aria-label="Eliminar invitado"><i class="fi fi-rr-trash"></i></button>
      </td>
    `
    inviteesBody.appendChild(row)
  }
}

function renderSummary(invitees) {
  const confirmedInvitees = invitees.filter(
    invitee => invitee.status === 'confirmed'
  )

  statTotal.textContent = invitees.length
  statPending.textContent = invitees.filter(
    invitee => invitee.status === 'pending'
  ).length
  statConfirmed.textContent = confirmedInvitees.length
  statCancelled.textContent = invitees.filter(
    invitee => invitee.status === 'cancelled'
  ).length

  const totalConfirmedPeople = confirmedInvitees.reduce(
    (sum, invitee) => sum + 1 + (invitee.guestCount || 0),
    0
  )
  totalPeopleValue.textContent = totalConfirmedPeople

  const noFilters = activeStatusFilters.size === 0 && activeMenuFilters.size === 0
  statusFilterButtons.forEach(btn => {
    const key = btn.dataset.filter
    const active =
      key === 'status:total' ? noFilters : activeStatusFilters.has(key.slice(7))
    btn.classList.toggle('active', active)
  })

  menuBreakdown.innerHTML = Object.entries(MENU_LABELS)
    .map(([value, label]) => {
      const count = confirmedInvitees.reduce(
        (sum, invitee) =>
          sum + (invitee.menuPreferences || []).filter(pref => pref === value).length,
        0
      )
      const active = activeMenuFilters.has(value)
      return `<button type="button" class="stat menu-stat stat-filter${active ? ' active' : ''}" data-filter="menu:${value}">
        <i class="fi ${MENU_ICONS[value]}"></i>
        <span class="stat-value">${count}</span>
        <span class="stat-label">${escapeHtml(label)}</span>
      </button>`
    })
    .join('')
}

function toggleFilter(key) {
  if (key === 'status:total') {
    activeStatusFilters.clear()
    activeMenuFilters.clear()
  } else if (key.startsWith('status:')) {
    const value = key.slice(7)
    if (activeStatusFilters.has(value)) activeStatusFilters.delete(value)
    else activeStatusFilters.add(value)
  } else if (key.startsWith('menu:')) {
    const value = key.slice(5)
    if (activeMenuFilters.has(value)) activeMenuFilters.delete(value)
    else activeMenuFilters.add(value)
  }
  renderAll()
}

function escapeHtml(value) {
  const div = document.createElement('div')
  div.textContent = value
  return div.innerHTML
}

async function loadInvitees() {
  const response = await apiFetch('/api/invitees')
  if (!response.ok) return
  currentInvitees = await response.json()
  renderAll()
}

async function tryLogin(password) {
  setToken(password)
  try {
    await loadInvitees()
    showPanel()
  } catch {
    // showLogin already triggered by apiFetch on 401
  }
}

loginBtn.addEventListener('click', () => {
  const password = passwordInput.value.trim()
  if (!password) return
  tryLogin(password)
})

passwordInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') loginBtn.click()
})

createForm.addEventListener('submit', async event => {
  event.preventDefault()
  createError.textContent = ''
  const name = nameInput.value.trim()
  if (!name) return

  try {
    const response = await apiFetch('/api/invitees', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ name })
    })

    if (!response.ok) {
      const data = await response.json().catch(() => ({}))
      createError.textContent = data.error || 'No se pudo crear la invitación.'
      return
    }

    nameInput.value = ''
    await loadInvitees()
  } catch {
    // unauthorized already handled
  }
})

function toCsvField(value) {
  const str = String(value ?? '')
  return /[",\n]/.test(str) ? `"${str.replace(/"/g, '""')}"` : str
}

function buildInviteesCsv(invitees) {
  const header = [
    'Nombre',
    'Alias',
    'Estado',
    'Preferencia de menú',
    'Acompañantes',
    'Link',
    'Creado',
    'Actualizado'
  ]
  const rows = invitees.map(invitee => [
    invitee.name,
    invitee.alias || '',
    (STATUS_LABELS[invitee.status] || {}).label || invitee.status,
    (invitee.menuPreferences || []).map(pref => MENU_LABELS[pref] || pref).join(' / '),
    invitee.guestCount || 0,
    `${location.origin}/i/${invitee.id}`,
    invitee.createdAt,
    invitee.updatedAt
  ])
  return [header, ...rows]
    .map(row => row.map(toCsvField).join(','))
    .join('\r\n')
}

exportBtn.addEventListener('click', () => {
  const csv = buildInviteesCsv(currentInvitees)
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = 'invitados.csv'
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
})

inviteesBody.addEventListener('click', async event => {
  const copyBtn = event.target.closest('.copy-btn')
  if (copyBtn) {
    await navigator.clipboard.writeText(copyBtn.dataset.link)
    const icon = copyBtn.querySelector('i')
    icon.className = 'fi fi-rr-check'
    setTimeout(() => {
      icon.className = 'fi fi-rr-copy'
    }, 1200)
    return
  }

  const deleteBtn = event.target.closest('.delete-btn')
  if (deleteBtn) {
    const { id, name } = deleteBtn.dataset
    if (!confirm(`¿Eliminar la invitación de ${name}? No se puede deshacer.`)) return

    try {
      const response = await apiFetch(`/api/invitees/${id}`, { method: 'DELETE' })
      if (!response.ok) return
      await loadInvitees()
    } catch {
      // unauthorized already handled
    }
  }
})

async function saveAlias(id, alias) {
  try {
    const response = await apiFetch(`/api/invitees/${id}`, {
      method: 'PATCH',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ alias })
    })
    if (!response.ok) return
    await loadInvitees()
  } catch {
    // unauthorized already handled
  }
}

inviteesBody.addEventListener('change', event => {
  const input = event.target.closest('.alias-input')
  if (!input) return
  saveAlias(input.dataset.id, input.value.trim())
})

inviteesBody.addEventListener('keydown', event => {
  if (event.key === 'Enter' && event.target.classList.contains('alias-input')) {
    event.target.blur()
  }
})

panelView.addEventListener('click', event => {
  const filterBtn = event.target.closest('.stat-filter')
  if (!filterBtn) return
  toggleFilter(filterBtn.dataset.filter)
})

nameFilterInput.addEventListener('input', () => {
  nameQuery = nameFilterInput.value.trim().toLowerCase()
  renderTable(currentInvitees.filter(matchesFilters))
})

if (getToken()) {
  loadInvitees()
    .then(showPanel)
    .catch(() => {})
} else {
  showLogin()
}
