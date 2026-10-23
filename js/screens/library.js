// Library: printers, filament and shipping boxes, set up once and reused by every quote.
import { h, icon, money, fmt, seg, editSheet, toast } from '../ui.js';
import { store, save, uid, byId } from '../store.js';
import { safeColor } from './quote.js';

const TABS = [['printers', 'Printers'], ['filament', 'Filament'], ['shipping', 'Shipping']];

export function renderLibrary(ctx) {
  const tab = TABS.some(([t]) => t === ctx.sub) ? ctx.sub : 'printers';
  const body = tab === 'printers' ? printers(ctx) : tab === 'filament' ? filaments(ctx) : shipping(ctx);
  return h('div', { class: 'screen' },
    h('header', { class: 'top', style: 'flex-direction:column; align-items:stretch; gap:14px' },
      h('h1', { class: 'title' }, 'Library'),
      seg(TABS, tab, (v) => ctx.go(`#/library/${v}`), { label: 'Library section' })),
    h('main', { class: 'stack' }, body));
}

const wearPerHour = (p) => (p.lifeHours > 0 ? (p.pricePaid || 0) / p.lifeHours : 0) + (p.upkeepPerHour || 0);
const shown = (v, text) => (v == null ? '—' : text);

function printers(ctx) {
  const d = store.data;
  const def = d.settings.defaultPrinterId;
  const edit = (p, isNew) => editSheet({
    title: isNew ? 'Add a printer' : p.name,
    item: { ...p, isDefault: p.id === def },
    fields: [
      { key: 'name', label: 'Name', type: 'text' },
      { key: 'note', label: 'Note', type: 'text', hint: 'For example "with AMS"' },
      { key: 'watts', label: 'Power while printing', type: 'number', suffix: 'W', hint: 'Estimate. A plug-in power meter gives the real number.' },
      { key: 'pricePaid', label: 'Price you paid', type: 'number', prefix: d.settings.currency },
      { key: 'lifeHours', label: 'Expected life', type: 'number', suffix: 'hrs', hint: 'Your estimate of print hours before it wears out' },
      { key: 'upkeepPerHour', label: 'Upkeep per hour', type: 'number', prefix: d.settings.currency, hint: 'Nozzles, belts, build plates' },
      { key: 'isDefault', label: 'Default printer', type: 'bool' },
    ],
    onSave: (v) => {
      const { isDefault, ...item } = v;
      item.name = (item.name || '').trim() || 'Printer';
      if (isNew) d.printers.push(item); else Object.assign(p, item);
      if (isDefault) d.settings.defaultPrinterId = item.id;
      save(); ctx.rerender(); toast('Saved');
    },
    onDelete: isNew || d.printers.length < 2 ? null : () => {
      if (!confirm(`Delete ${p.name}?`)) return false;
      d.printers = d.printers.filter((x) => x.id !== p.id);
      if (d.settings.defaultPrinterId === p.id) d.settings.defaultPrinterId = d.printers[0].id;
      if (d.draft.printerId === p.id) d.draft.printerId = d.settings.defaultPrinterId;
      save(); ctx.rerender(); toast('Deleted');
      return true;
    },
  });

  const cards = d.printers.map((p) => {
    const incomplete = p.watts == null || p.pricePaid == null;
    if (p.id !== def) {
      return h('button', { type: 'button', class: 'qcard', onclick: () => edit(p) },
        h('span', { class: 'qicon muted' }, icon('printer', 22)),
        h('span', { class: 'grow col' },
          h('span', { class: 'strong', style: 'font-size:16px' }, p.name),
          h('span', { class: incomplete ? 'hint warn' : 'hint' },
            incomplete ? 'Needs your price paid and power numbers' : `${money(wearPerHour(p))} wear per print hour`)),
        h('span', { style: 'color:var(--muted)' }, icon('chevR', 18)));
    }
    return h('section', { class: 'card selected', style: 'gap:14px' },
      h('div', { class: 'gap8', style: 'gap:12px' },
        h('span', { class: 'qicon', style: 'width:44px; height:44px' }, icon('printer', 22)),
        h('div', { class: 'grow col' },
          h('span', { class: 'strong', style: 'font-size:16px' }, p.name),
          p.note ? h('span', { class: 'hint' }, p.note) : null),
        h('span', { class: 'badge', style: 'font-size:11px; letter-spacing:0.06em; text-transform:uppercase' }, 'Default')),
      h('div', { class: 'grid2' },
        bigStat('Power while printing', shown(p.watts, `${fmt(p.watts, 0)} W`), 'est.'),
        bigStat('Price you paid', shown(p.pricePaid, money(p.pricePaid))),
        bigStat('Expected life', shown(p.lifeHours, `${Number(p.lifeHours).toLocaleString()} hrs`)),
        bigStat('Upkeep per hour', money(p.upkeepPerHour || 0))),
      h('div', { class: 'card-h', style: 'padding-top:12px; border-top:1px solid var(--line)' },
        h('span', { class: 'hint', style: 'font-size:14px' }, 'Wear cost'),
        h('span', { class: 'strong' }, h('span', { class: 'disp accent' }, money(wearPerHour(p))), ' per print hour')),
      h('button', { type: 'button', class: 'btn ghost', style: 'height:44px', onclick: () => edit(p) }, 'Edit'));
  });

  return [
    cards,
    h('button', { type: 'button', class: 'dashed tall', onclick: () =>
      edit({ id: uid(), name: '', note: '', watts: null, pricePaid: null, lifeHours: 5000, upkeepPerHour: 0 }, true) }, '+ Add a printer'),
    h('div', { class: 'tip' }, icon('info', 18),
      h('span', null, 'Power numbers start as estimates. A plug-in power meter gives you the real number for your printer.')),
  ];
}

