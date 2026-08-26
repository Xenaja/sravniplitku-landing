/**
 * Меню-гамбургер на узких экранах.
 *
 * Пять пунктов, телефон и кнопка перестают помещаться в один ряд около
 * 1100px: до этой правки ряд уезжал в горизонтальный скролл и читался
 * обрезанной вёрсткой. Теперь ниже этой ширины пункты прячутся под кнопку.
 *
 * Прогрессивное улучшение: мобильную раскладку меню включает не CSS сам
 * по себе, а атрибут data-nav, который ставит этот модуль. Если скрипт
 * не запустился, шапка остаётся прежней двухэтажной — ни один пункт
 * не пропадает.
 */

export function initNav() {
  const header = document.querySelector('.header');
  if (!header) return;

  const toggle = header.querySelector('[data-nav-toggle]');
  const nav = header.querySelector('[data-nav-panel]');
  if (!toggle || !nav) return;

  // Сигнал стилям: меню под кнопкой, шапка снова в один ряд
  header.dataset.nav = '';

  const OPEN = 'header--nav-open';

  function setOpen(open) {
    header.classList.toggle(OPEN, open);
    toggle.setAttribute('aria-expanded', String(open));
  }

  function close() {
    if (header.classList.contains(OPEN)) setOpen(false);
  }

  toggle.addEventListener('click', () => {
    setOpen(!header.classList.contains(OPEN));
  });

  // Переход по пункту — меню закрывается само, иначе оно перекроет якорь
  nav.addEventListener('click', (event) => {
    if (event.target.closest('a')) close();
  });

  document.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape' || !header.classList.contains(OPEN)) return;
    close();
    // Фокус возвращается на кнопку: иначе он остаётся на скрытом пункте
    toggle.focus();
  });

  // Клик мимо шапки закрывает меню
  document.addEventListener('pointerdown', (event) => {
    if (!header.contains(event.target)) close();
  });

  // На широком экране меню всегда развёрнуто — открытое состояние
  // не должно за собой тянуться при повороте телефона или ресайзе
  window.addEventListener('resize', close, { passive: true });
}
