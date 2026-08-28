import { MENU_LABELS, MENU_ICONS } from './constants.js'
import {
  browserSupportsWebAuthn,
  startRegistration,
  startAuthentication
} from '@simplewebauthn/browser'

const TOKEN_KEY = 'adminToken'

const loginView = document.getElementById('loginView')
const panelView = document.getElementById('panelView')
const passwordInput = document.getElementById('passwordInput')
const loginBtn = document.getElementById('loginBtn')
const loginError = document.getElementById('loginError')
const passkeyLoginBtn = document.getElementById('passkeyLoginBtn')
const passkeyBtn = document.getElementById('passkeyBtn')
const passkeyBtnLabel = document.getElementById('passkeyBtnLabel')
const logoutBtn = document.getElementById('logoutBtn')
const passkeyError = document.getElementById('passkeyError')
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

const navInvitados = document.getElementById('navInvitados')
const navControl = document.getElementById('navControl')
const invitadosSection = document.getElementById('invitadosSection')
const controlSection = document.getElementById('controlSection')
const controlToolbarInactive = document.getElementById('controlToolbarInactive')
const controlToolbarActive = document.getElementById('controlToolbarActive')
const startControlBtn = document.getElementById('startControlBtn')
const prevMediaBtn = document.getElementById('prevMediaBtn')
const nextMediaBtn = document.getElementById('nextMediaBtn')
const showMediaBtn = document.getElementById('showMediaBtn')
const disconnectBtn = document.getElementById('disconnectBtn')
const controlError = document.getElementById('controlError')
const controlPreview = document.getElementById('controlPreview')
const controlPreviewMedia = document.getElementById('controlPreviewMedia')
const controlPreviewName = document.getElementById('controlPreviewName')
const controlPreviewDesc = document.getElementById('controlPreviewDesc')
const mediaList = document.getElementById('mediaList')
const mediaEmptyMsg = document.getElementById('mediaEmptyMsg')

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

let mediaItems = []
let controlActive = false
let shownIndex = null
let cursorIndex = null
let controlLoaded = false

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
  const nameOk = !nameQuery || invitee.name.toLowerCase().includes(nameQuery)
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

  const noFilters =
    activeStatusFilters.size === 0 && activeMenuFilters.size === 0
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
          sum +
          (invitee.menuPreferences || []).filter(pref => pref === value).length,
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

function showSection(name) {
  invitadosSection.hidden = name !== 'invitados'
  controlSection.hidden = name !== 'control'
  navInvitados.classList.toggle('active', name === 'invitados')
  navControl.classList.toggle('active', name === 'control')

  if (name === 'control' && !controlLoaded) {
    controlLoaded = true
    loadControl()
  }
}

async function loadControl() {
  controlError.textContent = ''
  try {
    const response = await apiFetch('/api/control')
    if (!response.ok) return
    const data = await response.json()

    mediaItems = (data.items || []).slice().sort((a, b) => a.index - b.index)
    controlActive = Boolean(data.active)
    shownIndex = data.active ? (data.index ?? null) : null
    cursorIndex = mediaItems.length ? (shownIndex ?? mediaItems[0].index) : null

    renderControl()
  } catch {
    // unauthorized already handled
  }
}

function findMediaByIndex(index) {
  return mediaItems.find(item => item.index === index) || null
}

function renderMediaPreview(item) {
  if (!item) {
    controlPreviewMedia.innerHTML = ''
    return
  }
  controlPreviewMedia.innerHTML =
    item.type === 'video'
      ? `<video src="${escapeHtml(item.url)}" controls muted playsinline></video>`
      : `<img src="${escapeHtml(item.url)}" alt="${escapeHtml(item.name || item.filename)}" />`
}

