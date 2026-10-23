// Small helpers for building screens. User text always goes in as text, never HTML.
import { store } from './store.js';

export function h(tag, props, ...kids) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(props || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style') el.style.cssText = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked' || k === 'selected' || k === 'disabled') el[k] = !!v;
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
  for (const kid of kids.flat(Infinity)) {
    if (kid == null || kid === false) continue;
    el.append(kid instanceof Node ? kid : String(kid));
  }
  return el;
}

const ICONS = {
  calc: '<rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 7h8M8 12h2M14 12h2M8 16h2M14 16h2"/>',
  clock: '<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>',
  layers: '<path d="M12 3l9 5-9 5-9-5z"/><path d="M3 13l9 5 9-5"/>',
  sliders: '<path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/>',
  bookmark: '<path d="M6 3h12v18l-6-4-6 4z"/>',
  dots: '<circle cx="5" cy="12" r="1.2"/><circle cx="12" cy="12" r="1.2"/><circle cx="19" cy="12" r="1.2"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  chevR: '<path d="M9 6l6 6-6 6"/>',
  chevL: '<path d="M15 6l-6 6 6 6"/>',
  trash: '<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>',
  box: '<path d="M3 7l9-4 9 4v10l-9 4-9-4z"/><path d="M3 7l9 4 9-4M12 11v10"/>',
  copy: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M16 8V5a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v10a1 1 0 0 0 1 1h3"/>',
  printer: '<rect x="3" y="3" width="18" height="18" rx="3"/><path d="M7 8h10M12 8v5M9 17h6"/>',
  cube: '<path d="M12 3l8 4.5v9L12 21l-8-4.5v-9z"/><path d="M4 7.5l8 4.5 8-4.5M12 12v9"/>',
  search: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/>',
  info: '<circle cx="12" cy="12" r="9"/><path d="M12 11v5M12 8h.01"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  minus: '<path d="M5 12h14"/>',
  spool: '<circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="3"/>',
};

export function icon(name, size = 20) {
  const span = document.createElement('span');
  span.className = 'ico';
  span.setAttribute('aria-hidden', 'true');
  // Fixed icon markup from the table above, never user text.
  span.innerHTML = `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${ICONS[name] || ''}</svg>`;
  return span;
}

export function money(x) {
  const cur = store.data?.settings.currency ?? '$';
  const v = Number.isFinite(x) ? x : 0;
  const sign = v < 0 ? '−' : '';
  return `${sign}${cur}${Math.abs(v).toFixed(2)}`;
}

export function fmt(x, digits = 2) {
  if (x == null || !Number.isFinite(x)) return '';
  return String(Math.round(x * 10 ** digits) / 10 ** digits);
}

// Accepts "1,5" or "1.5"; blank means null.
export function parseNum(text) {
  const t = String(text).trim().replace(',', '.');
  if (t === '') return null;
  const v = Number(t);
  return Number.isFinite(v) ? v : null;
}

// A small number box: optional prefix/suffix, calls onChange(number|null) as you type.
export function numField({ value, onChange, prefix, suffix, label, size = 5, big = false, integer = false }) {
  const input = h('input', {
    type: 'text',
    inputmode: integer ? 'numeric' : 'decimal',
    autocomplete: 'off',
    value: value == null ? '' : fmt(value, 4),
    placeholder: '0',
    'aria-label': label,
    style: `width:${size}ch`,
    onfocus: (e) => e.target.select(),
    oninput: (e) => onChange(parseNum(e.target.value)),
  });
  return h('label', { class: big ? 'num big' : 'num' }, prefix ? h('span', { class: 'affix' }, prefix) : null, input,
    suffix ? h('span', { class: 'affix' }, suffix) : null);
}

