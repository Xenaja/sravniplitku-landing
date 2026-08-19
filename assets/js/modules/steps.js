/**
 * Блок «Пять действий»: закреплённый кадр и подсветка активного шага.
 *
 * Активным считается шаг, чей центр ближе всего к центру экрана.
 * Наивный вариант — реагировать на isIntersecting — на быстром скролле
 * записывает состояние из последней записи пачки, и подсвечивается
 * не тот шаг: один и тот же конечный офсет даёт разный результат
 * в зависимости от скорости прокрутки.
 *
 * Скролл не перехватывается: секция не «залипает» и не управляет
 * колесом, страница листается как обычно.
 *
 * Ниже 768 sticky выключен стилями — там у каждого шага свой кадр,
 * и подсветка не нужна, но она и не мешает.
 */

const STILL = '(prefers-reduced-motion: reduce)';

export function initSteps() {
  const root = document.querySelector('[data-steps]');
  if (!root) return;

  const items = [...root.querySelectorAll('[data-step]')];
  const shots = [...root.querySelectorAll('[data-shot]')];
  const bars = [...root.querySelectorAll('.steps__bar-item')];
  const tag = root.querySelector('[data-steps-tag]');
  const zoom = root.querySelector('[data-steps-zoom]');
  if (items.length < 2) return;

  let current = 0;

  function setActive(index) {
    if (index === current) return;
    current = index;

    items.forEach((el, i) => el.toggleAttribute('data-active', i === index));
    shots.forEach((el, i) => el.toggleAttribute('data-active', i === index));
    bars.forEach((el, i) => el.toggleAttribute('data-active', i === index));

    const shot = shots[index];
    if (tag) tag.textContent = `Шаг ${String(index + 1).padStart(2, '0')}`;

    // Лупа открывает кадр того шага, который сейчас в рамке
    if (zoom && shot) {
      zoom.setAttribute('data-zoom', shot.dataset.full);
      zoom.setAttribute('data-zoom-alt', shot.alt);
      zoom.setAttribute('data-zoom-caption', shot.dataset.caption);
    }
  }

  function pick() {
    const middle = window.innerHeight / 2;
    let best = 0;
    let bestDistance = Infinity;

    items.forEach((el, i) => {
      const rect = el.getBoundingClientRect();
      const distance = Math.abs(rect.top + rect.height / 2 - middle);
      if (distance < bestDistance) {
        bestDistance = distance;
        best = i;
      }
    });

    setActive(best);
  }

  let queued = false;
  window.addEventListener('scroll', () => {
    // Скролл приходит чаще, чем браузер рисует кадры
    if (queued) return;
    queued = true;
    requestAnimationFrame(() => {
      queued = false;
      pick();
    });
  }, { passive: true });

  window.addEventListener('resize', pick, { passive: true });

  // Мгновенная смена, если человек попросил убрать анимацию
  if (window.matchMedia(STILL).matches) {
    shots.forEach((el) => { el.style.transition = 'none'; });
  }

  pick();
}
