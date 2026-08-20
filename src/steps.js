const STEP_COUNT = 4;
let currentStep = 1;
let isFlipping = false;

const wizard = document.querySelector('.step-wizard');
const steps = document.querySelectorAll('.step');
const dots = document.querySelectorAll('.step-dot');
const prevBtn = document.getElementById('stepPrev');
const nextBtn = document.getElementById('stepNext');
const counter = document.getElementById('stepCounter');

const reduceMotion = window.matchMedia(
  '(prefers-reduced-motion: reduce)',
).matches;

const FLIP_DURATION = reduceMotion ? 0 : 380;
const FLIP_EASING = 'cubic-bezier(.4, 0, .2, 1)';

function getStepEl(step) {
  return wizard.querySelector(`.step[data-step="${step}"]`);
}

function updateChrome(step) {
  dots.forEach((dot) => {
    dot.classList.toggle('active', Number(dot.dataset.step) === step);
  });
  prevBtn.disabled = step === 1;
  nextBtn.hidden = step === STEP_COUNT;
  counter.textContent = `Paso ${step} de ${STEP_COUNT}`;
}

function flipTo(targetStep) {
  targetStep = Math.min(Math.max(targetStep, 1), STEP_COUNT);
  if (targetStep === currentStep || isFlipping) return;

  const direction = targetStep > currentStep ? 1 : -1;
  const outEl = getStepEl(currentStep);
  const inEl = getStepEl(targetStep);

  isFlipping = true;
  updateChrome(targetStep);

  if (reduceMotion) {
    outEl.classList.remove('active');
    inEl.classList.add('active');
    currentStep = targetStep;
    isFlipping = false;
    return;
  }

  outEl
    .animate(
      [
        { transform: 'rotateY(0deg)', opacity: 1 },
        { transform: `rotateY(${direction * -90}deg)`, opacity: 0 },
      ],
      { duration: FLIP_DURATION, easing: FLIP_EASING, fill: 'forwards' },
    )
    .finished.then(() => {
      outEl.classList.remove('active');
      outEl.style.transform = '';
      outEl.style.opacity = '';

      inEl.classList.add('active');
      const entrance = inEl.animate(
        [
          { transform: `rotateY(${direction * 90}deg)`, opacity: 0 },
          { transform: 'rotateY(0deg)', opacity: 1 },
        ],
        { duration: FLIP_DURATION, easing: FLIP_EASING, fill: 'forwards' },
      );

      entrance.finished.then(() => {
        inEl.style.transform = '';
        inEl.style.opacity = '';
        currentStep = targetStep;
        isFlipping = false;
      });
    });
}

prevBtn.addEventListener('click', () => flipTo(currentStep - 1));
nextBtn.addEventListener('click', () => flipTo(currentStep + 1));
dots.forEach((dot) => {
  dot.addEventListener('click', () => flipTo(Number(dot.dataset.step)));
});

updateChrome(currentStep);
