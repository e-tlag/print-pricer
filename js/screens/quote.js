// Quote: enter one job; the price bar at the bottom updates as you type.
import { h, icon, iconBtn, money, fmt, numField, seg, toggle, toast, sheet } from '../ui.js';
import { store, saveSoon, save, byId, toJob, missingSetup, newDraft, saveDraftAsQuote } from '../store.js';
import { computeQuote } from '../pricing.js';

const PROFIT_MODES = [['markup', 'Markup'], ['margin', 'Margin'], ['fixed', 'Fixed $'], ['hourly', 'Hourly']];
const STEP = { markup: 10, margin: 5, fixed: 1, hourly: 0.5 };

export function renderQuote(ctx) {
  const d = store.data;
  const q = d.draft;
  const s = d.settings;
  const live = [];
  const result = () => computeQuote(toJob(d, q));
  const refresh = () => { const r = result(); for (const fn of live) fn(r); };
  const changed = () => { saveSoon(); refresh(); };
  const restructure = () => { save(); ctx.rerender(); };
  const liveText = (cls, fn) => {
    const el = h('span', { class: cls });
    live.push((r) => { el.textContent = fn(r); });
    return el;
  };

  const printer = byId(d.printers, q.printerId) || d.printers[0];
  const channel = byId(d.channels, q.channelId) || d.channels[0];
  const missing = missingSetup(d, q);

  // Header
  const header = h('header', { class: 'top' },
    h('div', { class: 'grow col' },
      h('span', { class: 'eyebrow' }, q.id ? 'Saved quote' : 'New quote'),
      h('input', { class: 'title-input', value: q.name, 'aria-label': 'Job name', maxlength: 60,
        oninput: (e) => { q.name = e.target.value; saveSoon(); } })),
    h('div', { class: 'gap8' },
      iconBtn('bookmark', 'Save quote', () => {
        saveDraftAsQuote(d, result());
        toast('Saved to History');
        ctx.rerender();
      }),
      iconBtn('dots', 'More options', () => moreMenu(ctx))));

  const banner = missing.length ? h('section', { class: 'banner' },
    h('span', { class: 'strong' }, 'Finish setup for accurate prices'),
    h('div', { class: 'gap8 wrap' }, missing.map((m) => h('a', { href: m.href }, m.label, icon('chevR', 16))))) : null;

  // Printer
  const wearHr = (printer?.lifeHours > 0 ? (printer.pricePaid || 0) / printer.lifeHours : 0) + (printer?.upkeepPerHour || 0);
  const printerCard = h('section', { class: 'card' },
    h('h2', { class: 'h2' }, 'Printer'),
    h('div', { class: 'gap8 wrap' },
      d.printers.map((p) => h('button', {
        type: 'button', class: p.id === q.printerId ? 'chip on' : 'chip', 'aria-pressed': p.id === q.printerId ? 'true' : 'false',
        onclick: () => { q.printerId = p.id; restructure(); },
      }, p.id === q.printerId ? icon('check', 16) : null, p.name.replace(/^Bambu Lab /, 'Bambu '))),
      h('a', { class: 'chip add', href: '#/library/printers' }, '+ Add')),
    h('div', { class: 'grid3' },
      stat(printer?.watts != null ? `${fmt(printer.watts, 0)} W` : '—', 'Power (est.)'),
      stat(s.kwhRate != null ? money(s.kwhRate) : '—', 'per kWh'),
      stat(money(wearHr), 'wear per hr')));

  // Plate
  const plateCard = h('section', { class: 'card' },
    h('h2', { class: 'h2' }, 'Plate'),
    h('div', { class: 'row' },
      h('span', { class: 'strong' }, 'Items on this plate'),
      stepper(q, 'itemsOnPlate', changed)),
    h('div', { class: 'row' },
      h('span', { class: 'strong' }, 'Print time'),
      h('div', { class: 'gap8' },
        numField({ value: Math.floor(q.printMinutes / 60), suffix: 'h', label: 'Print time hours', size: 3, integer: true,
          onChange: (v) => { q.printMinutes = Math.max(0, v || 0) * 60 + (q.printMinutes % 60); changed(); } }),
        numField({ value: q.printMinutes % 60, suffix: 'm', label: 'Print time minutes', size: 3, integer: true,
          onChange: (v) => { q.printMinutes = Math.floor(q.printMinutes / 60) * 60 + Math.max(0, v || 0); changed(); } }))),
    h('div', { class: 'col', style: 'gap:6px' },
      h('span', { class: 'hint' }, 'My slicer numbers are for'),
      seg([['plate', 'Whole plate'], ['item', 'One item']], q.slicerBasis, (v) => { q.slicerBasis = v; restructure(); },
        { label: 'Slicer numbers are for' }),
      liveText('hint', (r) => (q.slicerBasis === 'plate'
        ? `Costs are split evenly across the ${r.items} item${r.items === 1 ? '' : 's'}.`
        : 'Grams and time are for one item.'))));

  // Filament
  const basisWord = q.slicerBasis === 'plate' ? 'per plate' : 'per item';
  const filCard = h('section', { class: 'card', style: 'gap:10px' },
    h('div', { class: 'card-h' },
      h('h2', { class: 'h2' }, 'Filament'),
      q.filaments.length > 1 ? h('span', { class: 'badge' }, `AMS · ${q.filaments.length} colors`) : null),
    q.filaments.map((row, i) => filamentRow(d, q, row, i, changed, restructure, ctx)),
    h('div', { class: 'fil-row' },
      h('span', { style: 'color:var(--muted); flex-shrink:0' }, icon('trash', 22)),
      h('div', { class: 'grow col' },
        h('span', { class: 'strong', style: 'font-size:14px' }, 'Purge & waste'),
        h('span', { class: 'hint' }, 'Color swaps, prime tower')),
      numField({ value: q.purgeGrams, suffix: 'g', label: 'Purge and waste grams', size: 4,
        onChange: (v) => { q.purgeGrams = v || 0; changed(); } })),
    h('button', { type: 'button', class: 'dashed', onclick: () => {
      const used = new Set(q.filaments.map((f) => f.filamentId));
      const next = d.filaments.find((f) => !used.has(f.id)) || d.filaments[0];
      q.filaments.push({ filamentId: next?.id ?? null, grams: 0 });
      restructure();
    } }, '+ Add a color'),
    h('div', { class: 'card-h', style: 'padding:4px 2px 0' },
      liveText('hint', () => `${fmt(q.filaments.reduce((a, f) => a + (f.grams || 0), 0) + (q.purgeGrams || 0), 1)} g total`),
      liveText('strong', (r) => `${money(r.lines.material * (q.slicerBasis === 'plate' ? r.items : 1))} ${basisWord}`)));

  // Your time
  const timeCard = h('section', { class: 'card' },
    h('div', { class: 'card-h' },
      h('h2', { class: 'h2' }, 'Your time'),
      s.laborRate != null ? h('span', { class: 'hint' }, `at ${money(s.laborRate)} / hr`)
        : h('a', { href: '#/settings', class: 'hint warn' }, 'Set your hourly rate')),
    h('div', { class: 'grid2' },
      tileField('Setup per plate', numField({ value: q.setupMinPerPlate, suffix: 'min', label: 'Setup minutes per plate', size: 3,
        onChange: (v) => { q.setupMinPerPlate = v || 0; changed(); } })),
      tileField('Finishing per item', numField({ value: q.finishMinPerItem, suffix: 'min', label: 'Finishing minutes per item', size: 3,
        onChange: (v) => { q.finishMinPerItem = v || 0; changed(); } }))),
    liveText('hint', (r) => `Labor adds ${money(r.lines.labor)} per item.`));

  // Extras
  const failVal = liveText('disp accent', () => `${fmt(q.failurePct, 0)}%`);
  failVal.style.fontSize = '18px';
  const extrasCard = h('section', { class: 'card tight' },
    h('h2', { class: 'h2', style: 'margin-bottom:6px' }, 'Extras'),
    h('div', { class: 'row' },
      h('span', null, 'Packaging per item'),
      numField({ value: q.packagingPerItem, prefix: s.currency, label: 'Packaging per item', size: 5,
        onChange: (v) => { q.packagingPerItem = v || 0; changed(); } })),
    h('div', { class: 'row sep' },
      h('div', { class: 'col' }, h('span', null, 'Hardware per item'), h('span', { class: 'hint' }, 'Magnets, inserts, screws')),
      numField({ value: q.hardwarePerItem, prefix: s.currency, label: 'Hardware per item', size: 5,
        onChange: (v) => { q.hardwarePerItem = v || 0; changed(); } })),
    h('div', { class: 'col sep', style: 'gap:6px; padding-top:12px; border-top:1px solid var(--line)' },
      h('div', { class: 'card-h' },
        h('div', { class: 'col' }, h('span', null, 'Failure buffer'), h('span', { class: 'hint' }, 'Covers prints that fail')),
        failVal),
      h('input', { type: 'range', min: 0, max: 30, step: 1, value: q.failurePct, 'aria-label': 'Failure buffer percent',
        oninput: (e) => { q.failurePct = Number(e.target.value); changed(); } })));

  // Profit
  const mode = q.profitMode;
  const affix = mode === 'markup' || mode === 'margin' ? { suffix: '%' }
    : mode === 'fixed' ? { prefix: s.currency } : { prefix: s.currency, suffix: '/hr' };
  const valueField = numField({ ...affix, value: q.profitValues[mode], big: true, label: 'Profit amount', size: 4,
    onChange: (v) => { q.profitValues[mode] = Math.max(0, v || 0); changed(); } });
  const bump = (dir) => {
    const v = Math.max(0, Math.round(((q.profitValues[mode] || 0) + dir * STEP[mode]) * 100) / 100);
    q.profitValues[mode] = v;
    valueField.querySelector('input').value = fmt(v, 2);
    changed();
  };
  const profitCard = h('section', { class: 'card' },
    h('h2', { class: 'h2' }, 'Profit'),
    seg(PROFIT_MODES, mode, (v) => { q.profitMode = v; restructure(); }, { accent: true, label: 'Profit mode' }),
    h('div', { class: 'row' },
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Lower', onclick: () => bump(-1), style: 'background:var(--surface2)' }, icon('minus')),
      h('div', { class: 'col', style: 'align-items:center' }, valueField,
        liveText('hint', (r) => profitHint(mode, q.profitValues[mode], r))),
      h('button', { type: 'button', class: 'icon-btn', 'aria-label': 'Raise', onclick: () => bump(1), style: 'background:var(--surface2)' }, icon('plus'))),
    h('div', { class: 'row sep', style: 'padding-top:4px' },
      h('span', null, 'Round up to .99'),
      toggle(q.roundTo99, (v) => { q.roundTo99 = v; changed(); }, 'Round up to .99')));

  // Selling & shipping
  const preset = byId(d.shipping, q.shippingPresetId);
  const sellCard = h('section', { class: 'card' },
    h('h2', { class: 'h2' }, 'Selling & shipping'),
    h('div', { class: 'grid2' }, d.channels.map((c) => h('button', {
      type: 'button', class: c.id === q.channelId ? 'tile on' : 'tile', 'aria-pressed': c.id === q.channelId ? 'true' : 'false',
      onclick: () => { q.channelId = c.id; restructure(); },
    }, h('span', { class: 'tile-name' }, c.name), h('span', { class: 'hint' }, channelLine(c))))),
    channel?.shipped ? [
      h('div', { class: 'col', style: 'gap:6px' },
        h('span', { class: 'hint' }, 'Shipping cost'),
        seg([['buyer', 'Buyer pays'], ['built_in', 'Built into price']], q.shippingMode,
          (v) => { q.shippingMode = v; restructure(); }, { label: 'Who pays shipping' })),
      h('label', { class: 'list-btn' },
        icon('box', 22),
        h('div', { class: 'grow col' },
          h('div', { class: 'select-wrap' },
            h('select', { class: 'select', 'aria-label': 'Shipping preset', onchange: (e) => {
              if (e.target.value === '__add') { ctx.go('#/library/shipping'); return; }
              q.shippingPresetId = e.target.value; restructure();
            } },
            d.shipping.map((p) => h('option', { value: p.id, selected: p.id === q.shippingPresetId }, p.name)),
            h('option', { value: '__add' }, 'Add or edit boxes…'))),
          preset?.cost == null ? h('span', { class: 'hint warn' }, 'Set this box cost in Library') : h('span', { class: 'hint' }, 'Postage + box, saved preset')),
        h('span', { class: 'disp', style: 'font-size:16px' }, preset?.cost != null ? money(preset.cost) : '—'),
        icon('chevR', 18)),
    ] : null);

  // Price bar
  const bar = h('div', { class: 'pricebar' },
    h('div', { class: 'col' },
      h('span', { class: 'hint' }, 'Price per item'),
      liveText('big', (r) => (r.error || r.cost <= 0 ? '—' : money(r.price))),
      (() => {
        const el = h('span', { class: 'profit' });
        live.push((r) => {
          el.classList.toggle('warn', !!r.error || r.profit < 0);
          el.textContent = r.error ? `Margin too high. Keep it under ${fmt(r.maxMargin, 0)}% here.`
            : r.cost <= 0 ? 'Enter grams and print time'
            : `Profit ${money(r.profit)} · ${fmt(r.margin, 0)}% margin`;
        });
        return el;
      })()),
    h('a', { class: 'btn primary', href: '#/breakdown' }, 'Breakdown', icon('chevR', 18)));

  const el = h('div', { class: 'screen' }, header,
    h('main', { class: 'stack' }, banner, printerCard, plateCard, filCard, timeCard, extrasCard, profitCard, sellCard),
    bar);
  refresh();
  return el;
}

