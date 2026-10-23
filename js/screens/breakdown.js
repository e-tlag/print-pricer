// Breakdown: why the price is what it is, per item or for the whole plate.
import { h, icon, iconBtn, money, fmt, seg, toast } from '../ui.js';
import { store, byId, toJob, saveDraftAsQuote } from '../store.js';
import { computeQuote } from '../pricing.js';

let view = 'item';

const LINE_NAMES = {
  labor: 'Your time (labor)', material: 'Filament', packaging: 'Packaging', wear: 'Printer wear',
  failure: 'Failure buffer', electricity: 'Electricity', hardware: 'Hardware',
};

export function renderBreakdown(ctx) {
  const d = store.data;
  const q = d.draft;
  const r = computeQuote(toJob(d, q));
  const printer = byId(d.printers, q.printerId);
  const channel = byId(d.channels, q.channelId) || d.channels[0];
  const k = view === 'plate' ? r.items : 1;

  const header = h('header', { class: 'top bar' },
    h('a', { href: '#/quote', class: 'icon-btn flat', 'aria-label': 'Back to quote', style: 'color:var(--text)' }, icon('chevL', 22)),
    h('span', { class: 'strong', style: 'font-size:16px' }, 'Price breakdown'),
    iconBtn('copy', 'Copy price summary', () => copySummary(q, r, channel), 'icon-btn flat'));

  if (r.error) {
    return h('div', { class: 'screen' }, header, h('main', { class: 'stack' },
      h('section', { class: 'card big' },
        h('span', { class: 'strong warn' }, 'This margin can’t work'),
        h('span', { class: 'hint' }, `With a ${fmt(channel.feePct, 2)}% fee, the margin has to stay under ${fmt(r.maxMargin, 0)}%.`),
        h('a', { class: 'btn ghost', href: '#/quote' }, 'Back to quote'))));
  }

  const meta = [q.name, `${r.items} per plate`, printer?.name?.replace(/^Bambu Lab /, 'Bambu ')].filter(Boolean).join(' · ');
  const shipLine = r.shipBuyer > 0 ? h('span', { style: 'font-size:14px' }, 'Buyer pays ', h('b', null, money(r.buyerTotal * k)),
    ` with ${money(r.shipBuyer * k)} shipping`)
    : r.shipIn > 0 ? h('span', { style: 'font-size:14px' }, `Includes ${money(r.shipIn * k)} shipping (free shipping)`)
    : h('span', { style: 'font-size:14px' }, channel?.shipped ? 'Shipping not set' : 'Local pickup, no shipping');

  const hero = h('section', { class: 'card big', style: 'gap:6px' },
    h('span', { class: 'hint', style: 'font-size:13px' }, meta),
    h('div', { class: 'gap8', style: 'align-items:baseline' },
      h('span', { class: 'hero-price' }, money(r.price * k)),
      h('span', { class: 'hint', style: 'font-size:15px' }, view === 'plate' ? `for ${r.items} items` : 'per item')),
    shipLine,
    q.roundTo99 && view === 'item' ? h('span', { class: 'hint' }, `Exact price ${money(r.exactPrice)}, rounded up to .99`) : null,
    h('div', { style: 'margin-top:10px' },
      seg([['item', 'Per item'], ['plate', `Whole plate (${r.items})`]], view, (v) => { view = v; ctx.rerender(); }, { label: 'Show per item or whole plate' })));

  // Donut: where the price goes
  const slices = [
    { label: 'Profit', value: r.profit, color: 'var(--accent)' },
    { label: 'Your cost', value: r.cost, color: 'var(--mid)' },
    { label: 'Shipping', value: r.shipIn, color: 'var(--muted)' },
    { label: 'Selling fee', value: r.fee, color: 'var(--dim)' },
  ].filter((x) => x.value > 0.0049);
  const donutCard = r.profit > 0 && r.price > 0
    ? h('section', { class: 'card big', style: 'flex-direction:row; align-items:center; gap:18px' },
      donut(slices, r.price, `${fmt(r.margin, 0)}%`),
      h('div', { class: 'col grow', style: 'gap:12px' }, slices.map((x) => h('div', { class: 'legend-row' },
        h('span', { class: 'swatch', style: `background:${x.color}` }),
        h('span', { class: 'grow' }, x.label),
        h('span', { class: 'disp', style: 'font-size:15px' }, money(x.value * k))))))
    : h('section', { class: 'card big' },
      h('span', { class: 'strong warn' }, r.price > 0 ? 'You lose money at this price' : 'Nothing to price yet'),
      h('span', { class: 'hint' }, r.price > 0 ? 'Raise the profit setting or lower costs on the Quote screen.' : 'Enter grams and print time on the Quote screen.'));

  // Cost bars, biggest first
  const lines = Object.entries(r.lines).filter(([, v]) => v > 0.0049).sort((a, b) => b[1] - a[1]);
  const top = lines[0]?.[1] || 1;
  const costCard = h('section', { class: 'card big', style: 'gap:14px' },
    h('div', { class: 'card-h' }, h('h2', { class: 'h2' }, 'Where your cost goes'), h('span', { class: 'strong' }, money(r.cost * k))),
    lines.length ? lines.map(([key, v]) => h('div', { class: 'col', style: 'gap:6px' },
      h('div', { class: 'card-h', style: 'font-size:14px' },
        h('span', null, key === 'failure' ? `${LINE_NAMES[key]} (${fmt(q.failurePct, 0)}%)` : LINE_NAMES[key]),
        h('span', { class: 'disp' }, money(v * k))),
      h('div', { class: 'bar-track', 'aria-hidden': 'true' },
        h('div', { class: 'bar-fill', style: `width:${Math.max(2, (v / top) * 100).toFixed(1)}%` }))))
      : h('span', { class: 'hint' }, 'No costs entered yet.'));

  // Compare with other ways of selling
  const alts = [];
  if (channel?.shipped) {
    const other = q.shippingMode === 'buyer' ? 'built_in' : 'buyer';
    alts.push({ name: other === 'built_in' ? 'Shipping built into price' : 'Buyer pays shipping', q: { ...q, shippingMode: other } });
  }
  for (const c of d.channels) {
    if (c.id === channel?.id) continue;
    const free = !c.feePct && !c.feeMin && !c.feeFlat;
    alts.push({ name: free ? `${c.name}, no fees` : c.name, q: { ...q, channelId: c.id } });
  }
  const compareCard = alts.length ? h('section', { class: 'card big tight' },
    h('h2', { class: 'h2', style: 'margin-bottom:8px' }, 'Compare'),
    alts.map((a, i) => {
      const ar = computeQuote(toJob(d, a.q));
      return h('div', { class: i ? 'row sep' : 'row', style: 'min-height:56px' },
        h('div', { class: 'col' },
          h('span', { class: 'strong', style: 'font-size:14px' }, a.name),
          h('span', { class: 'hint' }, ar.error ? 'Margin too high for this fee' : `Profit ${money(ar.profit * k)} · ${fmt(ar.margin, 0)}% margin`)),
        h('span', { class: 'disp', style: 'font-size:18px' }, ar.error ? '—' : money(ar.price * k)));
    })) : null;

  const actions = h('div', { class: 'grid2', style: 'gap:10px; padding-top:4px' },
    h('button', { type: 'button', class: 'btn ghost', onclick: () => copySummary(q, r, channel) }, 'Copy summary'),
    h('button', { type: 'button', class: 'btn primary', onclick: () => { saveDraftAsQuote(d, r); toast('Saved to History'); } }, 'Save quote'));

  return h('div', { class: 'screen' }, header, h('main', { class: 'stack' }, hero, donutCard, costCard, compareCard, actions));
}

