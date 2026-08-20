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

function waitForInviteeName() {
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

function resolveLine(template, name) {
  return template
    .replace(/\{name\}/g, name || '')
    .replace(/\s{2,}/g, ' ')
    .trim()
}

async function typeText(str) {
  textEl.textContent = ''
  for (const char of str) {
    textEl.textContent += char
    playKeySound()
    await wait(CHAR_DELAY_MS)
  }
}

async function runMatrixSequence() {
  overlay.hidden = false

  const name = await waitForInviteeName()

  for (const line of MATRIX_LINES) {
    await typeText(resolveLine(line, name))
    await wait(HOLD_DELAY_MS)
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
