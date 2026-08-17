/**
 * Рабочее демо.
 * Клик по верхней части сцены выбирает стену, по трапеции снизу — пол.
 * Клик по образцу применяет коллекцию к активной зоне.
 * Переключатель раскладки меняет рисунок укладки (только на стене —
 * пол в макете всегда вытянутый).
 */

import { getState, setState, subscribe } from './tile-state.js';
import { applyTile } from './tiles.js';
import { trackOnce } from './analytics.js';

const ZONE_LABELS = {
  wall: 'Активная зона — стена',
  floor: 'Активная зона — пол',
};

export function initDemoScene() {
  const root = document.querySelector('[data-demo]');
  if (!root) return;

  const wallEl = root.querySelector('[data-scene-wall]');
  const floorEl = root.querySelector('[data-scene-floor]');
  const labelEl = root.querySelector('[data-zone-label]');
  const zoneButtons = [...root.querySelectorAll('[data-zone]')];
  const swatchButtons = [...root.querySelectorAll('[data-tile]')];
  const layoutButtons = [...root.querySelectorAll('[data-layout]')];

  zoneButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setState({ zone: button.dataset.zone });
      trackOnce('demo_interact', { action: 'zone' });
    });
  });

  swatchButtons.forEach((button) => {
    button.addEventListener('click', () => {
      const slug = button.dataset.tile;
      const { zone } = getState();
      setState(zone === 'wall' ? { wall: slug } : { floor: slug });
      trackOnce('demo_interact', { action: 'tile' });
    });
  });

  layoutButtons.forEach((button) => {
    button.addEventListener('click', () => {
      setState({ layout: button.dataset.layout });
      trackOnce('demo_interact', { action: 'layout' });
    });
  });

  subscribe((state) => {
    applyTile(wallEl, state.wall);
    applyTile(floorEl, state.floor);

    // Раскладка читается из CSS по атрибуту на <body> — её видят обе сцены
    document.body.dataset.tileLayout = state.layout;

    if (labelEl) labelEl.textContent = ZONE_LABELS[state.zone];

    zoneButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.zone === state.zone));
    });

    // Образцы подсвечивают коллекцию той зоны, которая сейчас активна
    const activeTile = state.zone === 'wall' ? state.wall : state.floor;
    swatchButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.tile === activeTile));
    });

    layoutButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.layout === state.layout));
    });
  });
}