function donut(slices, total, centerText) {
  const NS = 'http://www.w3.org/2000/svg';
  const C = 2 * Math.PI * 70;
  const svg = document.createElementNS(NS, 'svg');
  svg.setAttribute('width', '150');
  svg.setAttribute('height', '150');
  svg.setAttribute('viewBox', '0 0 180 180');
  svg.setAttribute('role', 'img');
  svg.setAttribute('aria-label', slices.map((x) => `${x.label} ${fmt((x.value / total) * 100, 0)}%`).join(', '));
  const g = document.createElementNS(NS, 'g');
  g.setAttribute('transform', 'rotate(-90 90 90)');
  g.setAttribute('fill', 'none');
  g.setAttribute('stroke-width', '22');
  const ring = (len, offset, color) => {
    const c = document.createElementNS(NS, 'circle');
    c.setAttribute('cx', '90'); c.setAttribute('cy', '90'); c.setAttribute('r', '70');
    c.setAttribute('stroke-dasharray', `${len} ${C}`);
    c.setAttribute('stroke-dashoffset', String(-offset));
    c.style.stroke = color;
    g.append(c);
  };
  ring(C, 0, 'var(--surface2)');
  let at = 0;
  for (const x of slices) {
    const len = (x.value / total) * C;
    ring(len, at, x.color);
    at += len;
  }
  svg.append(g);
  return h('div', { class: 'donut-wrap' }, svg,
    h('div', { class: 'donut-center' },
      h('span', { class: 'disp accent', style: 'font-size:30px; font-weight:700' }, centerText),
      h('span', { class: 'hint' }, 'margin')));
}

async function copySummary(q, r, channel) {
  if (r.error) { toast('Fix the margin first'); return; }
  const lines = [`${q.name}: ${money(r.price)} each`];
  if (r.shipBuyer > 0) lines.push(`Shipping: ${money(r.shipBuyer)} (total ${money(r.buyerTotal)})`);
  else if (r.shipIn > 0) lines.push('Free shipping');
  else if (!channel?.shipped) lines.push('Local pickup');
  const text = lines.join('\n');
  try {
    await navigator.clipboard.writeText(text);
    toast('Copied');
  } catch {
    toast('Could not copy on this device');
  }
}
