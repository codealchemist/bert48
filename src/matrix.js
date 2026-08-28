const INVITEE_TIMEOUT_MS = 5000

// Rendered in order, each replacing the previous one in place. Use {name}
// as a placeholder for the invitee's name. Edit freely to add more lines.
const MATRIX_LINES = ['Wake up {name}...', 'Follow the white tiger.']

const overlay = document.getElementById('matrixView')
const textEl = document.getElementById('matrixText')

const CHAR_DELAY_MS = Number(overlay?.dataset.charDelay) || 90
const HOLD_DELAY_MS = Number(overlay?.dataset.holdDelay) || 1400

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

let audioCtx = null

function playKeySound() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return
  try {
    if (!audioCtx) audioCtx = new AudioCtx()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.type = 'square'
    osc.frequency.value = 1200 + Math.random() * 300
    gain.gain.setValueAtTime(0.025, audioCtx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.02)
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.start()
    osc.stop(audioCtx.currentTime + 0.02)
  } catch (err) {
    // Web Audio unavailable; matrix sequence continues silently.
  }
}

export function waitForInviteeName() {
  // rsvp.js may announce synchronously (no-guid path) before this listener
  // attaches, so check its cached value first instead of only listening.
  if (Object.prototype.hasOwnProperty.call(window, '__inviteeName')) {
    return Promise.resolve(window.__inviteeName)
  }
  return new Promise(resolve => {
    let settled = false
    const settle = name => {
      if (settled) return
      settled = true
      resolve(name)
    }
    document.addEventListener(
      'invitee:ready',
      event => settle(event.detail?.name || null),
      { once: true }
    )
    setTimeout(() => settle(null), INVITEE_TIMEOUT_MS)
  })
}

export function resolveLine(template, name) {
  if (name) return template.replace(/\{name\}/g, name)
  // No name: drop the placeholder together with any space right before it,
  // so "you {name}..." collapses to "you..." instead of leaving "you ...".
  return template
    .replace(/\s*\{name\}/g, '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

// Reusable typewriter effect — types `str` into `el` one character at a
// time with the same key-click sound as the boot sequence. Pass `shouldStop`
// to let a caller cancel a run already in progress (checked between every
// character); other callers can ignore it.
export async function typeText(el, str, { charDelayMs = CHAR_DELAY_MS, shouldStop = () => false } = {}) {
  el.textContent = ''
  for (const char of str) {
    if (shouldStop()) return
    el.textContent += char
    playKeySound()
    await wait(charDelayMs)
  }
}

let cancelled = false

// Lets another takeover (e.g. Control mode) interrupt the boot sequence
// instead of letting it keep typing/clicking silently underneath.
export function stopMatrixSequence() {
  if (cancelled) return
  cancelled = true
  audioCtx?.close()
  overlay?.remove()
}

async function runMatrixSequence() {
  overlay.hidden = false

  const name = await waitForInviteeName()
  if (cancelled) return

  for (const line of MATRIX_LINES) {
    await typeText(textEl, resolveLine(line, name), { shouldStop: () => cancelled })
    if (cancelled) return
    await wait(HOLD_DELAY_MS)
    if (cancelled) return
  }

  overlay.classList.add('matrix-view-hidden')
  document.dispatchEvent(new CustomEvent('matrix:done'))
  setTimeout(() => overlay.remove(), 1500)
  audioCtx?.close()
}

if (overlay) {
  document.addEventListener('boot-splash:dismissed', runMatrixSequence, {
    once: true
  })
}
