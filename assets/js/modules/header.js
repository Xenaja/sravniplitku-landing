/**
 * Состояние липкой шапки (U1b).
 * На первом экране шапка прозрачная — логотип, меню и действие видны
 * с загрузки, но фон не спорит с первым экраном. После 24px прокрутки
 * включается стекло и граница.
 *
 * Сдвига вёрстки при этом нет: граница изначально прозрачная, а не
 * отсутствующая, поэтому высота шапки не меняется.
 */

const THRESHOLD = 24;

export function initHeader() {
  const header = document.querySelector('.header');
  if (!header) return;

  let queued = false;

  function apply() {
    queued = false;
    header.classList.toggle('header--scrolled', window.scrollY > THRESHOLD);
  }

  window.addEventListener('scroll', () => {
    // Скролл приходит чаще, чем браузер рисует кадры
    if (queued) return;
    queued = true;
    requestAnimationFrame(apply);
  }, { passive: true });

  // Страницу могли открыть по якорю или восстановить позицию прокрутки
  apply();
}
