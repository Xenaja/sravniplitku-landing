/**
 * Работа с классами текстур плитки.
 * Цвета и геометрия рисунка заданы в CSS (.tile--* в components.css) —
 * скрипт только переключает класс, ни одного цвета в JS нет.
 */

const PREFIX = 'tile--';

/**
 * @param {Element|null} el
 * @param {string} slug имя коллекции: carrara, travertine, concrete, terracotta, graphite, oak
 */
export function applyTile(el, slug) {
  if (!el || !slug) return;

  for (const cls of [...el.classList]) {
    if (cls.startsWith(PREFIX)) el.classList.remove(cls);
  }

  el.classList.add(PREFIX + slug);
}
