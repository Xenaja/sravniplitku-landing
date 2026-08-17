/**
 * Флаги секций.
 * Пока нет настоящих отзывов пилотных салонов, блок можно выключить
 * из config.js. Совсем надёжно — удалить секцию из index.html:
 * тогда рыба не попадёт ни в исходник страницы, ни в индекс поисковика.
 */

import { config } from '../config.js';

export function initSections() {
  Object.entries(config.sections).forEach(([name, enabled]) => {
    if (enabled) return;

    const section = document.querySelector(`[data-section="${name}"]`);
    if (section) section.remove();
  });
}