function stat(value, label) {
  return h('div', { class: 'stat' }, h('b', null, value), h('span', null, label));
}

function tileField(label, field) {
  return h('div', { class: 'tile' }, h('span', { class: 'hint' }, label), field);
}

function stepper(q, key, changed) {
  const field = numField({ value: q[key], label: 'Items on this plate', size: 3, integer: true,
    onChange: (v) => { q[key] = Math.max(1, Math.floor(v || 1)); changed(); } });
  const input = field.querySelector('input');
  const set = (v) => { q[key] = Math.max(1, v); input.value = String(q[key]); changed(); };
  return h('div', { class: 'stepper' },
    h('button', { type: 'button', 'aria-label': 'One fewer item', onclick: () => set(q[key] - 1) }, icon('minus', 18)),
    field,
    h('button', { type: 'button', class: 'plus', 'aria-label': 'One more item', onclick: () => set(q[key] + 1) }, icon('plus', 18)));
}

function filamentRow(d, q, row, i, changed, restructure, ctx) {
  const fil = byId(d.filaments, row.filamentId);
  return h('div', { class: 'fil-row' },
    h('span', { class: 'dot', style: `background:${safeColor(fil?.colorHex)}` }),
    h('div', { class: 'grow col' },
      h('div', { class: 'select-wrap' },
        h('select', { class: 'select', 'aria-label': `Filament ${i + 1}`, onchange: (e) => {
          if (e.target.value === '__add') { ctx.go('#/library/filament'); return; }
          row.filamentId = e.target.value; restructure();
        } },
        fil ? null : h('option', { value: '', selected: true }, 'Pick a filament'),
        d.filaments.map((f) => h('option', { value: f.id, selected: f.id === row.filamentId }, f.name)),
        h('option', { value: '__add' }, 'Add a new filament…'))),
      fil?.pricePerKg != null
        ? h('span', { class: 'hint' }, `${money(fil.pricePerKg)} per kg`)
        : h('a', { class: 'hint warn', href: '#/library/filament' }, 'Set price in Library')),
    numField({ value: row.grams, suffix: 'g', label: `Grams of filament ${i + 1}`, size: 4,
      onChange: (v) => { row.grams = v || 0; changed(); } }),
    q.filaments.length > 1
      ? h('button', { type: 'button', class: 'icon-btn small flat', 'aria-label': `Remove filament ${i + 1}`,
        onclick: () => { q.filaments.splice(i, 1); restructure(); } }, icon('x', 18))
      : null);
}