export function seg(options, current, onPick, { accent = false, label } = {}) {
  return h('div', { class: accent ? 'seg accent' : 'seg', role: 'group', 'aria-label': label },
    options.map(([value, text]) =>
      h('button', {
        type: 'button',
        class: value === current ? 'on' : null,
        'aria-pressed': value === current ? 'true' : 'false',
        onclick: () => onPick(value),
      }, text)));
}

export function toggle(on, onFlip, label) {
  return h('button', {
    type: 'button', class: 'switch', role: 'switch', 'aria-checked': on ? 'true' : 'false', 'aria-label': label,
    onclick: (e) => {
      const next = e.currentTarget.getAttribute('aria-checked') !== 'true';
      e.currentTarget.setAttribute('aria-checked', next ? 'true' : 'false');
      onFlip(next);
    },
  }, h('span', { class: 'knob' }));
}

export function iconBtn(name, label, onclick, cls = 'icon-btn') {
  return h('button', { type: 'button', class: cls, 'aria-label': label, onclick }, icon(name));
}

let toastTimer = null;
export function toast(text) {
  let el = document.getElementById('toast');
  if (!el) {
    el = h('div', { id: 'toast', class: 'toast', role: 'status', 'aria-live': 'polite' });
    document.body.append(el);
  }
  el.textContent = text;
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

// Bottom sheet. content: element; actions: [{text, kind, onclick}] (onclick returning false keeps it open).
export function sheet(title, content, actions = []) {
  const dlg = h('dialog', { class: 'sheet', 'aria-label': title });
  const close = () => { dlg.close(); dlg.remove(); };
  dlg.append(
    h('div', { class: 'sheet-head' }, h('h2', { class: 'sheet-title' }, title), iconBtn('x', 'Close', close, 'icon-btn flat')),
    h('div', { class: 'sheet-body' }, content),
    actions.length ? h('div', { class: 'sheet-actions' }, actions.map((a) =>
      h('button', {
        type: 'button', class: `btn ${a.kind || 'ghost'}`,
        onclick: () => { if (a.onclick?.() !== false) close(); },
      }, a.text))) : null,
  );
  dlg.addEventListener('cancel', (e) => { e.preventDefault(); close(); });
  dlg.addEventListener('click', (e) => { if (e.target === dlg) close(); });
  document.body.append(dlg);
  dlg.showModal();
  return { close, el: dlg };
}

// A form inside a sheet for editing one library item.
// fields: [{key, label, type:'text'|'number'|'color'|'bool', prefix, suffix, hint}]
export function editSheet({ title, item, fields, onSave, onDelete, deleteText = 'Delete' }) {
  const draft = { ...item };
  const rows = fields.map((f) => {
    let control;
    if (f.type === 'bool') {
      control = toggle(!!draft[f.key], (v) => { draft[f.key] = v; }, f.label);
    } else if (f.type === 'color') {
      control = h('input', { type: 'color', class: 'color-in', value: draft[f.key] || '#888888', 'aria-label': f.label,
        oninput: (e) => { draft[f.key] = e.target.value; } });
    } else if (f.type === 'number') {
      control = numField({ value: draft[f.key], prefix: f.prefix, suffix: f.suffix, label: f.label, size: 6,
        onChange: (v) => { draft[f.key] = v; } });
    } else {
      control = h('input', { type: 'text', class: 'text-in', value: draft[f.key] ?? '', 'aria-label': f.label,
        oninput: (e) => { draft[f.key] = e.target.value; } });
    }
    return h('div', { class: f.type === 'text' ? 'form-row stack-row' : 'form-row' },
      h('div', { class: 'grow col' }, h('span', { class: 'form-label' }, f.label), f.hint ? h('span', { class: 'hint' }, f.hint) : null),
      control);
  });
  const actions = [];
  if (onDelete) actions.push({ text: deleteText, kind: 'danger', onclick: onDelete });
  actions.push({ text: 'Save', kind: 'primary', onclick: () => onSave(draft) });
  return sheet(title, h('div', { class: 'form' }, rows), actions);
}
