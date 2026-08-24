import { MENU_LABELS, MENU_ICONS } from './constants.js'
import { downloadInviteCalendar } from './invite-calendar.js'

const content = document.getElementById('rsvpContent')
const greeting = document.getElementById('inviteeGreeting')
const rsvpBox = document.getElementById('rsvpBox')
const rsvpTitle = document.getElementById('rsvpTitle')
const stamp = document.getElementById('rsvpStamp')

const MAX_GUESTS = 4
const MENU_VALUES = Object.keys(MENU_LABELS)

const STATUS_LABELS = {
  pending: 'PENDIENTE',
  confirmed: 'CONFIRMADO',
  cancelled: 'CANCELADO'
}

const STATUS_FLASH_COLOR = {
  confirmed: 'rgba(57, 255, 106, 0.55)',
  cancelled: 'rgba(255, 46, 77, 0.5)'
}

const CONFETTI_SYMBOLS = ['*', '#', '+', '01', '10', '>_']

function setRsvpStatus(status) {
  rsvpBox.dataset.status = status
  stamp.textContent = STATUS_LABELS[status]
  stamp.hidden = false
  stamp.getAnimations().forEach(anim => anim.cancel())
  stamp.animate(
    [
      { transform: 'rotate(-8deg) scale(2.2)', opacity: 0 },
      { transform: 'rotate(-8deg) scale(1)', opacity: 1 }
    ],
    {
      duration: 380,
      easing: 'cubic-bezier(.34, 1.56, .64, 1)',
      fill: 'backwards'
    }
  )
}

function flashRsvpBox(status) {
  const overlay = document.createElement('div')
  overlay.className = 'rsvp-flash'
  overlay.style.backgroundColor = STATUS_FLASH_COLOR[status] || 'transparent'
  rsvpBox.appendChild(overlay)
  overlay
    .animate([{ opacity: 1 }, { opacity: 0 }], {
      duration: 700,
      easing: 'ease-out'
    })
    .finished.catch(() => {})
    .finally(() => overlay.remove())
}

