const SECTION_SELECTORS = [
  '.term-bar',
  '#inviteeGreeting',
  '.banner',
  '#stepDots',
  '.step-wizard',
  '.term-nav'
]

const TIGER_DELAY_MS_DEFAULT = 1000

const terminal = document.querySelector('.terminal')

function wait(ms) {
  return new Promise(resolve => setTimeout(resolve, ms))
}

async function revealStepWizard(stepWizardEl) {
  stepWizardEl.classList.remove('reveal-hidden')

  const tiger = stepWizardEl.querySelector('.tiger-reveal')
  if (!tiger) return

  const tigerDelay = Number(tiger.dataset.tigerDelay) || TIGER_DELAY_MS_DEFAULT
  await wait(tigerDelay)
  tiger.classList.add('reveal-hidden')
}

async function revealSections() {
  if (!terminal) return

  const delay = Number(terminal.dataset.revealDelay) || 350
  const sections = SECTION_SELECTORS.map(sel =>
    terminal.querySelector(sel)
  ).filter(Boolean)

  for (const section of sections) {
    if (section.classList.contains('step-wizard')) {
      await revealStepWizard(section)
    } else {
      section.classList.remove('reveal-hidden')
    }
    await wait(delay)
  }
}

if (terminal) {
  document.addEventListener('matrix:done', revealSections, { once: true })
}
