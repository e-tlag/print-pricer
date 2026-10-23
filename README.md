# Print Pricer

A personal app for pricing 3D prints. It counts filament (per AMS color plus purge),
electricity, printer wear, your time, packaging, hardware, a failure buffer, selling fees
and shipping, then gives a price per item using markup, margin, a fixed profit, or
profit per print hour.

It's a home-screen web app: you open it once in Chrome on your phone, add it to the home
screen, and from then on it opens full-screen like any other app, even with no signal.
Everything you enter is saved on your phone only. There's no account and no server.

---

## Put it on your phone (about 15 minutes, once)

The app needs a web address your phone can reach. GitHub Pages hosts it for free. These
steps publish the app's code (not your prices or quotes, which never leave your phone),
so you do them yourself.

### 1. Make a GitHub account and an empty repository
1. Sign up or sign in at <https://github.com>.
2. Click **+** (top right) → **New repository**.
3. Name it `print-pricer`, choose **Public** (free Pages needs a public repository),
   and leave "Add a README" **unticked**. Click **Create repository**.

### 2. Upload the app from this PC
Open a terminal in this folder (`Documents\print-pricer`) and run these, replacing
`YOUR-NAME` with your GitHub username:

```bash
git remote add origin https://github.com/YOUR-NAME/print-pricer.git
```

```bash
git push -u origin main
```

Git will open a browser window to sign in to GitHub the first time.

### 3. Turn on GitHub Pages
1. On the repository page: **Settings** → **Pages** (left menu).
2. Under **Build and deployment**, set **Source** to **Deploy from a branch**,
   branch **main**, folder **/ (root)**. Click **Save**.
3. Wait a minute or two, then refresh. The page shows your app's address:
   `https://YOUR-NAME.github.io/print-pricer/`

### 4. Install it on your Android phone
1. Open that address in **Chrome** on your phone.
2. Tap **⋮** (top right) → **Add to Home screen** → **Install**.
3. The Print Pricer icon appears on your home screen. Open it from there.

## First-time setup in the app

A card at the top of the Quote screen lists anything still missing. Fill these in once:

| Where | What | Why |
|---|---|---|
| Settings | Electricity rate ($ per kWh) | From your power bill |
| Settings | Your hourly rate | Prices your setup and finishing time |
| Library → Printers | P1S price you paid; P2S power and price | Printer wear cost per hour |
| Library → Filament | Each spool's price per kg (spool price ÷ weight in kg) | Filament cost |
| Library → Shipping | Each box's cost (postage + box) | Shipping cost |

**Estimates to check:**
- **P1S power.** The 120 W starting value is an estimate from a published test printing PLA. A plug-in power meter gives your real number.
- **Expected printer life.** The 5,000 hours is a guess.
- **FB Marketplace fee.** The 10% fee ($0.80 minimum) comes from third-party guides checked on 2026-10-23. Confirm it on FB's fee screen when you list, and edit it in Settings → Selling fees.

## Keep your data safe

Your data lives only in Chrome on your phone. Uninstalling the app or clearing Chrome's
site data erases it. Now and then, use **Settings → Back up** to save a backup file
(keep it in Google Drive or email it to yourself). **Restore** loads it back, even on a
new phone. **Export quotes to a spreadsheet** saves a CSV you can open in Google Sheets or Excel.

## Updating the app later

After a change, upload it again from this folder:

```bash
git push
```

The phone picks up the new version the next time you open the app with a signal.

---

## For tinkering

| Path | What it is |
|---|---|
| `index.html`, `css/app.css` | The page and its look (Midnight & Electric Teal) |
| `js/pricing.js` | All the price math, with no screen code |
| `js/store.js` | What's saved on the phone, starting values, backups |
| `js/screens/*.js` | Quote, Breakdown, History, Library, Settings |
| `sw.js`, `manifest.webmanifest`, `icons/` | Offline support, app name and icon |
| `tools/reference_quotes.py` | The same math written in Python, used to check the app |
| `tools/make_icons.py` | Draws the icons |
| `tests/` | Math tests |

Run the math tests (needs Node.js):

```bash
npm test
```

If you change the math, update `tools/reference_quotes.py` to match, then run
`python tools/reference_quotes.py` to refresh the expected answers before running the tests.

Preview on this PC:

```bash
python -m http.server 8080
```

Then open <http://localhost:8080>.

If you add or rename a file under `js/`, `css/` or `icons/`, add it to `APP_FILES` in
`sw.js` and bump `VERSION`, so offline mode includes it.