function renderControl() {
  controlToolbarInactive.hidden = controlActive
  controlToolbarActive.hidden = !controlActive

  // Starting a session works with no media (useful on its own, e.g. for
  // testing the takeover screen) — only Show requires a real item to exist.
  mediaEmptyMsg.hidden = mediaItems.length > 0

  const cursorItem = cursorIndex === null ? null : findMediaByIndex(cursorIndex)
  controlPreview.hidden = !cursorItem
  if (cursorItem) {
    renderMediaPreview(cursorItem)
    controlPreviewName.textContent = cursorItem.name || cursorItem.filename
    controlPreviewDesc.textContent = cursorItem.desc || ''
  }

  prevMediaBtn.disabled = !cursorItem || cursorIndex === mediaItems[0]?.index
  nextMediaBtn.disabled =
    !cursorItem || cursorIndex === mediaItems[mediaItems.length - 1]?.index
  showMediaBtn.disabled = !cursorItem || cursorIndex === shownIndex

  mediaList.innerHTML = mediaItems
    .map(item => {
      const isCursor = item.index === cursorIndex
      const isShown = controlActive && item.index === shownIndex
      const label = escapeHtml(item.name || item.filename)
      const shownBadge = isShown
        ? ' <i class="fi fi-rr-screencast" title="En pantalla"></i>'
        : ''
      return `
        <li class="media-list-item${isCursor ? ' current' : ''}" data-index="${item.index}">
          <span class="media-list-index">${item.index}</span>
          <span class="media-list-name">${label}${shownBadge}</span>
          <span class="media-list-desc">${escapeHtml(item.desc || '')}</span>
        </li>
      `
    })
    .join('')

  const currentEl = mediaList.querySelector('.media-list-item.current')
  if (currentEl) mediaList.scrollTop = currentEl.offsetTop
}

mediaList.addEventListener('click', event => {
  const li = event.target.closest('.media-list-item')
  if (!li) return
  cursorIndex = Number(li.dataset.index)
  renderControl()
})

navInvitados.addEventListener('click', () => showSection('invitados'))
navControl.addEventListener('click', () => showSection('control'))

startControlBtn.addEventListener('click', async () => {
  controlError.textContent = ''
  try {
    const response = await apiFetch('/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'start' })
    })
    if (!response.ok) {
      controlError.textContent = 'No se pudo iniciar el control.'
      return
    }
    const data = await response.json()
    mediaItems = (data.items || []).slice().sort((a, b) => a.index - b.index)
    controlActive = true
    shownIndex = null
    if (!mediaItems.some(item => item.index === cursorIndex)) {
      cursorIndex = mediaItems.length ? mediaItems[0].index : null
    }
    renderControl()
  } catch {
    // unauthorized already handled
  }
})

disconnectBtn.addEventListener('click', async () => {
  if (
    !confirm(
      'Esto va a devolver a todos los que están viendo el control a la pantalla normal del sitio. ¿Continuar?'
    )
  ) {
    return
  }
  controlError.textContent = ''
  try {
    const response = await apiFetch('/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'end' })
    })
    if (!response.ok) {
      controlError.textContent = 'No se pudo desconectar el control.'
      return
    }
    controlActive = false
    shownIndex = null
    renderControl()
  } catch {
    // unauthorized already handled
  }
})

prevMediaBtn.addEventListener('click', () => {
  const i = mediaItems.findIndex(item => item.index === cursorIndex)
  if (i > 0) {
    cursorIndex = mediaItems[i - 1].index
    renderControl()
  }
})

nextMediaBtn.addEventListener('click', () => {
  const i = mediaItems.findIndex(item => item.index === cursorIndex)
  if (i !== -1 && i < mediaItems.length - 1) {
    cursorIndex = mediaItems[i + 1].index
    renderControl()
  }
})

showMediaBtn.addEventListener('click', async () => {
  if (cursorIndex === null) return
  controlError.textContent = ''
  try {
    const response = await apiFetch('/api/control', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'show', index: cursorIndex })
    })
    if (!response.ok) {
      controlError.textContent = 'No se pudo mostrar este ítem.'
      return
    }
    const data = await response.json()
    shownIndex = data.index ?? null
    renderControl()
  } catch {
    // unauthorized already handled
  }
})

async function loadInvitees() {
  const response = await apiFetch('/api/invitees')
  if (!response.ok) return
  currentInvitees = await response.json()
  renderAll()
}

async function onLoginSuccess(token) {
  setToken(token)
  try {
    await Promise.all([loadInvitees(), loadPasskeys()])
    showPanel()
  } catch {
    // showLogin already triggered by apiFetch on 401
  }
}

async function tryLogin(password) {
  await onLoginSuccess(password)
}

loginBtn.addEventListener('click', () => {
  const password = passwordInput.value.trim()
  if (!password) return
  tryLogin(password)
})

passwordInput.addEventListener('keydown', event => {
  if (event.key === 'Enter') loginBtn.click()
})

let currentPasskey = null

