/**
 * Переключатель «Салонам / Поставщикам».
 * Обе панели лежат в разметке — так они видны поисковикам и работают
 * без скрипта; переключение только прячет неактивную.
 * Выбранный сегмент уезжает в скрытое поле формы лид-магнита.
 */

import { track } from './analytics.js';

export function initSegmentTabs() {
  const root = document.querySelector('[data-segment]');
  if (!root) return;

  const tabs = [...root.querySelectorAll('[data-seg]')];
  const panels = [...root.querySelectorAll('[data-seg-panel]')];
  const segmentField = document.querySelector('[data-lead-segment-field]');
  if (!tabs.length || !panels.length) return;

  function activate(segment, { focusTab = false } = {}) {
    tabs.forEach((tab) => {
      const selected = tab.dataset.seg === segment;
      tab.setAttribute('aria-selected', String(selected));
      tab.tabIndex = selected ? 0 : -1;
      if (selected && focusTab) tab.focus();
    });

    panels.forEach((panel) => {
      panel.hidden = panel.dataset.segPanel !== segment;
    });

    if (segmentField) segmentField.value = segment;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      activate(tab.dataset.seg);
      track('segment_switch', { segment: tab.dataset.seg });
    });
  });

  // Стрелками между вкладками — обычное поведение tablist
  root.addEventListener('keydown', (event) => {
    if (!tabs.includes(event.target)) return;

    const offset = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[event.key];
    if (!offset) return;

    const current = tabs.indexOf(event.target);
    const next = tabs[(current + offset + tabs.length) % tabs.length];
    activate(next.dataset.seg, { focusTab: true });
    event.preventDefault();
  });

  const initial = tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0];
  activate(initial.dataset.seg);
}
