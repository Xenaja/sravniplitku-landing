/**
 * СравниПлитку — точка входа.
 * Собирает модули страницы. Модуль, который упал, не должен уносить
 * с собой остальные: форма обязана работать, даже если сломалось демо.
 *
 * Скрипт подключён как <script type="module"> — он отложенный,
 * DOM к моменту запуска уже разобран.
 */

import { initPreview } from './modules/preview.js';
import { initAnalytics } from './modules/analytics.js';
import { initUtm } from './modules/utm.js';
import { initSections } from './modules/sections.js';
import { initDemoScene } from './modules/demo-scene.js';
import { initCompareSlider } from './modules/compare-slider.js';
import { initSegmentTabs } from './modules/segment-tabs.js';
import { initPricing } from './modules/pricing.js';
import { initLeadForm } from './modules/lead-form.js';
import { initLightbox } from './modules/lightbox.js';

/** Ошибка модуля видна в консоли с именем — иначе её не найти на проде */
function safe(name, init) {
  try {
    init();
  } catch (error) {
    console.error(`[main] модуль «${name}» не запустился:`, error);
  }
}

safe('preview', initPreview);
safe('analytics', initAnalytics);
safe('utm', initUtm);
safe('sections', initSections);
safe('demo-scene', initDemoScene);
safe('compare-slider', initCompareSlider);
safe('segment-tabs', initSegmentTabs);
safe('pricing', initPricing);
safe('lead-form', initLeadForm);
safe('lightbox', initLightbox);