function renderPasskeyBtn(credential) {
  currentPasskey = credential
  passkeyBtn.classList.toggle('registered', Boolean(credential))
  passkeyBtnLabel.textContent = credential
    ? `Quitar passkey`
    : 'Agregar passkey'
}

async function loadPasskeys() {
  try {
    const response = await apiFetch('/api/passkey')
    if (!response.ok) return
    const data = await response.json()
    renderPasskeyBtn(data.credential)
  } catch {
    // unauthorized already handled
  }
}

async function registerPasskey() {
  passkeyError.textContent = ''
  const label = prompt('Nombre para esta passkey (ej: iPhone de Bert)', '')
  if (label === null) return // user cancelled the prompt

  try {
    const optionsResponse = await apiFetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'register-options' })
    })
    if (!optionsResponse.ok) {
      passkeyError.textContent = 'No se pudo iniciar el registro de la passkey.'
      return
    }
    const optionsJSON = await optionsResponse.json()

    const attestation = await startRegistration({ optionsJSON })

    const verifyResponse = await apiFetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        action: 'register-verify',
        response: attestation,
        label
      })
    })
    if (!verifyResponse.ok) {
      const data = await verifyResponse.json().catch(() => ({}))
      passkeyError.textContent =
        data.error || 'No se pudo registrar la passkey.'
      return
    }
    const data = await verifyResponse.json()
    renderPasskeyBtn(data.credential)
  } catch (err) {
    if (err?.name === 'NotAllowedError') return // user cancelled, no error needed
    passkeyError.textContent = 'No se pudo registrar la passkey.'
  }
}

async function removePasskey() {
  if (
    !confirm(
      '¿Quitar la passkey registrada? Vas a poder volver a entrar con la contraseña.'
    )
  ) {
    return
  }
  passkeyError.textContent = ''
  try {
    const response = await apiFetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'remove' })
    })
    if (!response.ok) return
    const data = await response.json()
    renderPasskeyBtn(data.credential)
  } catch {
    // unauthorized already handled
  }
}

async function tryPasskeyLogin() {
  loginError.textContent = ''
  try {
    const optionsResponse = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'auth-options' })
    })
    if (!optionsResponse.ok) {
      const data = await optionsResponse.json().catch(() => ({}))
      loginError.textContent =
        data.error || 'No se pudo iniciar sesión con passkey.'
      return
    }
    const optionsJSON = await optionsResponse.json()

    const assertion = await startAuthentication({ optionsJSON })

    const verifyResponse = await fetch('/api/passkey', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ action: 'auth-verify', response: assertion })
    })
    if (!verifyResponse.ok) {
      const data = await verifyResponse.json().catch(() => ({}))
      loginError.textContent =
        data.error || 'No se pudo iniciar sesión con passkey.'
      return
    }
    const { token } = await verifyResponse.json()
    await onLoginSuccess(token)
  } catch (err) {
    if (err?.name === 'NotAllowedError') return // user cancelled, no error needed
    loginError.textContent = 'No se pudo iniciar sesión con passkey.'
  }
}

passkeyLoginBtn.addEventListener('click', tryPasskeyLogin)
passkeyBtn.addEventListener('click', () => {
  if (currentPasskey) removePasskey()
  else registerPasskey()
})

logoutBtn.addEventListener('click', () => {
  clearToken()
  showLogin()
})

if (browserSupportsWebAuthn()) {
  passkeyBtn.hidden = false
  // Only offer "log in with passkey" once we know at least one is
  // registered — otherwise it would just fail with a confusing error.
  fetch('/api/passkey', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ action: 'has-credentials' })
  })
    .then(response => response.json())
    .then(data => {
      passkeyLoginBtn.hidden = !data.hasCredentials
    })
    .catch(() => {})
}

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
    (invitee.menuPreferences || [])
      .map(pref => MENU_LABELS[pref] || pref)
      .join(' / '),
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
    if (!confirm(`¿Eliminar la invitación de ${name}? No se puede deshacer.`))
      return

    try {
      const response = await apiFetch(`/api/invitees/${id}`, {
        method: 'DELETE'
      })
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

showSection('invitados')

if (getToken()) {
  Promise.all([loadInvitees(), loadPasskeys()])
    .then(showPanel)
    .catch(() => {})
} else {
  showLogin()
}

window.addEventListener('beforeunload', event => {
  if (!controlActive) return
  event.preventDefault()
  event.returnValue = ''
})
