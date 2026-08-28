import { resolveLine, waitForInviteeName, typeText, stopMatrixSequence } from './matrix.js'

const POLL_INTERVAL_MS = 2000
const TAKEOVER_LINE = 'The Matrix has you {name}...'

const terminalEl = document.querySelector('.terminal')
const controlView = document.getElementById('controlView')
const controlViewText = document.getElementById('controlViewText')
const controlViewMedia = document.getElementById('controlViewMedia')
const controlViewMediaInner = document.getElementById('controlViewMediaInner')
const controlViewName = document.getElementById('controlViewName')

let isActive = false
let currentMediaIndex = null
let takeoverLinePromise = null
let takeoverTyped = false

function enterControlMode() {
  if (isActive) return
  isActive = true
  stopMatrixSequence() // don't let the boot sequence keep typing/clicking underneath
  controlView.hidden = false
  controlView.setAttribute('aria-hidden', 'false')
  if (terminalEl) terminalEl.inert = true
}

function exitControlMode() {
  if (!isActive) return
  // Simplest safe reset: whatever the visitor was doing (RSVP flow, wizard
  // step, unsaved picker state) may be stale after a control session — a
  // fresh load is more reliable than trying to restore prior UI state.
  location.reload()
}

async function showTakeoverText() {
  controlViewText.hidden = false
  controlViewMedia.hidden = true

  if (takeoverTyped) return // already typed out — don't retype on every poll

  if (!takeoverLinePromise) {
    takeoverLinePromise = waitForInviteeName().then(name =>
      resolveLine(TAKEOVER_LINE, name)
    )
  }
  const line = await takeoverLinePromise
  if (takeoverTyped) return // a later poll finished typing first — don't clobber it
  takeoverTyped = true
  await typeText(controlViewText, line)
}

function showMediaItem(item) {
  controlViewText.hidden = true
  controlViewMedia.hidden = false
  controlViewName.textContent = item.name || ''

  controlViewMediaInner.innerHTML = ''
  const el = document.createElement(item.type === 'video' ? 'video' : 'img')
  el.src = item.url
  if (item.type === 'video') {
    el.autoplay = true
    el.muted = true
    el.playsInline = true
    el.loop = true
  } else {
    el.alt = item.name || ''
  }
  controlViewMediaInner.appendChild(el)
}

async function applyState(state) {
  if (!state.active) {
    exitControlMode()
    return
  }

  enterControlMode()

  const index = state.index ?? null
  if (index === null) {
    currentMediaIndex = null
    await showTakeoverText()
    return
  }

  if (index !== currentMediaIndex) {
    currentMediaIndex = index
    showMediaItem(state)
  }
}

async function poll() {
  try {
    const response = await fetch('/api/control')
    if (response.ok) {
      await applyState(await response.json())
    }
  } catch {
    // Network hiccup — the next tick will retry.
  }
}

if (controlView) {
  poll()
  setInterval(poll, POLL_INTERVAL_MS)
}
