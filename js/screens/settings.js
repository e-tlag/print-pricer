import { h } from '../ui.js';

export function renderSettings() {
  return h('div', { class: 'screen' }, h('header', { class: 'top' }, h('h1', { class: 'title' }, 'Settings')));
}
