"""Reference pricing math, written separately from the app's JavaScript.

Run:  python tools/reference_quotes.py
It writes tests/fixtures/reference.json (inputs + expected answers). The JS
tests load that file and check that js/pricing.js gives the same numbers.
All job inputs below are SAMPLE values for testing, not real prices.
"""
import json
import math
import pathlib


def round_up_99(price):
    cents = round(price * 100)
    return (cents // 100 * 100 + 99) / 100


def round_up_cents(price):
    return math.ceil(round(price * 100, 6)) / 100


def fee_for(price, ship_buyer, ch):
    pct = ch["feePct"] / 100
    if pct == 0 and ch["feeMin"] == 0 and ch["feeFlat"] == 0:
        return 0.0
    return max(pct * (price + ship_buyer), ch["feeMin"]) + ch["feeFlat"]


def quote(j):
    items = max(1, int(j["itemsOnPlate"]))
    per_item = 1.0 if j["slicerBasis"] == "item" else 1.0 / items
    print_hours = j["printMinutes"] / 60 * per_item

    color_grams = sum(f["grams"] for f in j["filaments"])
    color_cost = sum(f["grams"] / 1000 * f["pricePerKg"] for f in j["filaments"])
    avg_per_kg = color_cost / color_grams * 1000 if color_grams > 0 else 0.0
    material = (color_cost + j["purgeGrams"] / 1000 * avg_per_kg) * per_item

    p = j["printer"]
    electricity = p["watts"] / 1000 * print_hours * j["kwhRate"]
    wear_per_hour = (p["pricePaid"] / p["lifeHours"] if p["lifeHours"] > 0 else 0.0) + p["upkeepPerHour"]
    wear = wear_per_hour * print_hours
    failure = (material + electricity + wear) * j["failurePct"] / 100
    labor = (j["setupMinPerPlate"] / items + j["finishMinPerItem"]) / 60 * j["laborRate"]
    cost = material + electricity + wear + failure + labor + j["packagingPerItem"] + j["hardwarePerItem"]

    ch = j["channel"]
    ship_in = ship_buyer = 0.0
    if ch["shipped"]:
        if j["shippingMode"] == "built_in":
            ship_in = j["shippingCost"]
        else:
            ship_buyer = j["shippingCost"]

    f, fmin, flat = ch["feePct"] / 100, ch["feeMin"], ch["feeFlat"]
    base = cost + ship_in + flat
    mode, v = j["profitMode"], j["profitValue"]
    if mode == "margin":
        m = v / 100
        if m >= 1 - f:
            return {"error": "margin_too_high"}
        exact = (base + f * ship_buyer) / (1 - f - m)
        if f * (exact + ship_buyer) < fmin:
            exact = (base + fmin) / (1 - m)
    else:
        target = {"markup": cost * v / 100, "fixed": v, "hourly": v * print_hours}[mode]
        exact = (base + target + f * ship_buyer) / (1 - f)
        if f * (exact + ship_buyer) < fmin:
            exact = base + target + fmin

    price = round_up_99(exact) if j["roundTo99"] else round_up_cents(exact)
    fee = fee_for(price, ship_buyer, ch)
    profit = price - fee - ship_in - cost
    return {
        "material": material, "electricity": electricity, "wear": wear,
        "failure": failure, "labor": labor, "cost": cost,
        "printHoursPerItem": print_hours, "exactPrice": exact, "price": price,
        "fee": fee, "profit": profit, "margin": profit / price * 100,
        "buyerTotal": price + ship_buyer,
    }


P1S = {"watts": 120, "pricePaid": 499, "lifeHours": 5000, "upkeepPerHour": 0.03}
FB = {"feePct": 10, "feeMin": 0.80, "feeFlat": 0, "shipped": True}
LOCAL = {"feePct": 0, "feeMin": 0, "feeFlat": 0, "shipped": False}

PHONE_STAND = {
    "itemsOnPlate": 4, "slicerBasis": "plate", "printMinutes": 340,
    "filaments": [{"grams": 168, "pricePerKg": 19.99}, {"grams": 24, "pricePerKg": 19.99}],
    "purgeGrams": 18, "printer": P1S, "kwhRate": 0.16, "laborRate": 20,
    "setupMinPerPlate": 6, "finishMinPerItem": 3, "packagingPerItem": 0.45,
    "hardwarePerItem": 0, "failurePct": 10, "profitMode": "markup", "profitValue": 100,
    "roundTo99": True, "channel": FB, "shippingMode": "buyer", "shippingCost": 5.50,
}


def variant(base, **changes):
    j = json.loads(json.dumps(base))
    j.update(changes)
    return j


CASES = {
    "phone_stand_buyer_pays": PHONE_STAND,
    "phone_stand_built_in": variant(PHONE_STAND, shippingMode="built_in"),
    "phone_stand_local": variant(PHONE_STAND, channel=LOCAL),
    "phone_stand_hourly": variant(PHONE_STAND, profitMode="hourly", profitValue=3),
    "phone_stand_no_rounding": variant(PHONE_STAND, roundTo99=False),
    "cable_clips_local": variant(
        PHONE_STAND, itemsOnPlate=24, printMinutes=170, filaments=[{"grams": 96, "pricePerKg": 19.99}],
        purgeGrams=0, finishMinPerItem=0.5, packagingPerItem=0.10, failurePct=5,
        profitValue=150, channel=LOCAL),
    "cable_clip_fee_minimum": variant(
        PHONE_STAND, itemsOnPlate=24, printMinutes=170, filaments=[{"grams": 96, "pricePerKg": 19.99}],
        purgeGrams=0, finishMinPerItem=0.5, packagingPerItem=0.10, failurePct=5,
        profitValue=150, shippingCost=0),
    "planter_margin_built_in": variant(
        PHONE_STAND, itemsOnPlate=1, printMinutes=550, filaments=[{"grams": 310, "pricePerKg": 24.99}],
        purgeGrams=0, finishMinPerItem=8, packagingPerItem=0.90, profitMode="margin",
        profitValue=50, shippingMode="built_in", shippingCost=8.20),
    "keychain_fixed_local": variant(
        PHONE_STAND, itemsOnPlate=12, printMinutes=115, filaments=[{"grams": 60, "pricePerKg": 19.99}],
        purgeGrams=0, finishMinPerItem=1, packagingPerItem=0.15, failurePct=5,
        profitMode="fixed", profitValue=2, channel=LOCAL),
    "margin_too_high": variant(PHONE_STAND, profitMode="margin", profitValue=95),
}

if __name__ == "__main__":
    out = {name: {"input": job, "expected": quote(job)} for name, job in CASES.items()}
    path = pathlib.Path(__file__).resolve().parent.parent / "tests" / "fixtures" / "reference.json"
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(out, indent=2) + "\n")
    for name, c in out.items():
        e = c["expected"]
        if "error" in e:
            print(f"{name:26} error: {e['error']}")
        else:
            print(f"{name:26} cost {e['cost']:6.2f}  price {e['price']:6.2f}  fee {e['fee']:5.2f}  "
                  f"profit {e['profit']:6.2f}  margin {e['margin']:3.0f}%  buyer {e['buyerTotal']:6.2f}")
    print(f"wrote {path}")
