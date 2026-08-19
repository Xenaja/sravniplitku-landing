/**
 * СравниПлитку — точка входа.
 * Собирает модули страницы. Модуль, который упал, не должен уносить
 * с собой остальные: форма обязана работать, даже если сломался плеер.
 *
 * Скрипт подключён как <script type="module"> — он отложенный,
 * DOM к моменту запуска уже разобран.
 */

import { initPreview } from './modules/preview.js';
import { initHeader } from './modules/header.js';
import { initContacts } from './modules/contacts.js';
import { initAnalytics } from './modules/analytics.js';
import { initUtm } from './modules/utm.js';
import { initSections } from './modules/sections.js';
import { initSegmentTabs } from './modules/segment-tabs.js';
import { initPricing } from './modules/pricing.js';
import { initLeadForm } from './modules/lead-form.js';
import { initLightbox } from './modules/lightbox.js';
import { initVideo } from './modules/video.js';
import { initMotion } from './modules/motion.js';

/** Ошибка модуля видна в консоли с именем — иначе её не найти на проде */
function safe(name, init) {
  try {
    init();
  } catch (error) {
    console.error(`[main] модуль «${name}» не запустился:`, error);
  }
}

safe('preview', initPreview);
safe('header', initHeader);
safe('contacts', initContacts);
safe('analytics', initAnalytics);
safe('utm', initUtm);
safe('sections', initSections);
safe('segment-tabs', initSegmentTabs);
safe('pricing', initPricing);
safe('lead-form', initLeadForm);
safe('lightbox', initLightbox);
safe('video', initVideo);
safe('motion', initMotion);
