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

    // Подложка едет к выбранному сегменту (MOTION M4)
    const tabs_root = tabs[0].parentElement;
    const index = tabs.findIndex((tab) => tab.dataset.seg === segment);
    if (tabs_root && index >= 0) tabs_root.dataset.thumb = String(index);

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

  /**
   * Состояние живёт в хэше как id панели (panel-salon / panel-supplier).
   * Свой ключ вроде #segment=supplier сюда не годится: у секции уже есть
   * якорь #suppliers из меню, и его нельзя затирать. Идентификаторы панелей
   * заодно работают как обычные якоря.
   */
  function segFromHash() {
    const id = window.location.hash.slice(1);
    const panel = panels.find((p) => p.id === id);
    return panel ? panel.dataset.segPanel : null;
  }

  function panelIdFor(segment) {
    const panel = panels.find((p) => p.dataset.segPanel === segment);
    return panel ? panel.id : null;
  }

  tabs.forEach((tab) => {
    tab.addEventListener('click', () => {
      const id = panelIdFor(tab.dataset.seg);
      // replaceState, а не location.hash: иначе браузер прыгнет к панели
      // и засорит историю на каждом переключении
      if (id) window.history.replaceState(null, '', `#${id}`);
    });
  });

  window.addEventListener('hashchange', () => {
    const segment = segFromHash();
    if (segment) activate(segment);
  });

  const initial = segFromHash()
    || (tabs.find((tab) => tab.getAttribute('aria-selected') === 'true') || tabs[0]).dataset.seg;
  activate(initial);
}
