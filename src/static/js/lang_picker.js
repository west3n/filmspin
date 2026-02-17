(function initLangPickerGlobal() {
  function createButton(value, label, isSelected, isDisabled) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'lang-picker-option';
    button.setAttribute('role', 'option');
    button.dataset.value = value;
    button.textContent = label;
    button.setAttribute('aria-selected', isSelected ? 'true' : 'false');
    if (isSelected) button.classList.add('is-selected');
    if (isDisabled) {
      button.disabled = true;
      button.classList.add('is-disabled');
    }
    return button;
  }

  function initLangPicker(selectEl) {
    if (!(selectEl instanceof HTMLSelectElement)) return null;
    if (selectEl.dataset.langPickerReady === '1') return selectEl._langPickerApi || null;

    const wrapper = document.createElement('div');
    wrapper.className = 'lang-picker';

    const trigger = document.createElement('button');
    trigger.type = 'button';
    trigger.className = 'lang-picker-trigger';
    trigger.setAttribute('aria-haspopup', 'listbox');
    trigger.setAttribute('aria-expanded', 'false');
    trigger.setAttribute('aria-label', selectEl.getAttribute('aria-label') || 'Language');

    const triggerValue = document.createElement('span');
    triggerValue.className = 'lang-picker-value';
    trigger.appendChild(triggerValue);

    const caret = document.createElement('span');
    caret.className = 'lang-picker-caret';
    caret.setAttribute('aria-hidden', 'true');
    trigger.appendChild(caret);

    const menu = document.createElement('div');
    menu.className = 'lang-picker-menu';
    menu.setAttribute('role', 'listbox');

    const parent = selectEl.parentNode;
    if (!parent) return null;
    parent.insertBefore(wrapper, selectEl);
    wrapper.appendChild(trigger);
    wrapper.appendChild(menu);
    wrapper.appendChild(selectEl);

    selectEl.classList.add('is-upgraded');
    selectEl.dataset.langPickerReady = '1';

    let isOpen = false;

    function closeMenu() {
      if (!isOpen) return;
      isOpen = false;
      wrapper.classList.remove('is-open');
      trigger.setAttribute('aria-expanded', 'false');
    }

    function openMenu() {
      if (isOpen) return;
      isOpen = true;
      wrapper.classList.add('is-open');
      trigger.setAttribute('aria-expanded', 'true');
    }

    function syncTriggerLabel() {
      const selectedOption = selectEl.options[selectEl.selectedIndex];
      triggerValue.textContent = selectedOption ? selectedOption.textContent.trim() : 'EN';
      const selectedBtn = menu.querySelector(`.lang-picker-option[data-value="${selectEl.value}"]`);
      menu.querySelectorAll('.lang-picker-option').forEach((btn) => {
        const isSelected = btn === selectedBtn;
        btn.classList.toggle('is-selected', isSelected);
        btn.setAttribute('aria-selected', isSelected ? 'true' : 'false');
      });
    }

    function rebuildMenu() {
      menu.textContent = '';
      const options = Array.from(selectEl.options);
      options.forEach((option) => {
        if (option.hidden) return;
        const button = createButton(
          option.value,
          option.textContent.trim(),
          option.selected,
          option.disabled,
        );
        button.addEventListener('click', () => {
          if (button.disabled) return;
          if (selectEl.value !== option.value) {
            selectEl.value = option.value;
            selectEl.dispatchEvent(new Event('change', { bubbles: true }));
          }
          syncTriggerLabel();
          closeMenu();
          trigger.focus();
        });
        menu.appendChild(button);
      });
      syncTriggerLabel();
    }

    function sync() {
      syncTriggerLabel();
    }

    function refresh() {
      rebuildMenu();
      syncTriggerLabel();
    }

    trigger.addEventListener('click', () => {
      if (isOpen) closeMenu();
      else openMenu();
    });

    trigger.addEventListener('keydown', (event) => {
      if (event.key === 'ArrowDown' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu();
        const firstEnabled = menu.querySelector('.lang-picker-option:not(.is-disabled)');
        if (firstEnabled instanceof HTMLElement) firstEnabled.focus();
      } else if (event.key === 'Escape') {
        closeMenu();
      }
    });

    menu.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        trigger.focus();
      }
    });

    document.addEventListener('pointerdown', (event) => {
      if (!wrapper.contains(event.target)) closeMenu();
    });

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeMenu();
    });

    selectEl.addEventListener('change', syncTriggerLabel);

    const observer = new MutationObserver(() => {
      refresh();
    });
    observer.observe(selectEl, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ['hidden', 'disabled', 'selected', 'label'],
      characterData: true,
    });

    rebuildMenu();

    const api = {
      sync,
      refresh,
      close: closeMenu,
      destroy: () => {
        observer.disconnect();
        closeMenu();
      },
    };

    selectEl._langPickerApi = api;
    return api;
  }

  window.initLangPicker = initLangPicker;
})();
