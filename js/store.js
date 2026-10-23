// Everything the app remembers. Kept in this phone's browser storage only.
const KEY = 'print-pricer:v1';

export const uid = () =>
  (globalThis.crypto?.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

export const byId = (list, id) => list.find((x) => x.id === id);

// Starting data. Numbers left as null are the user's own (their power bill,
// what they paid); the app asks for them instead of guessing.
export function defaults() {
  return {
    version: 1,
    settings: {
      currency: '$',
      kwhRate: null,
      laborRate: null,
      failurePct: 10,
      roundTo99: true,
      profitMode: 'markup',
      profitValues: { markup: 100, margin: 50, fixed: 5, hourly: 3 },
      defaultChannelId: 'fb-shipped',
      defaultPrinterId: 'p1s',
      theme: 'teal',
    },
    printers: [
      // 120 W is an estimate from a published P1S test printing PLA; edit to match a power meter.
      { id: 'p1s', name: 'Bambu Lab P1S', note: 'with AMS', watts: 120, pricePaid: null, lifeHours: 5000, upkeepPerHour: 0 },
      { id: 'p2s', name: 'Bambu Lab P2S', note: '', watts: null, pricePaid: null, lifeHours: 5000, upkeepPerHour: 0 },
    ],
    filaments: [
      { id: 'pla-black', name: 'PLA Basic · Black', colorHex: '#1C1C1E', pricePerKg: null },
    ],
    shipping: [
      { id: 'small-box', name: 'Small box', cost: null },
    ],
    channels: [
      { id: 'local', name: 'Local pickup', note: 'Cash, Venmo, in person', feePct: 0, feeMin: 0, feeFlat: 0, shipped: false },
      // FB fee from third-party guides (checked 2026-10-23); confirm in the FB app.
      { id: 'fb-shipped', name: 'FB Marketplace', note: 'Shipped. Check FB for the current fee', feePct: 10, feeMin: 0.8, feeFlat: 0, shipped: true },
    ],
    quotes: [],
    draft: null,
  };
}

export function newDraft(d) {
  const s = d.settings;
  return {
    id: null,
    name: 'New quote',
    printerId: byId(d.printers, s.defaultPrinterId) ? s.defaultPrinterId : d.printers[0]?.id ?? null,
    itemsOnPlate: 1,
    printMinutes: 0,
    slicerBasis: 'plate',
    filaments: [{ filamentId: d.filaments[0]?.id ?? null, grams: 0 }],
    purgeGrams: 0,
    setupMinPerPlate: 0,
    finishMinPerItem: 0,
    packagingPerItem: 0,
    hardwarePerItem: 0,
    failurePct: s.failurePct,
    profitMode: s.profitMode,
    profitValues: { ...s.profitValues },
    roundTo99: s.roundTo99,
    channelId: byId(d.channels, s.defaultChannelId) ? s.defaultChannelId : d.channels[0]?.id ?? null,
    shippingMode: 'buyer',
    shippingPresetId: d.shipping[0]?.id ?? null,
  };
}

// Fill in anything missing (older backups, first run) from the defaults.
function normalize(raw) {
  const base = defaults();
  const d = { ...base, ...(raw && typeof raw === 'object' ? raw : {}) };
  d.settings = { ...base.settings, ...(d.settings || {}) };
  d.settings.profitValues = { ...base.settings.profitValues, ...(d.settings.profitValues || {}) };
  for (const k of ['printers', 'filaments', 'shipping', 'channels', 'quotes']) {
    if (!Array.isArray(d[k])) d[k] = base[k];
  }
  if (!d.printers.length) d.printers = base.printers;
  if (!d.channels.length) d.channels = base.channels;
  if (!d.draft || typeof d.draft !== 'object') d.draft = newDraft(d);
  return d;
}

export const store = { data: null };

export function load() {
  let raw = null;
  try {
    raw = JSON.parse(localStorage.getItem(KEY));
  } catch {
    raw = null;
  }
  store.data = normalize(raw);
  return store.data;
}

export function save() {
  try {
    localStorage.setItem(KEY, JSON.stringify(store.data));
    return true;
  } catch {
    return false;
  }
}

let timer = null;
export function saveSoon() {
  clearTimeout(timer);
  timer = setTimeout(save, 300);
}

// Turn the draft (which points at library items by id) into plain numbers for pricing.js.
export function toJob(d, q) {
  const s = d.settings;
  const printer = byId(d.printers, q.printerId) || d.printers[0] || {};
  const channel = byId(d.channels, q.channelId) || d.channels[0] || { feePct: 0, feeMin: 0, feeFlat: 0, shipped: false };
  const preset = byId(d.shipping, q.shippingPresetId);
  return {
    itemsOnPlate: q.itemsOnPlate,
    slicerBasis: q.slicerBasis,
    printMinutes: q.printMinutes,
    filaments: q.filaments.map((r) => ({ grams: r.grams, pricePerKg: byId(d.filaments, r.filamentId)?.pricePerKg ?? 0 })),
    purgeGrams: q.purgeGrams,
    printer,
    kwhRate: s.kwhRate,
    laborRate: s.laborRate,
    setupMinPerPlate: q.setupMinPerPlate,
    finishMinPerItem: q.finishMinPerItem,
    packagingPerItem: q.packagingPerItem,
    hardwarePerItem: q.hardwarePerItem,
    failurePct: q.failurePct,
    profitMode: q.profitMode,
    profitValue: q.profitValues[q.profitMode],
    roundTo99: q.roundTo99,
    channel,
    shippingMode: q.shippingMode,
    shippingCost: preset?.cost ?? 0,
  };
}

// Numbers the user still needs to fill in before prices can be trusted.
export function missingSetup(d, q) {
  const out = [];
  const s = d.settings;
  if (s.kwhRate == null) out.push({ label: 'Electricity rate', href: '#/settings' });
  const p = byId(d.printers, q.printerId);
  if (p && (p.pricePaid == null || p.watts == null)) out.push({ label: `${p.name} details`, href: '#/library/printers' });
  if (q.filaments.some((r) => byId(d.filaments, r.filamentId)?.pricePerKg == null)) {
    out.push({ label: 'Filament price', href: '#/library/filament' });
  }
  const ch = byId(d.channels, q.channelId);
  if (ch?.shipped && byId(d.shipping, q.shippingPresetId)?.cost == null) {
    out.push({ label: 'Shipping box cost', href: '#/library/shipping' });
  }
  const usesLabor = q.setupMinPerPlate > 0 || q.finishMinPerItem > 0;
  if (usesLabor && s.laborRate == null) out.push({ label: 'Your hourly rate', href: '#/settings' });
  return out;
}

// Save the draft into History (new entry, or update the one it came from).
export function saveDraftAsQuote(d, result) {
  const q = d.draft;
  if (!q.id) q.id = uid();
  const ch = byId(d.channels, q.channelId);
  const entry = {
    id: q.id,
    savedAt: new Date().toISOString(),
    draft: JSON.parse(JSON.stringify(q)),
    summary: {
      price: result.error ? null : result.price,
      profit: result.error ? null : result.profit,
      margin: result.error ? null : result.margin,
      items: result.items,
      printerName: byId(d.printers, q.printerId)?.name ?? '',
      channelName: ch?.name ?? '',
      shipped: !!ch?.shipped,
      shippingMode: q.shippingMode,
    },
  };
  const i = d.quotes.findIndex((x) => x.id === q.id);
  if (i >= 0) d.quotes[i] = entry;
  else d.quotes.unshift(entry);
  save();
  return entry;
}

export function exportBackup() {
  return JSON.stringify({ app: 'print-pricer', exportedAt: new Date().toISOString(), data: store.data }, null, 2);
}

export function importBackup(text) {
  const parsed = JSON.parse(text);
  const data = parsed?.app === 'print-pricer' ? parsed.data : parsed;
  if (!data || typeof data !== 'object' || !Array.isArray(data.printers)) {
    throw new Error('This file is not a Print Pricer backup.');
  }
  store.data = normalize(data);
  save();
}

export async function askToKeepData() {
  try {
    if (navigator.storage?.persist) await navigator.storage.persist();
  } catch {
    // Not supported; data is still saved, just not protected from cleanup.
  }
}
