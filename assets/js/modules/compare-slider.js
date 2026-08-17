/**
 * Шторка «было / стало».
 * Положение раздела пересчитывается от clientX относительно кадра
 * и зажимается в 4…96 %, чтобы обе половины всегда были видны.
 * Как в макете, шторка следует за указателем и без нажатия —
 * на тач-устройствах pointermove приходит только во время касания.
 *
 * Плитка справа — та же, что выбрана в демо: состояние общее на страницу.
 */

import { subscribe } from './tile-state.js';
import { applyTile } from './tiles.js';
import { trackOnce } from './analytics.js';

const MIN = 4;
const MAX = 96;
const STEP = 2;

export function initCompareSlider() {
  const root = document.querySelector('[data-compare]');
  if (!root) return;

  const wallEl = root.querySelector('[data-compare-wall]');
  const floorEl = root.querySelector('[data-compare-floor]');
  const knob = root.querySelector('[data-compare-knob]');

  let split = 52;
  let frame = null;

  const clamp = (value) => Math.max(MIN, Math.min(MAX, value));

  function render() {
    frame = null;
    root.style.setProperty('--split', `${split}%`);
    if (knob) {
      const rounded = Math.round(split);
      knob.setAttribute('aria-valuenow', String(rounded));
      knob.setAttribute('aria-valuetext', `${rounded} процентов`);
    }
  }

  function setSplit(value) {
    const next = clamp(value);
    if (next === split) return;
    split = next;
    // Указатель шлёт события чаще, чем браузер рисует кадры
    if (frame === null) frame = requestAnimationFrame(render);
  }

  function fromPointer(event) {
    const rect = root.getBoundingClientRect();
    if (!rect.width) return;
    setSplit(((event.clientX - rect.left) / rect.width) * 100);
    trackOnce('demo_interact', { action: 'compare' });
  }

  root.addEventListener('pointerdown', fromPointer);
  root.addEventListener('pointermove', fromPointer);

  if (knob) {
    knob.addEventListener('keydown', (event) => {
      const moves = {
        ArrowLeft: -STEP,
        ArrowDown: -STEP,
        ArrowRight: STEP,
        ArrowUp: STEP,
        PageDown: -STEP * 5,
        PageUp: STEP * 5,
      };

      if (event.key in moves) {
        setSplit(split + moves[event.key]);
      } else if (event.key === 'Home') {
        setSplit(MIN);
      } else if (event.key === 'End') {
        setSplit(MAX);
      } else {
        return;
      }

      event.preventDefault();
      trackOnce('demo_interact', { action: 'compare' });
    });
  }

  subscribe((state) => {
    applyTile(wallEl, state.wall);
    applyTile(floorEl, state.floor);
  });

  render();
}
