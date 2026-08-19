/**
 * Видео страницы.
 *
 * Первый экран — короткая петля без звуковой дорожки. Она заводится сама,
 * но только если человек не попросил систему убрать анимацию: движущаяся
 * картинка рядом с заголовком мешает его читать.
 *
 * Родных controls у петли нет — вместо них кнопка на весь кадр. Так у
 * автоплея остаётся способ его остановить (этого требует доступность для
 * движения дольше пяти секунд), но панель проигрывателя не спорит с
 * кадром. Круг play виден, когда петля стоит; пока идёт — только при
 * наведении и с клавиатуры, чтобы было понятно, что кадр кликабелен.
 *
 * Промо грузится по требованию (preload="none" в разметке), поэтому делать
 * с ним ничего не нужно, кроме отметки о первом запуске.
 */

import { track } from './analytics.js';

const STILL = '(prefers-reduced-motion: reduce)';

export function initVideo() {
  const hero = document.querySelector('[data-video="hero"]');
  const toggle = document.querySelector('[data-video-toggle]');

  if (hero) {
    const still = window.matchMedia(STILL);

    /** Кнопка «нажата», когда петля стоит: тогда на кадре виден круг play */
    const sync = () => {
      if (!toggle) return;
      toggle.setAttribute('aria-pressed', String(hero.paused));
      toggle.setAttribute('aria-label', hero.paused ? 'Запустить видео' : 'Поставить видео на паузу');
    };

    const apply = () => {
      if (still.matches) {
        hero.pause();
      } else {
        // play() возвращает промис и отклоняется, если браузер счёл
        // автозапуск нежелательным. Это не ошибка: остаётся обложка.
        const started = hero.play();
        if (started) started.catch(() => {});
      }
      sync();
    };

    apply();
    still.addEventListener('change', apply);
    hero.addEventListener('play', sync);
    hero.addEventListener('pause', sync);

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (hero.paused) {
          const started = hero.play();
          if (started) started.catch(() => {});
        } else {
          hero.pause();
        }
      });
    }
  }

  document.querySelectorAll('[data-video-track]').forEach((video) => {
    // once: перемотка и пауза не должны считаться новыми просмотрами
    video.addEventListener('play', () => {
      track('video_play', { video: video.dataset.videoTrack });
    }, { once: true });
  });
}
