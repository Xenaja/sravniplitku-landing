/**
 * Общее состояние плитки на страницу.
 * Демо-сцена и шторка «до/после» показывают одну и ту же выбранную коллекцию,
 * поэтому состояние живёт здесь, а не внутри компонентов.
 *
 * Значения по умолчанию продублированы классами в index.html — там они нужны,
 * чтобы страница выглядела правильно до загрузки скриптов. При изменении
 * дефолтов правьте оба места.
 */

/** @typedef {{ wall: string, floor: string, zone: 'wall'|'floor', layout: 'straight'|'long'|'diag' }} TileState */

/** @type {TileState} */
const state = {
  wall: 'carrara',
  floor: 'oak',
  zone: 'wall',
  layout: 'straight',
};

/** @type {Set<(s: TileState) => void>} */
const listeners = new Set();

/** @returns {TileState} копия — снаружи состояние не мутируют */
export function getState() {
  return { ...state };
}

/** @param {Partial<TileState>} patch */
export function setState(patch) {
  let changed = false;

  for (const [key, value] of Object.entries(patch)) {
    if (key in state && state[key] !== value) {
      state[key] = value;
      changed = true;
    }
  }

  if (changed) notify();
}

/**
 * Подписка сразу вызывает слушателя с текущим состоянием —
 * компоненту не нужно отдельно себя отрисовывать при инициализации.
 * @param {(s: TileState) => void} listener
 * @returns {() => void} отписка
 */
export function subscribe(listener) {
  listeners.add(listener);
  listener(getState());
  return () => listeners.delete(listener);
}

function notify() {
  const snapshot = getState();
  listeners.forEach((listener) => {
    try {
      listener(snapshot);
    } catch (error) {
      console.error('[tile-state] слушатель упал:', error);
    }
  });
}