function burstConfetti() {
  for (let i = 0; i < 16; i++) {
    const piece = document.createElement('span')
    piece.className = 'rsvp-confetti-piece'
    piece.textContent =
      CONFETTI_SYMBOLS[Math.floor(Math.random() * CONFETTI_SYMBOLS.length)]
    rsvpBox.appendChild(piece)

    const angle = Math.random() * Math.PI * 2
    const distance = 60 + Math.random() * 80
    const x = Math.cos(angle) * distance
    const y = Math.sin(angle) * distance - 20
    const rotate = Math.round(Math.random() * 360)

    piece
      .animate(
        [
          {
            transform: 'translate(-50%, -50%) rotate(0deg) scale(0.6)',
            opacity: 1
          },
          {
            transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px)) rotate(${rotate}deg) scale(1)`,
            opacity: 0
          }
        ],
        {
          duration: 700 + Math.random() * 300,
          easing: 'cubic-bezier(.2, .8, .3, 1)',
          fill: 'forwards'
        }
      )
      .finished.catch(() => {})
      .finally(() => piece.remove())
  }
}

function personLabel(index) {
  return index === 0 ? 'Vos' : `Acompañante ${index}`
}

function menuOwnershipLabel(index) {
  return index === 0 ? 'Tuyo' : `Acompañante ${index}`
}

function guestSummaryText(count) {
  if (count === 0) return 'Vos solo'
  return `Vos y ${count} acompañante${count === 1 ? '' : 's'}`
}

// Renders the "how many people + menu per person" control described as:
// 5 keyboard-key style boxes (0-4) that fill with a person icon left-to-right
// as the count grows, a disabled "Menu?" button under each box that unlocks
// once that slot is occupied, and a menu panel that drops in below the row
// with a yellow connector linking it back to whichever person is active.
function buildPeoplePicker({
  guestCount = null,
  menuPreferences = [],
  onChange
} = {}) {
  let selectedCount = Number.isInteger(guestCount)
    ? Math.min(Math.max(guestCount, 0), MAX_GUESTS)
    : null
  let menuPrefs = Array.isArray(menuPreferences)
    ? menuPreferences.slice(0, MAX_GUESTS + 1)
    : []
  let activePerson = null

  const wrap = document.createElement('div')
  wrap.className = 'people-picker'

  const keyRow = document.createElement('div')
  keyRow.className = 'picker-row key-row'
  const menuBtnRow = document.createElement('div')
  menuBtnRow.className = 'picker-row menu-btn-row'
  const linkRow = document.createElement('div')
  linkRow.className = 'picker-row link-row'
  const panelSlot = document.createElement('div')
  panelSlot.className = 'menu-panel-slot'

  const summaryEl = document.createElement('p')
  summaryEl.className = 'picker-summary'
  summaryEl.hidden = true

  const keyBoxes = []
  const menuBtns = []
  const linkEls = []

  for (let i = 0; i <= MAX_GUESTS; i++) {
    const box = document.createElement('button')
    box.type = 'button'
    box.className = 'key-box'
    box.setAttribute('aria-label', `${i} acompañante${i === 1 ? '' : 's'}`)
    box.innerHTML = `<i class="fi fi-rr-user person-icon"></i><span class="key-num">${i}</span>`
    box.addEventListener('click', () => selectCount(i))
    keyRow.appendChild(box)
    keyBoxes.push(box)

    const mbtn = document.createElement('button')
    mbtn.type = 'button'
    mbtn.className = 'menu-toggle-btn'
    mbtn.textContent = 'Menu?'
    mbtn.disabled = true
    mbtn.addEventListener('click', () => toggleMenuFor(i))
    menuBtnRow.appendChild(mbtn)
    menuBtns.push(mbtn)

    const link = document.createElement('span')
    link.className = 'link-connector'
    linkRow.appendChild(link)
    linkEls.push(link)
  }

  wrap.append(keyRow, menuBtnRow, linkRow, panelSlot, summaryEl)

  function selectCount(n) {
    selectedCount = n
    if (activePerson !== null && activePerson > n) {
      activePerson = null
    }
    menuPrefs = menuPrefs.slice(0, n + 1)
    render()
    renderPanel()
  }

  function toggleMenuFor(i) {
    if (selectedCount === null || i > selectedCount) return
    activePerson = activePerson === i ? null : i
    renderPanel()
    render()
  }

  function chooseMenu(i, value) {
    menuPrefs[i] = value
    renderPanel()
    render()
  }

  function renderPanel() {
    panelSlot.innerHTML = ''
    if (activePerson === null) return
    const i = activePerson

    const panel = document.createElement('div')
    panel.className = 'menu-panel'

    const label = document.createElement('div')
    label.className = 'menu-panel-label'
    label.textContent = `Menú ${menuOwnershipLabel(i)}`
    panel.appendChild(label)

    const optRow = document.createElement('div')
    optRow.className = 'menu-opt-row'
    MENU_VALUES.forEach(value => {
      const b = document.createElement('button')
      b.type = 'button'
      b.className = 'menu-opt-btn'
      if (menuPrefs[i] === value) b.classList.add('selected')
      b.innerHTML = `<i class="fi ${MENU_ICONS[value]}"></i><span>${MENU_LABELS[value]}</span>`
      b.addEventListener('click', () => chooseMenu(i, value))
      optRow.appendChild(b)
    })
    panel.appendChild(optRow)
    panelSlot.appendChild(panel)
  }

  function render() {
    keyBoxes.forEach((box, i) => {
      const filled = selectedCount !== null && i <= selectedCount
      box.classList.toggle('filled', filled)
      box.classList.toggle('selected', i === selectedCount)
      box.classList.toggle('link-active', i === activePerson)
    })
    menuBtns.forEach((btn, i) => {
      const enabled = selectedCount !== null && i <= selectedCount
      const pref = menuPrefs[i]
      const validPref = MENU_VALUES.includes(pref)
      btn.disabled = !enabled
      btn.classList.toggle('done', validPref)
      btn.classList.toggle('link-active', i === activePerson)
      btn.innerHTML = validPref
        ? `<i class="fi ${MENU_ICONS[pref]}"></i>`
        : 'Menu?'
      btn.setAttribute(
        'aria-label',
        validPref
          ? `Menú ${menuOwnershipLabel(i)}: ${MENU_LABELS[pref]}`
          : `Elegir menú para ${personLabel(i)}`
      )
    })
    linkEls.forEach((link, i) => {
      link.classList.toggle('link-active', i === activePerson)
    })
    panelSlot.classList.toggle('link-active', activePerson !== null)

    summaryEl.hidden = selectedCount === null
    summaryEl.textContent =
      selectedCount === null ? '' : guestSummaryText(selectedCount)

    if (onChange) {
      onChange({
        ...computeStatus(),
        value: {
          guestCount: selectedCount,
          menuPreferences: menuPrefs.slice(0, (selectedCount ?? -1) + 1)
        }
      })
    }
  }

  function computeStatus() {
    if (selectedCount === null) {
      return { complete: false, message: 'Elegí cuántas personas vienen.' }
    }
    const missingIndexes = []
    for (let i = 0; i <= selectedCount; i++) {
      if (!MENU_VALUES.includes(menuPrefs[i])) missingIndexes.push(i)
    }
    if (missingIndexes.length) {
      const missesSelf = missingIndexes.includes(0)
      const otherNames = missingIndexes
        .filter(i => i !== 0)
        .map(personLabel)

      let message
      if (missesSelf && otherNames.length) {
        message = `Falta elegir tu menú y el de: ${otherNames.join(', ')}.`
      } else if (missesSelf) {
        message = 'Falta elegir tu menú.'
      } else {
        message = `Falta elegir el menú de: ${otherNames.join(', ')}.`
      }
      return { complete: false, message }
    }
    return { complete: true, message: '' }
  }

  render()
  renderPanel()

  return {
    el: wrap,
    getValue() {
      return {
        guestCount: selectedCount,
        menuPreferences: menuPrefs.slice(0, (selectedCount ?? -1) + 1)
      }
    }
  }
}

function showGreeting(name) {
  greeting.textContent = `¡Hola ${name}!`
  greeting.hidden = false
}

function announceInvitee(name) {
  // Cached so matrix.js can read it even if it resolves before that
  // listener attaches (e.g. the synchronous no-guid path).
  window.__inviteeName = name
  document.dispatchEvent(new CustomEvent('invitee:ready', { detail: { name } }))
}

// No invitee to walk through steps for, so hide the wizard/dots/nav entirely
// and pull the RSVP box out of the (now hidden) wizard to stand on its own.
// The banner stays visible.
function showRsvpOnly() {
  document.getElementById('stepDots').hidden = true
  document.querySelector('.step-wizard').hidden = true
  document.querySelector('.term-nav').hidden = true
  // welcome.js reveals it (with a delay after the banner) once the boot
  // sequence finishes, instead of popping in immediately.
  rsvpBox.classList.add('reveal-hidden')
  document.querySelector('.term-content').appendChild(rsvpBox)
}

function renderNoGuid() {
  rsvpTitle.textContent = 'ERROR: Invitación requerida'
  rsvpBox.dataset.status = 'error'
  content.innerHTML = `
    <p class="rsvp-message">Esta invitación es personal. Pedile tu link a Bert para confirmar tu asistencia.</p>
  `
  showRsvpOnly()
}

function renderNotFound() {
  content.innerHTML = `
    <p class="rsvp-message">No encontramos tu invitación. Consultá con Bert por tu link.</p>
  `
}

function renderError() {
  content.innerHTML = `
    <p class="rsvp-message">No pudimos cargar tu invitación. Intentá de nuevo en un rato.</p>
  `
}

function attachPicker(invitee, submitBtn, downloadBtn) {
  const pickerHost = document.getElementById('peoplePickerHost')
  const hintEl = document.getElementById('confirmHint')

  const initialGuestCount = Number.isInteger(invitee.guestCount)
    ? invitee.guestCount
    : null
  const initialMenuPreferences =
    invitee.menuPreferences ||
    (invitee.menuPreference ? [invitee.menuPreference] : [])
  const savedSnapshot = JSON.stringify({
    guestCount: initialGuestCount,
    menuPreferences: initialMenuPreferences
  })

  const picker = buildPeoplePicker({
    guestCount: initialGuestCount,
    menuPreferences: initialMenuPreferences,
    onChange({ complete, message, value }) {
      const unsaved = JSON.stringify(value) !== savedSnapshot

      // While there are unsaved edits, swap the PDF download out for the
      // save action — the PDF should only reflect what's actually saved.
      if (downloadBtn) {
        downloadBtn.hidden = unsaved
        submitBtn.hidden = !unsaved
      }

      submitBtn.disabled = !complete

      if (!complete) {
        hintEl.className = 'confirm-hint'
        hintEl.innerHTML = `<i class="fi fi-rr-info"></i><span>${message}</span>`
        hintEl.hidden = false
        return
      }

      hintEl.className = unsaved ? 'confirm-hint confirm-hint-unsaved' : 'confirm-hint'
      hintEl.innerHTML = unsaved
        ? '<i class="fi fi-rr-floppy-disk-pen"></i><span>Tenés cambios sin guardar.</span>'
        : ''
      hintEl.hidden = !unsaved
    }
  })
  pickerHost.appendChild(picker.el)
  return picker
}

function renderPending(invitee, guid, { flash = false } = {}) {
  const status = invitee.status === 'cancelled' ? 'cancelled' : 'pending'
  setRsvpStatus(status)
  if (flash) flashRsvpBox(status)

  const declinedBadge =
    status === 'cancelled'
      ? '<div class="rsvp-declined-badge"><i class="fi fi-rr-cross-circle"></i> AVISASTE QUE NO PODÉS VENIR</div>'
      : ''

  content.innerHTML = `
    ${declinedBadge}
    <div class="form-group">
      <label>¿Cuántas personas vienen, vos incluído/a?</label>
      <div id="peoplePickerHost"></div>
    </div>
    <button type="button" class="btn-submit" id="confirmBtn" disabled>CONFIRMAR ASISTENCIA</button>
    <button type="button" class="btn-cancel" id="declineBtn">NO PUEDO ASISTIR</button>
    <div class="confirm-hint" id="confirmHint"></div>
    <div class="rsvp-message" id="actionError"></div>
  `

  const confirmBtn = document.getElementById('confirmBtn')
  const declineBtn = document.getElementById('declineBtn')
  const picker = attachPicker(invitee, confirmBtn)

  confirmBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError')
    errorEl.textContent = ''

    const { guestCount, menuPreferences } = picker.getValue()

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', menuPreferences, guestCount })
      })

      if (!response.ok) {
        errorEl.textContent =
          'No pudimos confirmar tu asistencia. Probá de nuevo.'
        return
      }

      const updated = await response.json()
      renderConfirmed(updated, guid, { flash: true, confetti: true })
    } catch {
      errorEl.textContent =
        'No pudimos confirmar tu asistencia. Probá de nuevo.'
    }
  })

  declineBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError')
    errorEl.textContent = ''
    declineBtn.disabled = true

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      if (!response.ok) {
        errorEl.textContent = 'No pudimos guardar tu respuesta. Probá de nuevo.'
        declineBtn.disabled = false
        return
      }

      const updated = await response.json()
      renderPending(updated, guid, { flash: true })
    } catch {
      errorEl.textContent = 'No pudimos guardar tu respuesta. Probá de nuevo.'
      declineBtn.disabled = false
    }
  })
}

function renderConfirmed(
  invitee,
  guid,
  { flash = false, confetti = false } = {}
) {
  setRsvpStatus('confirmed')
  if (flash) flashRsvpBox('confirmed')
  if (confetti) burstConfetti()

  content.innerHTML = `
    <div class="rsvp-confirmed-badge"><i class="fi fi-rr-check-circle"></i> ¡CONFIRMASTE TU ASISTENCIA!</div>
    <div class="form-group">
      <label>¿Cuántas personas vienen, vos incluído/a?</label>
      <div id="peoplePickerHost"></div>
    </div>
    <button type="button" class="btn-submit" id="downloadPdfBtn"><i class="fi fi-rr-file-pdf"></i> DESCARGAR PDF</button>
    <button type="button" class="btn-submit" id="addToCalendarBtn"><i class="fi fi-rr-calendar-arrow-down"></i> AGREGAR AL CALENDARIO</button>
    <button type="button" class="btn-submit" id="updateBtn" disabled hidden>ACTUALIZAR DATOS</button>
    <button type="button" class="btn-cancel" id="cancelBtn">CANCELAR ASISTENCIA</button>
    <div class="confirm-hint" id="confirmHint"></div>
    <div class="rsvp-message" id="actionError"></div>
  `

  const downloadPdfBtn = document.getElementById('downloadPdfBtn')
  downloadPdfBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError')
    errorEl.textContent = ''
    downloadPdfBtn.disabled = true

    try {
      // Lazy-loaded: jsPDF/qrcode are heavy and most visitors never click this.
      const { downloadInvitePdf } = await import('./invite-pdf.js')
      await downloadInvitePdf(invitee)
    } catch {
      errorEl.textContent = 'No pudimos generar el PDF. Probá de nuevo.'
    } finally {
      downloadPdfBtn.disabled = false
    }
  })

  document
    .getElementById('addToCalendarBtn')
    .addEventListener('click', downloadInviteCalendar)

  const updateBtn = document.getElementById('updateBtn')
  const picker = attachPicker(invitee, updateBtn, downloadPdfBtn)

  updateBtn.addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError')
    errorEl.textContent = ''

    const { guestCount, menuPreferences } = picker.getValue()

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'confirm', menuPreferences, guestCount })
      })

      if (!response.ok) {
        errorEl.textContent = 'No pudimos actualizar tus datos. Probá de nuevo.'
        return
      }

      const updated = await response.json()
      renderConfirmed(updated, guid, { flash: true })
      const successEl = document.getElementById('actionError')
      successEl.textContent = 'Datos actualizados.'
    } catch {
      errorEl.textContent = 'No pudimos actualizar tus datos. Probá de nuevo.'
    }
  })

  document.getElementById('cancelBtn').addEventListener('click', async () => {
    const errorEl = document.getElementById('actionError')
    errorEl.textContent = ''

    try {
      const response = await fetch(`/api/rsvp/${guid}`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ action: 'cancel' })
      })

      if (!response.ok) {
        errorEl.textContent =
          'No pudimos cancelar tu asistencia. Probá de nuevo.'
        return
      }

      const updated = await response.json()
      renderPending(updated, guid, { flash: true })
    } catch {
      errorEl.textContent = 'No pudimos cancelar tu asistencia. Probá de nuevo.'
    }
  })
}

function getGuidFromUrl() {
  const pathMatch = location.pathname.match(/^\/i\/([^/]+)\/?$/)
  if (pathMatch) return pathMatch[1]
  return new URLSearchParams(location.search).get('guid')
}

async function init() {
  const guid = getGuidFromUrl()

  if (!guid) {
    renderNoGuid()
    announceInvitee(null)
    return
  }

  try {
    const response = await fetch(`/api/rsvp/${guid}`)

    if (response.status === 404) {
      renderNotFound()
      announceInvitee(null)
      return
    }

    if (!response.ok) {
      renderError()
      announceInvitee(null)
      return
    }

    const invitee = await response.json()
    showGreeting(invitee.name)
    announceInvitee(invitee.name)

    if (invitee.status === 'confirmed') {
      renderConfirmed(invitee, guid)
    } else {
      renderPending(invitee, guid)
    }
  } catch {
    renderError()
    announceInvitee(null)
  }
}

init()
