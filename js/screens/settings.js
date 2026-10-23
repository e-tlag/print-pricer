// Settings: your rates, defaults for new quotes, selling fees, look, and backups.
import { h, icon, money, fmt, numField, toggle, editSheet, toast } from '../ui.js';
import { store, save, saveSoon, uid, exportBackup, importBackup } from '../store.js';
import { channelLine } from './quote.js';

const THEMES = [['teal', 'Electric teal', '#2DD4BF'], ['orange', 'Filament orange', '#FF8A3D'], ['violet', 'Ultraviolet', '#B794F6']];
const MODES = [['markup', 'Markup %'], ['margin', 'Margin %'], ['fixed', 'Fixed $ per item'], ['hourly', 'Hourly ($ per print hour)']];

export function renderSettings(ctx) {
  const d = store.data;
  const s = d.settings;
  const set = (key) => (v) => { s[key] = v; saveSoon(); };

  const costs = group('Your costs', [
    row('Electricity rate', 'From your power bill', numField({ value: s.kwhRate, prefix: s.currency, suffix: '/kWh', size: 5, label: 'Electricity rate', onChange: set('kwhRate') })),
    row('Your hourly rate', 'For setup and finishing time', numField({ value: s.laborRate, prefix: s.currency, suffix: '/hr', size: 4, label: 'Your hourly rate', onChange: set('laborRate') })),
    row('Failure buffer', 'Default for new quotes', numField({ value: s.failurePct, suffix: '%', size: 3, label: 'Default failure buffer', onChange: (v) => set('failurePct')(v ?? 0) })),
    row('Currency symbol', 'Shown on prices', h('input', { type: 'text', class: 'text-in', style: 'width:64px; text-align:center', maxlength: 3,
      value: s.currency, 'aria-label': 'Currency symbol', oninput: (e) => set('currency')(e.target.value || '$') })),
  ]);

  const modeSelect = h('select', { class: 'text-in', style: 'width:auto; max-width:190px', 'aria-label': 'Default profit mode',
    onchange: (e) => { s.profitMode = e.target.value; save(); ctx.rerender(); } },
  MODES.map(([v, t]) => h('option', { value: v, selected: v === s.profitMode }, t)));
  const m = s.profitMode;
  const defaults = group('Defaults for new quotes', [
    row('Profit mode', null, modeSelect),
    row('Profit amount', null, numField({
      value: s.profitValues[m], size: 4, label: 'Default profit amount',
      ...(m === 'markup' || m === 'margin' ? { suffix: '%' } : m === 'fixed' ? { prefix: s.currency } : { prefix: s.currency, suffix: '/hr' }),
      onChange: (v) => { s.profitValues[m] = v ?? 0; saveSoon(); },
    })),
    row('Round up to .99', null, toggle(s.roundTo99, (v) => { s.roundTo99 = v; save(); }, 'Round up to .99')),
    row('Where you sell', null, selectOf(d.channels, s.defaultChannelId, 'Default selling channel', (v) => { s.defaultChannelId = v; save(); })),
    row('Printer', null, selectOf(d.printers, s.defaultPrinterId, 'Default printer', (v) => { s.defaultPrinterId = v; save(); })),
  ]);

  const editChannel = (c, isNew) => editSheet({
    title: isNew ? 'Add a selling channel' : c.name,
    item: c,
    fields: [
      { key: 'name', label: 'Name', type: 'text', hint: 'For example "Etsy" or "Craft fair"' },
      { key: 'note', label: 'Note', type: 'text' },
      { key: 'feePct', label: 'Fee', type: 'number', suffix: '%', hint: 'Percent of the sale (and buyer-paid shipping)' },
      { key: 'feeMin', label: 'Minimum fee', type: 'number', prefix: s.currency },
      { key: 'feeFlat', label: 'Flat fee per sale', type: 'number', prefix: s.currency },
      { key: 'shipped', label: 'Items get shipped', type: 'bool' },
    ],
    onSave: (v) => {
      v.name = (v.name || '').trim() || 'Channel';
      for (const k of ['feePct', 'feeMin', 'feeFlat']) v[k] = v[k] ?? 0;
      if (isNew) d.channels.push(v); else Object.assign(c, v);
      save(); ctx.rerender(); toast('Saved');
    },
    onDelete: isNew || d.channels.length < 2 ? null : () => {
      if (!confirm(`Delete ${c.name}?`)) return false;
      d.channels = d.channels.filter((x) => x.id !== c.id);
      if (s.defaultChannelId === c.id) s.defaultChannelId = d.channels[0].id;
      if (d.draft.channelId === c.id) d.draft.channelId = s.defaultChannelId;
      save(); ctx.rerender(); toast('Deleted');
      return true;
    },
  });
  const fees = group('Selling fees', [
    ...d.channels.map((c) => h('button', { type: 'button', class: 'group-row', onclick: () => editChannel(c) },
      h('span', { class: 'grow col' }, h('span', null, c.name), h('span', { class: 'hint' }, c.note || channelLine(c))),
      h('span', { class: 'disp' }, `${fmt(c.feePct || 0, 2)}%${c.feeMin ? ` · min ${money(c.feeMin)}` : ''}`),
      h('span', { style: 'color:var(--muted)' }, icon('chevR', 16)))),
    h('button', { type: 'button', class: 'group-row', onclick: () =>
      editChannel({ id: uid(), name: '', note: '', feePct: 0, feeMin: 0, feeFlat: 0, shipped: true }, true) },
    h('span', { class: 'grow accent strong' }, '+ Add a channel')),
  ]);

  const look = group('Look', [
    row('Accent color', null, h('div', { class: 'gap8', style: 'gap:10px' }, THEMES.map(([v, name, hex]) =>
      h('button', { type: 'button', class: 'color-swatch', style: `background:${hex}`, 'aria-label': name,
        'aria-pressed': v === s.theme ? 'true' : 'false', onclick: () => { s.theme = v; save(); ctx.rerender(); } })))),
  ]);

  const fileInput = h('input', { type: 'file', accept: 'application/json,.json', class: 'sr', 'aria-label': 'Choose a backup file',
    onchange: async (e) => {
      const file = e.target.files?.[0];
      e.target.value = '';
      if (!file) return;
      if (!confirm('Replace everything in the app with this backup?')) return;
      try {
        importBackup(await file.text());
        toast('Backup restored');
        ctx.rerender();
      } catch (err) {
        toast(err.message || 'Could not read that file');
      }
    } });
  const data = h('section', { class: 'group' },
    h('h2', { class: 'h2' }, 'Your data'),
    h('div', { class: 'card' },
      h('span', { class: 'hint', style: 'font-size:13px; line-height:1.45' },
        'Everything is saved on this phone only. Make a backup file now and then so you don’t lose it.'),
      h('div', { class: 'grid2' },
        h('button', { type: 'button', class: 'btn primary', style: 'height:48px', onclick: () =>
          download(`print-pricer-backup-${today()}.json`, exportBackup(), 'application/json') }, 'Back up'),
        h('button', { type: 'button', class: 'btn ghost', style: 'height:48px', onclick: () => fileInput.click() }, 'Restore')),
      h('button', { type: 'button', class: 'btn ghost', style: 'height:48px', onclick: () => {
        if (!d.quotes.length) { toast('No saved quotes yet'); return; }
        download(`quotes-${today()}.csv`, quotesCsv(d), 'text/csv');
      } }, 'Export quotes to a spreadsheet'),
      fileInput));

  const about = h('div', { class: 'tip' }, icon('info', 18),
    h('span', null, 'Printer power, printer life and selling fees start as estimates. Check them against your power meter and the selling app’s fee screen.'));

  return h('div', { class: 'screen' },
    h('header', { class: 'top' }, h('h1', { class: 'title' }, 'Settings')),
    h('main', { class: 'stack', style: 'gap:20px' }, costs, defaults, fees, look, data, about));
}

