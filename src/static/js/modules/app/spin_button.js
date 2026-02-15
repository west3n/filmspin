export function createSpinButtonController({ spinBtn, t }) {
  let spinMorphTimer = null;

  function ensureSpinMarkup() {
    let dice = spinBtn.querySelector('.dice');
    let label = spinBtn.querySelector('.label');
    let img = dice ? dice.querySelector('img') : null;

    if (!dice || !label || !img) {
      spinBtn.innerHTML = `<span class="dice"><img src="/img/endurance.png" alt="Endurance" /></span><span class="label">${t('btn_spin')}</span><span class="shine" aria-hidden="true"></span>`;
      dice = spinBtn.querySelector('.dice');
      label = spinBtn.querySelector('.label');
      img = dice ? dice.querySelector('img') : null;
    }

    return { dice, label, img };
  }

  function syncSpinLabel() {
    const { label, img } = ensureSpinMarkup();
    if (label) label.textContent = t('btn_spin');
    if (img) img.alt = 'Endurance';
  }

  function getCurrentSpinAngle(diceEl) {
    if (!diceEl) return null;
    const transform = window.getComputedStyle(diceEl).transform;
    if (!transform || transform === 'none') return null;

    try {
      const matrix = new DOMMatrixReadOnly(transform);
      const angle = Math.atan2(matrix.b, matrix.a) * (180 / Math.PI);
      return ((angle % 360) + 360) % 360;
    } catch (_) {
      return null;
    }
  }

  function setSpinLoading(isLoading) {
    const { dice } = ensureSpinMarkup();
    const savedAngle = Number.parseFloat(spinBtn.dataset.spinAngle || '0');
    if (dice && Number.isFinite(savedAngle)) {
      dice.style.setProperty('--spin-angle', `${savedAngle.toFixed(2)}deg`);
    }
    if (spinMorphTimer) {
      clearTimeout(spinMorphTimer);
      spinMorphTimer = null;
    }

    if (isLoading) {
      spinBtn.classList.remove('is-unwinding');
      spinBtn.classList.remove('btn-press');
      void spinBtn.offsetWidth;
      spinBtn.classList.add('btn-press');
      spinBtn.classList.add('reel-mode', 'is-loading');

      if (dice) {
        const prevDir = spinBtn.dataset.spinDir;
        if (prevDir) dice.classList.remove(prevDir);
        const dir = Math.random() < 0.5 ? 'spin-left' : 'spin-right';
        dice.classList.add(dir);
        spinBtn.dataset.spinDir = dir;
      }
      return;
    }

    const dir = spinBtn.dataset.spinDir;
    if (dir) {
      const angle = getCurrentSpinAngle(dice);
      if (Number.isFinite(angle)) {
        spinBtn.dataset.spinAngle = angle.toFixed(2);
        if (dice) dice.style.setProperty('--spin-angle', `${angle.toFixed(2)}deg`);
      }
      if (dice) dice.classList.remove(dir);
      delete spinBtn.dataset.spinDir;
    }

    spinBtn.classList.remove('btn-press');
    spinBtn.classList.remove('is-loading');
    spinBtn.classList.add('is-unwinding');
    requestAnimationFrame(() => {
      spinBtn.classList.remove('reel-mode');
    });
    spinMorphTimer = setTimeout(() => {
      spinBtn.classList.remove('is-unwinding');
      spinMorphTimer = null;
    }, 620);
    syncSpinLabel();
  }

  return {
    syncSpinLabel,
    setSpinLoading,
  };
}
