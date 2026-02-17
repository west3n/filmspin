export function createSpinButtonController({ spinBtn, t }) {
  function ensureSpinMarkup() {
    let dice = spinBtn.querySelector('.dice');
    let label = spinBtn.querySelector('.label');

    if (!dice || !label) {
      spinBtn.innerHTML = '<span class="dice" aria-hidden="true"><img src="/img/endurance.png" alt="" /></span><span class="label"></span><span class="shine" aria-hidden="true"></span>';
      dice = spinBtn.querySelector('.dice');
      label = spinBtn.querySelector('.label');
    }

    return { dice, label };
  }

  function syncSpinLabel() {
    const { label } = ensureSpinMarkup();
    if (label) label.textContent = t('btn_spin');
    spinBtn.setAttribute('aria-label', t('btn_spin'));
  }

  function setSpinLoading(isLoading) {
    if (spinBtn.classList.contains('is-retired')) return;
    ensureSpinMarkup();
    spinBtn.classList.remove('is-ready', 'is-fading');
    spinBtn.classList.toggle('is-loading', Boolean(isLoading));
    spinBtn.disabled = Boolean(isLoading);
    if (isLoading) return;
    syncSpinLabel();
  }

  function retireSpinButton() {
    if (spinBtn.classList.contains('is-retired')) return;
    const ctaWrap = spinBtn.closest('.cta-wrap');
    spinBtn.classList.add('is-retired');
    spinBtn.setAttribute('aria-hidden', 'true');
    spinBtn.setAttribute('tabindex', '-1');
    if (ctaWrap) ctaWrap.classList.add('is-retired');
  }

  return {
    syncSpinLabel,
    setSpinLoading,
    retireSpinButton,
  };
}
