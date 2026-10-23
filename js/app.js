// App shell: picks the screen from the address (#/quote, #/library/filament, ...) and draws the tab bar.
import { store, load, askToKeepData } from './store.js';
import { h, icon } from './ui.js';
import { renderQuote } from './screens/quote.js';
import { renderBreakdown } from './screens/breakdown.js';
import { renderHistory } from './screens/history.js';
import { renderLibrary } from './screens/library.js';
import { renderSettings } from './screens/settings.js';

const ROUTES = { quote: renderQuote, breakdown: renderBreakdown, history: renderHistory, library: renderLibrary, settings: renderSettings };
const TABS = [['quote', 'Quote', 'calc'], ['history', 'History', 'clock'], ['library', 'Library', 'layers'], ['settings', 'Settings', 'sliders']];

const app = document.getElementById('app');

function parseRoute() {
  const [name, sub] = location.hash.replace(/^#\/?/, '').split('/');
  return { name: ROUTES[name] ? name : 'quote', sub };
}

function tabBar(active) {
  return h('nav', { class: 'tabs', 'aria-label': 'Main' }, TABS.map(([name, label, ico]) =>
    h('a', { href: `#/${name}`, 'aria-current': name === active ? 'page' : null },
      h('span', { class: 'pill' }, icon(ico)), label)));
}

function render(keepScroll = false) {
  const y = window.scrollY;
  const { name, sub } = parseRoute();
  document.documentElement.dataset.theme = store.data.settings.theme;
  const ctx = {
    sub,
    rerender: () => render(true),
    go: (hash) => { if (location.hash === hash) render(); else location.hash = hash; },
  };
  const screen = ROUTES[name](ctx);
  const showNav = name !== 'breakdown';
  app.className = name === 'quote' ? 'with-bar' : showNav ? '' : 'no-nav';
  app.replaceChildren(screen, showNav ? tabBar(name) : '');
  window.scrollTo(0, keepScroll ? y : 0);
}

load();
window.addEventListener('hashchange', () => render());
// Saved settings may have been changed in another tab of the same app.
window.addEventListener('storage', () => { load(); render(true); });
render();
askToKeepData();

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
}
