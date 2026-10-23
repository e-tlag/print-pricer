// Pricing math. Pure functions: no screen, no storage.
// Mirrors tools/reference_quotes.py; tests/pricing.test.js checks they agree.

const n = (x) => (typeof x === 'number' && Number.isFinite(x) && x > 0 ? x : 0);

export function roundUpTo99(price) {
  const cents = Math.round(price * 100);
  return (Math.floor(cents / 100) * 100 + 99) / 100;
}

export function roundUpToCent(price) {
  return Math.ceil(Math.round(price * 100 * 1e6) / 1e6) / 100;
}

export function feeFor(price, shipBuyer, ch) {
  const pct = n(ch.feePct) / 100;
  if (pct === 0 && n(ch.feeMin) === 0 && n(ch.feeFlat) === 0) return 0;
  return Math.max(pct * (price + shipBuyer), n(ch.feeMin)) + n(ch.feeFlat);
}

// One job, with everything already looked up (printer, filament prices, channel).
// Returns per-item numbers; multiply by itemsOnPlate for the whole plate.
export function computeQuote(j) {
  const items = Math.max(1, Math.floor(n(j.itemsOnPlate)) || 1);
  const perItem = j.slicerBasis === 'item' ? 1 : 1 / items;
  const printHours = n(j.printMinutes) / 60 * perItem;

  let colorGrams = 0;
  let colorCost = 0;
  for (const f of j.filaments) {
    colorGrams += n(f.grams);
    colorCost += n(f.grams) / 1000 * n(f.pricePerKg);
  }
  const avgPerKg = colorGrams > 0 ? colorCost / colorGrams * 1000 : 0;
  const material = (colorCost + n(j.purgeGrams) / 1000 * avgPerKg) * perItem;

  const p = j.printer;
  const electricity = n(p.watts) / 1000 * printHours * n(j.kwhRate);
  const wearPerHour = (n(p.lifeHours) > 0 ? n(p.pricePaid) / n(p.lifeHours) : 0) + n(p.upkeepPerHour);
  const wear = wearPerHour * printHours;
  const failure = (material + electricity + wear) * n(j.failurePct) / 100;
  const labor = (n(j.setupMinPerPlate) / items + n(j.finishMinPerItem)) / 60 * n(j.laborRate);
  const packaging = n(j.packagingPerItem);
  const hardware = n(j.hardwarePerItem);
  const cost = material + electricity + wear + failure + labor + packaging + hardware;

  const ch = j.channel;
  let shipIn = 0;
  let shipBuyer = 0;
  if (ch.shipped) {
    if (j.shippingMode === 'built_in') shipIn = n(j.shippingCost);
    else shipBuyer = n(j.shippingCost);
  }

  const lines = { material, electricity, wear, failure, labor, packaging, hardware };
  const base = { items, printHours, wearPerHour, lines, cost, shipIn, shipBuyer };

  const f = n(ch.feePct) / 100;
  const fmin = n(ch.feeMin);
  const flat = n(ch.feeFlat);
  const start = cost + shipIn + flat;
  const v = n(j.profitValue);
  let exact;
  if (j.profitMode === 'margin') {
    const m = v / 100;
    if (m >= 1 - f) return { ...base, error: 'margin_too_high', maxMargin: (1 - f) * 100 };
    exact = (start + f * shipBuyer) / (1 - f - m);
    if (f * (exact + shipBuyer) < fmin) exact = (start + fmin) / (1 - m);
  } else {
    const target = j.profitMode === 'fixed' ? v
      : j.profitMode === 'hourly' ? v * printHours
      : cost * v / 100;
    exact = (start + target + f * shipBuyer) / (1 - f);
    if (f * (exact + shipBuyer) < fmin) exact = start + target + fmin;
  }

  const price = j.roundTo99 ? roundUpTo99(exact) : roundUpToCent(exact);
  const fee = feeFor(price, shipBuyer, ch);
  const profit = price - fee - shipIn - cost;
  return {
    ...base,
    exactPrice: exact,
    price,
    fee,
    profit,
    margin: price > 0 ? profit / price * 100 : 0,
    buyerTotal: price + shipBuyer,
  };
}
