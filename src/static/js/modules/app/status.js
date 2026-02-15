export function createStatusController({ sloganEl, statusEl, t }) {
  let statusTimer = null;
  let sloganSwapTimer = null;

  function clearSloganSwapTimer() {
    if (!sloganSwapTimer) return;
    clearTimeout(sloganSwapTimer);
    sloganSwapTimer = null;
  }

  function setSloganTone(tone) {
    if (!sloganEl) return;
    sloganEl.classList.remove('is-idle', 'is-info', 'is-success', 'is-error');
    sloganEl.classList.add(`is-${tone}`);
  }

  function swapSloganText(text, tone, { animate = true } = {}) {
    if (!sloganEl) return;
    clearSloganSwapTimer();
    setSloganTone(tone);

    if (!animate) {
      sloganEl.classList.remove('is-swap-out', 'is-swap-in');
      sloganEl.textContent = text;
      return;
    }

    sloganEl.classList.remove('is-swap-in');
    sloganEl.classList.add('is-swap-out');

    sloganSwapTimer = setTimeout(() => {
      sloganEl.textContent = text;
      sloganEl.classList.remove('is-swap-out');
      sloganEl.classList.add('is-swap-in');
      sloganSwapTimer = setTimeout(() => {
        sloganEl.classList.remove('is-swap-in');
        sloganSwapTimer = null;
      }, 260);
    }, 110);
  }

  function setSloganIdle({ animate = true } = {}) {
    swapSloganText(t('slogan'), 'idle', { animate });
  }

  function showStatus(kind, text, { autoclear = false } = {}) {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }

    const tone = kind === 'success' ? 'success' : (kind === 'error' ? 'error' : 'info');
    swapSloganText(text, tone);

    if (statusEl) {
      statusEl.textContent = text;
      statusEl.classList.add('hidden');
    }

    if (autoclear) {
      statusTimer = setTimeout(() => {
        hideStatus();
      }, 2600);
    }
  }

  function hideStatus() {
    if (statusTimer) {
      clearTimeout(statusTimer);
      statusTimer = null;
    }
    setSloganIdle();
    if (statusEl) statusEl.classList.add('hidden');
  }

  return {
    setSloganIdle,
    showStatus,
    hideStatus,
  };
}
