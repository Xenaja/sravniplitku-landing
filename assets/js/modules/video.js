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
 * Свои контролы лежат поверх кадра на градиенте: тёмная обойма под кадром
 * съедала ~120px высоты, а градиент даёт контраст, не пряча продукт.
 * Перемотка — обычный input[type=range]: перетаскивание и стрелки
 * с клавиатуры достаются от браузера, а не пишутся руками.
 *
 * Полный экран открывается только подписанной кнопкой панели. На кадр он
 * не повешен намеренно: клик по кадру уже значит play/pause, и одно
 * действие не может значить два разных.
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
  const toggles = shell.querySelectorAll('[data-player-toggle]');
  const seek = shell.querySelector('[data-player-seek]');
  const current = shell.querySelector('[data-player-current]');
  const total = shell.querySelector('[data-player-total]');
  const mute = shell.querySelector('[data-player-mute]');
  const full = shell.querySelector('[data-player-full]');
  if (!video) return;

  const SEEK_MAX = seek ? Number(seek.max) : 1000;
  let scrubbing = false;

  function setPlaying(playing) {
    shell.toggleAttribute('data-playing', playing);
    toggles.forEach((el) => {
      el.setAttribute('aria-label', playing ? 'Поставить видео на паузу' : 'Запустить видео');
    });
  }

  function togglePlay() {
    if (video.paused) {
      const started = video.play();
      if (started) started.catch(() => {});
    } else {
      video.pause();
    }
  }

  toggles.forEach((el) => el.addEventListener('click', togglePlay));

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

  /* ---------- панель прячется на ходу ---------- */

  const IDLE_MS = 2500;
  let idleTimer = 0;

  function rest() {
    const active = document.activeElement;
    // Панель с клавиатурным фокусом внутри не прячем: иначе обход табом
    // теряет активную кнопку. Фокус от мыши при этом не в счёт — клик
    // по кадру наводит фокус на кнопку-вуаль, и панель не пряталась бы
    // никогда. Отличает их :focus-visible.
    if (shell.contains(active)) {
      let byKeyboard = true;
      try { byKeyboard = active.matches(':focus-visible'); } catch { /* старый браузер */ }
      if (byKeyboard) return;
    }
    shell.setAttribute('data-idle', '');
  }

  function wake() {
    shell.removeAttribute('data-idle');
    clearTimeout(idleTimer);
    // На паузе прятать нечего — панель остаётся
    if (video.paused) return;
    idleTimer = setTimeout(rest, IDLE_MS);
  }

  shell.addEventListener('pointermove', wake);
  shell.addEventListener('pointerdown', wake);
  shell.addEventListener('focusin', wake);
  shell.addEventListener('pointerleave', () => {
    clearTimeout(idleTimer);
    if (!video.paused) rest();
  });
  video.addEventListener('play', wake);
  video.addEventListener('pause', wake);

  /* ---------- звук ---------- */

  if (mute) {
    // Имя кнопки постоянное, состояние несёт aria-pressed: менять
    // и то и другое разом — верный способ запутать скринридер
    const syncMute = () => {
      mute.textContent = video.muted ? 'Звук выкл' : 'Звук вкл';
      mute.setAttribute('aria-pressed', String(!video.muted));
    };

    mute.addEventListener('click', () => {
      video.muted = !video.muted;
    });

    video.addEventListener('volumechange', syncMute);
    syncMute();
  }

  /* ---------- полный экран ---------- */

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

    // Выход бывает и мимо кнопки — Escape, системный жест, F11.
    // Состояние берём у документа, а не помним своё.
    const syncFull = () => {
      const on = document.fullscreenElement === shell;
      full.setAttribute('aria-pressed', String(on));
      full.setAttribute('aria-label', on ? 'Выйти из полного экрана' : 'На весь экран');
    };

    document.addEventListener('fullscreenchange', syncFull);
    document.addEventListener('webkitfullscreenchange', syncFull);
    syncFull();
  }
}
