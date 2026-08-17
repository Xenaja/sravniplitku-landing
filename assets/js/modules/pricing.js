/**
 * Тарифы.
 * Проценты и строка «вместо N ₽» считаются из цен в config.js —
 * так они не разъезжаются, когда клиент поменяет суммы.
 * В разметке лежат те же значения по умолчанию: страница читается
 * без скриптов, скрипт лишь пересчитывает.
 */

import { config } from '../config.js';

/** Неразрывный пробел — «19 800 ₽» не должно рваться переносом строки.
 *  Собран кодом намеренно: в исходнике этот символ неотличим от обычного
 *  пробела и легко теряется при правках или переформатировании файла. */
const NBSP = String.fromCharCode(160);

/** 19800 → «19 800 ₽» */
export function money(amount) {
  const grouped = String(Math.round(amount)).replace(/\B(?=(\d{3})+(?!\d))/g, NBSP);
  return `${grouped}${NBSP}₽`;
}

export function initPricing() {
  const root = document.querySelector('[data-pricing]');
  if (!root) return;

  const { monthly, annual, trial } = config.pricing;
  const annualFull = monthly * 12;
  const discount = annualFull > 0 ? Math.round((1 - annual / annualFull) * 100) : 0;

  const nodes = {
    trial: root.querySelector('[data-price="trial"]'),
    monthly: root.querySelector('[data-price="monthly"]'),
    annual: root.querySelector('[data-price="annual"]'),
    annualFull: root.querySelector('[data-price="annual-full"]'),
    discount: root.querySelector('[data-price="discount"]'),
  };

  // Цена тестового не публикуется, пока клиент не назвал сумму
  if (nodes.trial) {
    const hasPrice = trial > 0;
    nodes.trial.textContent = hasPrice ? money(trial) : 'минимальная сумма';
    // Текст набирается легче и мельче, чем число, — см. макет
    nodes.trial.classList.toggle('plan__price--text', !hasPrice);
  }

  if (nodes.monthly) nodes.monthly.textContent = money(monthly);
  if (nodes.annual) nodes.annual.textContent = money(annual);
  if (nodes.annualFull) nodes.annualFull.textContent = money(annualFull);

  if (nodes.discount) {
    // Скидки нет — бейдж «выгода N %» врал бы, поэтому убираем
    if (discount > 0) {
      nodes.discount.textContent = `выгода ${discount}${NBSP}%`;
      nodes.discount.hidden = false;
    } else {
      nodes.discount.hidden = true;
    }
  }
}
