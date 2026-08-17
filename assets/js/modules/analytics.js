/**
 * Аналитика.
 * Один вход track() раскладывает событие по всем подключённым счётчикам.
 * Счётчиков может не быть — тогда модуль тихо ничего не делает.
 */

import { config } from '../config.js';

const firedOnce = new Set();

/**
 * @param {string} name  Имя цели: demo_click, demo_interact, lead_form_submit,
 *                       trial_request, supplier_request
 * @param {object} [payload]
 */
export function track(name, payload = {}) {
  if (!config.analytics.enabled || !name) return;

  window.dataLayer = window.dataLayer || [];
  window.dataLayer.push({ event: name, ...payload });

  const counterId = config.analytics.yandexCounterId;
  if (counterId && typeof window.ym === 'function') {
    window.ym(counterId, 'reachGoal', name, payload);
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', name, payload);
  }

  if (config.analytics.debug) {
    console.info('[analytics]', name, payload);
  }
}

/** Событие «первое взаимодействие» имеет смысл считать один раз за сессию. */
export function trackOnce(name, payload = {}) {
  if (firedOnce.has(name)) return;
  firedOnce.add(name);
  track(name, payload);
}

/**
 * Декларативные цели: элемент с data-track="имя_цели" сам себя отправляет.
 * Дополнительный контекст — data-track-place.
 */
export function initAnalytics() {
  document.addEventListener('click', (event) => {
    const el = event.target.closest('[data-track]');
    if (!el) return;
    track(el.dataset.track, { place: el.dataset.trackPlace || 'unknown' });
  });
}