function group(title, rows) {
  return h('section', { class: 'group' }, h('h2', { class: 'h2' }, title), h('div', { class: 'group-box' }, rows));
}

function row(label, hint, control) {
  return h('div', { class: 'group-row' },
    h('span', { class: 'grow col' }, h('span', null, label), hint ? h('span', { class: 'hint' }, hint) : null),
    control);
}

function selectOf(list, current, label, onPick) {
  return h('select', { class: 'text-in', style: 'width:auto; max-width:190px', 'aria-label': label, onchange: (e) => onPick(e.target.value) },
    list.map((x) => h('option', { value: x.id, selected: x.id === current }, x.name)));
}

const today = () => new Date().toISOString().slice(0, 10);

function download(name, text, type) {
  const url = URL.createObjectURL(new Blob([text], { type }));
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function quotesCsv(d) {
  const cell = (v) => {
    const t = v == null ? '' : String(v);
    // Leading = + - @ would run as a formula in a spreadsheet.
    const safe = /^[=+\-@]/.test(t) && !/^-?\d+(\.\d+)?$/.test(t) ? `'${t}` : t;
    return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
  };
  const head = ['Name', 'Saved', 'Price per item', 'Profit per item', 'Margin %', 'Items per plate', 'Printer', 'Sold through', 'Shipping'];
  const rows = d.quotes.map((e) => {
    const s = e.summary;
    return [e.draft.name, e.savedAt.slice(0, 10), s.price?.toFixed(2), s.profit?.toFixed(2), s.margin == null ? '' : s.margin.toFixed(1),
      s.items, s.printerName, s.channelName, s.shipped ? (s.shippingMode === 'built_in' ? 'Built into price' : 'Buyer pays') : 'None'];
  });
  return [head, ...rows].map((r) => r.map(cell).join(',')).join('\r\n');
}
