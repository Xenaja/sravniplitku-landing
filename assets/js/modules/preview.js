/**
 * Режим превью.
 * На статичном хостинге (GitHub Pages) PHP не выполняется, а на странице
 * ещё стоят заглушки вместо контактов и рыба вместо отзывов. Поэтому здесь
 * форма показывает плашку вместо отправки, а страница закрывается
 * от индексации — чтобы черновик не всплыл в поиске по имени сервиса.
 */

import { config } from '../config.js';

let cached = null;

/** @returns {boolean} */
export function isPreview() {
  if (cached !== null) return cached;

  const { mode, hosts } = config.preview;

  if (mode === true || mode === false) {
    cached = mode;
  } else {
    const host = window.location.hostname;
    cached = hosts.some((h) => host === h || host.endsWith(`.${h}`));
  }

  return cached;
}

export function initPreview() {
  if (!isPreview() || !config.preview.noindex) return;

  // Ставим тег, только если его ещё нет: боевую разметку не трогаем
  if (document.querySelector('meta[name="robots"]')) return;

  const meta = document.createElement('meta');
  meta.name = 'robots';
  meta.content = 'noindex, nofollow';
  document.head.appendChild(meta);
}
