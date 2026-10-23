// Checks js/pricing.js against answers worked out separately in Python
// (tools/reference_quotes.py -> tests/fixtures/reference.json).
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { computeQuote, roundUpTo99 } from '../js/pricing.js';

const cases = JSON.parse(readFileSync(new URL('./fixtures/reference.json', import.meta.url)));
const close = (actual, expected, label) =>
  assert.ok(Math.abs(actual - expected) < 1e-6, `${label}: got ${actual}, expected ${expected}`);

for (const [name, { input, expected }] of Object.entries(cases)) {
  test(`matches Python reference: ${name}`, () => {
    const r = computeQuote(input);
    if (expected.error) {
      assert.equal(r.error, expected.error);
      return;
    }
    assert.equal(r.error, undefined);
    for (const k of ['material', 'electricity', 'wear', 'failure', 'labor']) close(r.lines[k], expected[k], k);
    for (const k of ['cost', 'printHoursPerItem', 'exactPrice', 'price', 'fee', 'profit', 'margin', 'buyerTotal']) {
      close(k === 'printHoursPerItem' ? r.printHours : r[k], expected[k], k);
    }
  });
}

test('the mockup phone stand comes out at $8.99 with $4.20 profit', () => {
  const r = computeQuote(cases.phone_stand_buyer_pays.input);
  assert.equal(r.price.toFixed(2), '8.99');
  assert.equal(r.profit.toFixed(2), '4.20');
  assert.equal(r.fee.toFixed(2), '1.45');
  assert.equal(r.buyerTotal.toFixed(2), '14.49');
});

test('slicer numbers for one item give the same answer as for the whole plate', () => {
  const plate = cases.phone_stand_buyer_pays.input;
  const oneItem = {
    ...plate,
    slicerBasis: 'item',
    printMinutes: plate.printMinutes / 4,
    filaments: plate.filaments.map((f) => ({ ...f, grams: f.grams / 4 })),
    purgeGrams: plate.purgeGrams / 4,
  };
  const a = computeQuote(plate);
  const b = computeQuote(oneItem);
  close(b.cost, a.cost, 'cost');
  assert.equal(b.price, a.price);
});

test('blank or bad inputs count as zero instead of breaking', () => {
  const r = computeQuote({
    itemsOnPlate: 0, slicerBasis: 'plate', printMinutes: NaN, filaments: [{ grams: -5, pricePerKg: null }],
    purgeGrams: undefined, printer: { watts: null, pricePaid: null, lifeHours: 0, upkeepPerHour: null },
    kwhRate: null, laborRate: null, setupMinPerPlate: 0, finishMinPerItem: 0, packagingPerItem: 0,
    hardwarePerItem: 0, failurePct: 10, profitMode: 'markup', profitValue: 100, roundTo99: true,
    channel: { feePct: 0, feeMin: 0, feeFlat: 0, shipped: false }, shippingMode: 'buyer', shippingCost: 0,
  });
  assert.equal(r.cost, 0);
  assert.equal(r.items, 1);
  assert.equal(r.price, 0.99);
});

test('rounding goes up to the next .99', () => {
  assert.equal(roundUpTo99(8.03), 8.99);
  assert.equal(roundUpTo99(9), 9.99);
  assert.equal(roundUpTo99(8.99), 8.99);
});
