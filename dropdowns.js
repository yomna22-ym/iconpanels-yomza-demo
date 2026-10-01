// Keep source selects and change events as the pricing application's contract.
(() => {
  const controls = [];
  let active = null, index = 0, typed = '', typingTimer;
  const popup = document.createElement('div');
  popup.className = 'select-popup'; popup.id = 'selectOptions';
  popup.setAttribute('role', 'listbox'); popup.hidden = true;
  document.body.append(popup);
  function sync() {
    controls.forEach(({select, button}) => {
      button.firstChild.textContent = select.selectedOptions[0]?.textContent || 'Select';
      button.disabled = select.disabled;
    });
  }
  function close() {
    if (!active) return;
    active.button.setAttribute('aria-expanded', 'false');
    active.button.removeAttribute('aria-activedescendant');
    popup.hidden = true; active = null; typed = '';
  }
  function highlight(next) {
    const options = [...popup.children];
    index = Math.max(0, Math.min(options.length - 1, next));
    options.forEach((option, i) => option.classList.toggle('highlighted', i === index));
    const option = options[index];
    if (option) {
      active.button.setAttribute('aria-activedescendant', option.id);
      // Scroll only the options list, never the page or the item editor.
      const top = option.offsetTop, bottom = top + option.offsetHeight;
      if (top < popup.scrollTop) popup.scrollTop = top;
      else if (bottom > popup.scrollTop + popup.clientHeight) popup.scrollTop = bottom - popup.clientHeight;
    }
  }
  function choose(i) {
    const {select,button} = active;
    select.selectedIndex = i;
    select.dispatchEvent(new Event('input', {bubbles:true}));
    select.dispatchEvent(new Event('change', {bubbles:true}));
    sync(); close(); button.focus();
  }
  function open(control) {
    close(); active = control;
    const {select,button} = control;
    popup.replaceChildren(...[...select.options].map((option,i) => {
      const row = document.createElement('div');
      row.id = 'selectOption' + i; row.className = 'select-option';
      row.setAttribute('role','option');
      row.setAttribute('aria-selected', String(i === select.selectedIndex));
      row.textContent = option.textContent;
      row.addEventListener('pointerdown', e => e.preventDefault());
      row.addEventListener('click', () => choose(i));
      return row;
    }));
    const rect = button.getBoundingClientRect();
    const below = innerHeight - rect.bottom - 16, above = rect.top - 16;
    const up = below < 180 && above > below;
    popup.style.width = rect.width + 'px';
    popup.style.left = Math.max(12,Math.min(rect.left,innerWidth-rect.width-12)) + 'px';
    popup.style.maxHeight = Math.max(80,Math.min(260,up?above:below)) + 'px';
    popup.style.top = up ? 'auto' : rect.bottom + 6 + 'px';
    popup.style.bottom = up ? innerHeight - rect.top + 6 + 'px' : 'auto';
    popup.setAttribute('aria-label',button.getAttribute('aria-label'));
    popup.hidden = false; button.setAttribute('aria-expanded','true');
    highlight(select.selectedIndex);
  }
  document.querySelectorAll('select').forEach(select => {
    const button = document.createElement('button');
    button.type = 'button'; button.className = 'select-trigger';
    button.id = select.id + 'Trigger'; button.append(document.createElement('span'));
    button.setAttribute('role','combobox');
    button.setAttribute('aria-haspopup','listbox');
    button.setAttribute('aria-controls',popup.id);
    button.setAttribute('aria-expanded','false');
    button.setAttribute('aria-label',select.closest('label')?.firstChild.textContent.trim() || select.id);
    select.classList.add('native-select'); select.tabIndex = -1;
    select.setAttribute('aria-hidden','true'); select.after(button);
    const control = {select,button}; controls.push(control);
    button.addEventListener('click', () => active === control ? close() : open(control));
    button.addEventListener('keydown', e => {
      if (['ArrowDown','ArrowUp','Home','End','Enter',' '].includes(e.key)) {
        e.preventDefault();
        if (active !== control) {open(control); return;}
        if (e.key === 'Enter' || e.key === ' ') choose(index);
        else highlight(e.key === 'Home' ? 0 : e.key === 'End' ? select.options.length-1 : index+(e.key === 'ArrowDown'?1:-1));
      } else if (e.key === 'Escape' && active) {
        e.preventDefault(); e.stopPropagation(); close();
      } else if (e.key === 'Tab') close();
      else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
        if (active !== control) open(control);
        typed += e.key.toLowerCase(); clearTimeout(typingTimer);
        typingTimer = setTimeout(() => typed = '',700);
        const i = [...select.options].findIndex(o => o.textContent.toLowerCase().startsWith(typed));
        if (i >= 0) highlight(i);
      }
    });
    select.addEventListener('change',sync);
  });
  document.addEventListener('pointerdown', e => {
    if (active && !popup.contains(e.target) && !active.button.contains(e.target)) close();
  });
  document.addEventListener('scroll',e => {if (!popup.contains(e.target)) close();},true);
  window.addEventListener('resize',close);
  window.syncDropdowns = sync; window.closeDropdowns = close;
  sync();
})();
