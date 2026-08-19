/**
 * Движение страницы (MOTION.md).
 *
 * Два паттерна, которым нужен скрипт:
 *   M2/M3 — появление секции и линий статистики при скролле;
 *   M5    — доигрывание закрытия аккордеона.
 *
 * Всё остальное движение живёт в CSS: скрипту там делать нечего.
 *
 * Прячем элементы только после того, как модуль запустился: атрибут
 * data-reveal-ready ставится на <html> здесь. Без скрипта страница
 * остаётся полностью видимой, а не пустой.
 */

const STILL = '(prefers-reduced-motion: reduce)';

/** Секции, которые не появляются: у них своя логика или своё место */
const SKIP = ['[data-type="hero"]'];

/** Цепочка не длиннее трёх шагов: четвёртый и дальше идут вместе с третьим */
const MAX_STEP = 2;

export function initMotion() {
  initAccordion();

  // Человек попросил систему убрать анимацию — появления просто нет
  if (window.matchMedia(STILL).matches) return;
  if (!('IntersectionObserver' in window)) return;

  initReveal();
}

/* ---------- M2 и M3: появление при скролле ---------- */

function initReveal() {
  const groups = [];

  document.querySelectorAll('main > section').forEach((section) => {
    if (SKIP.some((sel) => section.matches(sel))) return;

    // Полоса статистики появляется линиями, а не блоками (M3)
    const cells = section.querySelectorAll('.metrics__cell');
    if (cells.length) {
      groups.push([...cells]);
      return;
    }

    // Контент лежит либо прямо в секции, либо в контейнере внутри
    const root = section.matches('.container') ? section : section.querySelector(':scope > .container');
    if (!root) return;
    const items = [...root.children].filter((el) => el.nodeType === 1);
    if (items.length) groups.push(items);
  });

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('reveal--in');
      // Один раз: повторное появление при обратном скролле мешает
      // перечитывать и раздражает
      observer.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -12% 0px', threshold: 0.01 });

  document.documentElement.setAttribute('data-reveal-ready', '');

  groups.forEach((items) => {
    items.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-step', String(Math.min(i, MAX_STEP)));
      observer.observe(el);
    });
  });
}

/* ---------- M5: закрытие аккордеона ---------- */

function initAccordion() {
  const items = document.querySelectorAll('.faq__item');
  if (!items.length) return;

  const still = window.matchMedia(STILL);

  items.forEach((item) => {
    const summary = item.querySelector('summary');
    if (!summary) return;

    summary.addEventListener('click', (event) => {
      // Открытие браузер делает сам, и CSS доигрывает переход.
      // Закрытие он делает мгновенно — перехватываем, чтобы успел
      // отработать обратный переход.
      if (!item.open || still.matches) return;

      event.preventDefault();
      item.dataset.closing = '';

      const body = item.querySelector('.faq__body');
      const finish = () => {
        delete item.dataset.closing;
        item.open = false;
      };

      if (!body) return finish();
      body.addEventListener('transitionend', function once(e) {
        if (e.propertyName !== 'grid-template-rows') return;
        body.removeEventListener('transitionend', once);
        finish();
      });
    });
  });
}