export function safeColor(hex) {
  return /^#[0-9a-f]{6}$/i.test(hex || '') ? hex : '#64748B';
}

export function channelLine(c) {
  if (!c.feePct && !c.feeMin && !c.feeFlat) return c.shipped ? 'Shipped · no fees' : 'No fees';
  const parts = [];
  if (c.feePct) parts.push(`${fmt(c.feePct, 2)}% fee`);
  if (c.feeFlat) parts.push(`+ ${money(c.feeFlat)}`);
  return `${c.shipped ? 'Shipped · ' : ''}${parts.join(' ')}`;
}

function profitHint(mode, v, r) {
  if (mode === 'markup') return `profit = ${fmt(v || 0, 2)}% of your cost`;
  if (mode === 'margin') return `${fmt(v || 0, 2)}% of the price is profit`;
  if (mode === 'fixed') return `${money(v || 0)} profit per item`;
  return `${money(v || 0)} × ${fmt(r.printHours, 2)} print hrs per item`;
}

function moreMenu(ctx) {
  const d = store.data;
  const s = sheet('Quote options', h('div', { class: 'col' },
    h('button', { type: 'button', class: 'menu-btn', onclick: () => {
      d.draft = newDraft(d); save(); s.close(); ctx.go('#/quote'); ctx.rerender(); toast('Started a new quote');
    } }, icon('plus'), 'Start a new quote'),
    h('button', { type: 'button', class: 'menu-btn', onclick: () => {
      const r = computeQuote(toJob(d, d.draft));
      d.draft = { ...JSON.parse(JSON.stringify(d.draft)), id: null, name: `${d.draft.name} (copy)` };
      saveDraftAsQuote(d, r); s.close(); ctx.rerender(); toast('Saved a copy');
    } }, icon('copy'), 'Save as a copy')));
}