function filaments(ctx) {
  const d = store.data;
  const edit = (f, isNew) => editSheet({
    title: isNew ? 'Add a filament' : f.name,
    item: f,
    fields: [
      { key: 'name', label: 'Name', type: 'text', hint: 'For example "PETG HF · Gray"' },
      { key: 'colorHex', label: 'Color', type: 'color' },
      { key: 'pricePerKg', label: 'Price per kg', type: 'number', prefix: d.settings.currency, hint: 'Spool price ÷ spool weight in kg' },
    ],
    onSave: (v) => {
      v.name = (v.name || '').trim() || 'Filament';
      if (isNew) d.filaments.push(v); else Object.assign(f, v);
      save(); ctx.rerender(); toast('Saved');
    },
    onDelete: isNew ? null : () => {
      if (!confirm(`Delete ${f.name}?`)) return false;
      d.filaments = d.filaments.filter((x) => x.id !== f.id);
      save(); ctx.rerender(); toast('Deleted');
      return true;
    },
  });
  return [
    d.filaments.length ? d.filaments.map((f) => h('button', { type: 'button', class: 'qcard', onclick: () => edit(f) },
      h('span', { class: 'dot', style: `width:32px; height:32px; background:${safeColor(f.colorHex)}` }),
      h('span', { class: 'grow col' },
        h('span', { class: 'strong', style: 'font-size:15px' }, f.name),
        f.pricePerKg == null ? h('span', { class: 'hint warn' }, 'Set the price') : h('span', { class: 'hint' }, `${money(f.pricePerKg)} per kg`)),
      h('span', { style: 'color:var(--muted)' }, icon('chevR', 18))))
      : h('p', { class: 'empty' }, 'No filament yet. Add the spools you use.'),
    h('button', { type: 'button', class: 'dashed tall', onclick: () =>
      edit({ id: uid(), name: '', colorHex: '#64748B', pricePerKg: null }, true) }, '+ Add a filament'),
  ];
}

function shipping(ctx) {
  const d = store.data;
  const edit = (s, isNew) => editSheet({
    title: isNew ? 'Add a box' : s.name,
    item: s,
    fields: [
      { key: 'name', label: 'Name', type: 'text', hint: 'For example "Small box" or "Padded mailer"' },
      { key: 'cost', label: 'Cost', type: 'number', prefix: d.settings.currency, hint: 'Postage plus the box or mailer' },
    ],
    onSave: (v) => {
      v.name = (v.name || '').trim() || 'Box';
      if (isNew) d.shipping.push(v); else Object.assign(s, v);
      if (!byId(d.shipping, d.draft.shippingPresetId)) d.draft.shippingPresetId = v.id;
      save(); ctx.rerender(); toast('Saved');
    },
    onDelete: isNew ? null : () => {
      if (!confirm(`Delete ${s.name}?`)) return false;
      d.shipping = d.shipping.filter((x) => x.id !== s.id);
      if (d.draft.shippingPresetId === s.id) d.draft.shippingPresetId = d.shipping[0]?.id ?? null;
      save(); ctx.rerender(); toast('Deleted');
      return true;
    },
  });
  return [
    d.shipping.length ? d.shipping.map((s) => h('button', { type: 'button', class: 'qcard', onclick: () => edit(s) },
      h('span', { class: 'qicon muted' }, icon('box', 22)),
      h('span', { class: 'grow col' },
        h('span', { class: 'strong', style: 'font-size:15px' }, s.name),
        s.cost == null ? h('span', { class: 'hint warn' }, 'Set the cost') : h('span', { class: 'hint' }, 'Postage + box')),
      h('span', { class: 'disp', style: 'font-size:17px' }, s.cost == null ? '—' : money(s.cost))))
      : h('p', { class: 'empty' }, 'No boxes yet. Add the ones you ship with.'),
    h('button', { type: 'button', class: 'dashed tall', onclick: () => edit({ id: uid(), name: '', cost: null }, true) }, '+ Add a box'),
  ];
}

function bigStat(label, value, tag) {
  return h('div', { class: 'stat', style: 'padding:12px; border-radius:14px' },
    h('span', { style: 'font-size:12px' }, label),
    h('b', { style: 'font-size:18px' }, value, tag && value !== '—' ? h('span', { style: 'font-size:12px; font-weight:500; margin-left:4px' }, tag) : null));
}
