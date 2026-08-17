/**
 * UTM-метки.
 * Ловим их при первом заходе и держим до отправки формы: человек может
 * прийти по ссылке, походить по странице и оставить заявку позже.
 * Храним в localStorage со сроком годности; приватный режим не должен
 * ронять страницу, поэтому всё в try/catch.
 */

import { config } from '../config.js';

const KEYS = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_content', 'utm_term'];

function readFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const found = {};

  KEYS.forEach((key) => {
    const value = params.get(key);
    if (value) found[key] = value.slice(0, 200);
  });

  return Object.keys(found).length ? found : null;
}

function save(marks) {
  try {
    const ttl = config.utm.ttlDays * 24 * 60 * 60 * 1000;
    localStorage.setItem(
      config.utm.storageKey,
      JSON.stringify({ marks, expires: Date.now() + ttl }),
    );
  } catch (error) {
    console.warn('[utm] не удалось сохранить метки:', error);
  }
}

function load() {
  try {
    const raw = localStorage.getItem(config.utm.storageKey);
    if (!raw) return null;

    const parsed = JSON.parse(raw);
    if (!parsed || Date.now() > parsed.expires) {
      localStorage.removeItem(config.utm.storageKey);
      return null;
    }

    return parsed.marks;
  } catch (error) {
    console.warn('[utm] не удалось прочитать метки:', error);
    return null;
  }
}

/** @returns {Record<string, string>} */
export function getUtm() {
  return load() || {};
}

export function initUtm() {
  const fresh = readFromUrl();
  // Свежие метки перекрывают старые: последний источник и есть источник заявки
  if (fresh) save(fresh);
}
