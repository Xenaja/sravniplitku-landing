/**
 * Видео страницы.
 *
 * Первый экран — короткая петля без звуковой дорожки. Она заводится сама,
 * но только если человек не попросил систему убрать анимацию: движущаяся
 * картинка рядом с заголовком мешает его читать. Родных controls у петли
 * нет — вместо них кнопка на весь кадр: у автоплея остаётся способ его
 * остановить, а панель проигрывателя не спорит с кадром.
 *
 * Большое видео тоже без родных controls: их чёрная полоса ложилась на
 * нижнюю треть кадра — ровно на ленту сцен, подсказку и кредит студии.
 * Свои контролы живут в тёмной обойме под кадром и продукт не закрывают.
 * Перемотка — обычный input[type=range]: перетаскивание и стрелки
 * с клавиатуры достаются от браузера, а не пишутся руками.
 */

import { track } from './analytics.js';

const STILL = '(prefers-reduced-motion: reduce)';

/** 95 → «1:35» */
function clock(seconds) {
  if (!Number.isFinite(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${String(s).padStart(2, '0')}`;
}

export function initVideo() {
  initHeroLoop();
  initPlayer();

  document.querySelectorAll('[data-video-track]').forEach((video) => {
    // once: перемотка и пауза не должны считаться новыми просмотрами
    video.addEventListener('play', () => {
      track('video_play', { video: video.dataset.videoTrack });
    }, { once: true });
  });
}

/* ---------- петля первого экрана ---------- */

function initHeroLoop() {
  const hero = document.querySelector('[data-video="hero"]');
  if (!hero) return;

  const toggle = document.querySelector('[data-video-toggle]');
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
      // play() отклоняется, если браузер счёл автозапуск нежелательным.
      // Это не ошибка: остаётся обложка.
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

/* ---------- большое видео со своими контролами ---------- */

function initPlayer() {
  const shell = document.querySelector('[data-player]');
  if (!shell) return;

  const video = shell.querySelector('video');
  const toggle = shell.querySelector('[data-player-toggle]');
  const seek = shell.querySelector('[data-player-seek]');
  const current = shell.querySelector('[data-player-current]');
  const total = shell.querySelector('[data-player-total]');
  const full = shell.querySelector('[data-player-full]');
  if (!video) return;

  const SEEK_MAX = seek ? Number(seek.max) : 1000;
  let scrubbing = false;

  function setPlaying(playing) {
    shell.toggleAttribute('data-playing', playing);
    if (toggle) toggle.setAttribute('aria-label', playing ? 'Поставить видео на паузу' : 'Запустить видео');
  }

  if (toggle) {
    toggle.addEventListener('click', () => {
      if (video.paused) {
        const started = video.play();
        if (started) started.catch(() => {});
      } else {
        video.pause();
      }
    });
  }

  video.addEventListener('play', () => setPlaying(true));
  video.addEventListener('pause', () => setPlaying(false));
  video.addEventListener('ended', () => setPlaying(false));

  // Длительность известна только после загрузки метаданных: у файла
  // preload="none", поэтому в разметке лежит значение по умолчанию
  video.addEventListener('loadedmetadata', () => {
    if (total) total.textContent = clock(video.duration);
  });

  video.addEventListener('timeupdate', () => {
    if (current) current.textContent = clock(video.currentTime);
    if (!seek || scrubbing || !Number.isFinite(video.duration) || !video.duration) return;
    const played = video.currentTime / video.duration;
    seek.value = String(Math.round(played * SEEK_MAX));
    seek.style.setProperty('--played', (played * 100).toFixed(2));
  });

  if (seek) {
    const jump = () => {
      if (!Number.isFinite(video.duration) || !video.duration) return;
      const played = Number(seek.value) / SEEK_MAX;
      video.currentTime = played * video.duration;
      seek.style.setProperty('--played', (played * 100).toFixed(2));
    };

    seek.addEventListener('pointerdown', () => { scrubbing = true; });
    seek.addEventListener('pointerup', () => { scrubbing = false; });
    seek.addEventListener('input', jump);
  }

  if (full) {
    full.addEventListener('click', () => {
      // Safari на iPhone не умеет полноэкранный режим у произвольного
      // элемента, зато умеет у самого video
      const target = shell.requestFullscreen ? shell : video;
      if (document.fullscreenElement) {
        document.exitFullscreen();
      } else if (target.requestFullscreen) {
        target.requestFullscreen().catch(() => {});
      } else if (video.webkitEnterFullscreen) {
        video.webkitEnterFullscreen();
      }
    });
  }
}
