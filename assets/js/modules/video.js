/**
 * Видео страницы.
 *
 * Первый экран — короткая петля без звуковой дорожки. Она заводится сама,
 * но только если человек не попросил систему убрать анимацию: движущаяся
 * картинка рядом с заголовком мешает его читать. Атрибут autoplay остаётся
 * в разметке, чтобы петля работала и без скрипта, — здесь только выключение.
 *
 * Промо грузится по требованию (preload="none" в разметке), поэтому делать
 * с ним ничего не нужно, кроме отметки о первом запуске.
 */

import { track } from './analytics.js';

const STILL = '(prefers-reduced-motion: reduce)';

export function initVideo() {
  const hero = document.querySelector('[data-video="hero"]');

  if (hero) {
    const still = window.matchMedia(STILL);

    const apply = () => {
      if (still.matches) {
        hero.pause();
        // Без controls человек не смог бы её запустить обратно
        hero.setAttribute('controls', '');
      } else {
        // play() возвращает промис и отклоняется, если браузер счёл
        // автозапуск нежелательным. Это не ошибка: остаётся обложка.
        const started = hero.play();
        if (started) started.catch(() => {});
      }
    };

    apply();
    still.addEventListener('change', apply);
  }

  document.querySelectorAll('[data-video-track]').forEach((video) => {
    // once: перемотка и пауза не должны считаться новыми просмотрами
    video.addEventListener('play', () => {
      track('video_play', { video: video.dataset.videoTrack });
    }, { once: true });
  });
}
