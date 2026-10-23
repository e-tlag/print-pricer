// Saved quotes: search, reopen, duplicate or delete.
import { h, icon, iconBtn, money, fmt, sheet, toast } from '../ui.js';
import { store, save, uid } from '../store.js';

let filter = 'all';
let query = '';

export function renderHistory(ctx) {
  const d = store.data;
  const list = h('div', { class: 'col', style: 'gap:10px' });

  const draw = () => {
    const words = query.trim().toLowerCase();
    const items = d.quotes.filter((e) =>
      (filter === 'all' || (filter === 'shipped') === !!e.summary.shipped) &&
      (!words || e.draft.name.toLowerCase().includes(words)));
    list.replaceChildren(...(items.length ? items.map((e) => card(e, ctx))
      : [h('p', { class: 'empty' }, d.quotes.length ? 'No quotes match.' : 'No saved quotes yet. Tap the bookmark on the Quote screen to save one.')]));
  };

  const chips = h('div', { class: 'gap8' }, [['all', 'All'], ['shipped', 'Shipped'], ['local', 'Local']].map(([v, t]) =>
    h('button', { type: 'button', class: v === filter ? 'pill-chip on' : 'pill-chip', 'aria-pressed': v === filter ? 'true' : 'false',
      onclick: () => { filter = v; ctx.rerender(); } }, t)));

  const el = h('div', { class: 'screen' },
    h('header', { class: 'top', style: 'flex-direction:column; align-items:stretch; gap:14px' },
      h('div', { class: 'card-h' },
        h('h1', { class: 'title' }, 'Saved quotes'),
        h('span', { class: 'hint', style: 'font-size:13px' }, `${d.quotes.length} saved`)),
      h('label', { class: 'search' },
        h('span', { style: 'color:var(--muted)' }, icon('search', 18)),
        h('span', { class: 'sr' }, 'Search quotes'),
        h('input', { type: 'search', placeholder: 'Search quotes', value: query,
          oninput: (e) => { query = e.target.value; draw(); } })),
      chips),
    h('main', { class: 'stack' }, list,
      d.quotes.length ? h('span', { class: 'hint', style: 'text-align:center; padding-top:6px' },
        'Tap a quote to reopen it. Prices update to your current settings.') : null));
  draw();
  return el;
}

function card(e, ctx) {
  const s = e.summary;
  const where = s.shipped ? `${s.channelName}${s.shippingMode === 'built_in' ? ', free shipping' : ' shipped'}` : s.channelName;
  const meta = `${s.items} per plate · ${where}`;
  const date = new Date(e.savedAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return h('div', { class: 'qcard', style: 'padding:0; gap:0' },
    h('button', { type: 'button', class: 'grow', style: 'display:flex; align-items:center; gap:14px; padding:14px 4px 14px 14px; border:0; background:transparent; text-align:left; min-width:0',
      onclick: () => open(e, ctx, '#/breakdown') },
      h('span', { class: 'qicon' }, icon('cube', 22)),
      h('span', { class: 'grow col', style: 'gap:3px' },
        h('span', { class: 'strong', style: 'font-size:15px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap' }, e.draft.name),
        h('span', { class: 'hint' }, meta),
        h('span', { class: 'hint' }, `Saved ${date}`)),
      h('span', { class: 'col', style: 'align-items:flex-end; gap:3px' },
        h('span', { class: 'disp', style: 'font-size:18px' }, s.price == null ? '—' : money(s.price)),
        s.profit == null ? null : h('span', { class: s.profit < 0 ? 'hint warn strong' : 'hint accent strong' },
          `${s.profit < 0 ? '' : '+'}${money(s.profit)} · ${fmt(s.margin, 0)}%`))),
    iconBtn('dots', `Options for ${e.draft.name}`, () => options(e, ctx), 'icon-btn flat'));
}

function open(e, ctx, where) {
  store.data.draft = JSON.parse(JSON.stringify(e.draft));
  store.data.draft.id = e.id;
  save();
  ctx.go(where);
}

function options(e, ctx) {
  const d = store.data;
  const s = sheet(e.draft.name, h('div', { class: 'col' },
    h('button', { type: 'button', class: 'menu-btn', onclick: () => { s.close(); open(e, ctx, '#/quote'); } }, icon('calc'), 'Open and edit'),
    h('button', { type: 'button', class: 'menu-btn', onclick: () => {
      const copy = JSON.parse(JSON.stringify(e));
      copy.id = uid();
      copy.draft.id = copy.id;
      copy.draft.name = `${e.draft.name} (copy)`;
      copy.savedAt = new Date().toISOString();
      d.quotes.unshift(copy);
      save(); s.close(); ctx.rerender(); toast('Duplicated');
    } }, icon('copy'), 'Duplicate'),
    h('button', { type: 'button', class: 'menu-btn danger', onclick: () => {
      if (!confirm(`Delete "${e.draft.name}"?`)) return;
      d.quotes = d.quotes.filter((x) => x.id !== e.id);
      if (d.draft.id === e.id) d.draft.id = null;
      save(); s.close(); ctx.rerender(); toast('Deleted');
    } }, icon('trash'), 'Delete')));
}
