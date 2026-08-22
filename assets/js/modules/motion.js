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

    // Полоса статистики появляется линиями, а не блоками (M3). Наблюдатель
    // ей не нужен: после HERO-FIT она стоит в первом экране, то есть видна
    // сразу. Линии рисуются на загрузке — данные при этом читаемы с первого
    // кадра, задержки контента нет.
    const cells = section.querySelectorAll('.metrics__cell');
    if (cells.length) {
      // Своя метка, а не .reveal: цифры не должны прятаться даже на кадр —
      // едет только линия над ними
      cells.forEach((cell, i) => cell.style.setProperty('--reveal-step', String(i)));
      requestAnimationFrame(() => requestAnimationFrame(() => {
        cells.forEach((cell) => cell.setAttribute('data-line-in', ''));
      }));
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
    // -22%: при -12% блок проявлялся, едва задев нижнюю кромку экрана,
    // и переход доигрывал раньше, чем человек до него доскроллит —
    // движение фактически было не видно
  }, { rootMargin: '0px 0px -22% 0px', threshold: 0.01 });

  document.documentElement.setAttribute('data-reveal-ready', '');

  groups.forEach((items) => {
    items.forEach((el, i) => {
      el.classList.add('reveal');
      el.style.setProperty('--reveal-step', String(Math.min(i, MAX_STEP)));

      // Всё, что попало в окно уже на загрузке, показываем сразу и без
      // наблюдателя. Иначе на высоком экране запас в -22% снизу оставлял
      // начало следующей секции прозрачным: место она занимала, но под
      // первым экраном человек видел пустую полосу и решал, что страница
      // кончилась.
      if (el.getBoundingClientRect().top < window.innerHeight) {
        requestAnimationFrame(() => el.classList.add('reveal--in'));
        return;
      }

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
