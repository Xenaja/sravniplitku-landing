/**
 * Тарифы.
 * Проценты и строка «вместо N ₽» считаются из цен в config.js —
 * так они не разъезжаются, когда клиент поменяет суммы.
 * В разметке лежат те же значения по умолчанию: страница читается
 * без скриптов, скрипт лишь пересчитывает.
 *
 * Ищем по всей странице, а не внутри блока тарифов: та же цена стоит
 * в шаге «Тестовый доступ» блока «Как начать». Пока модуль смотрел
 * только в [data-pricing], смена суммы в конфиге обновляла карточку
 * тарифа и оставляла соседний блок с прежним числом.
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

/** Проставляет текст во все узлы с этим ключом цены */
function fill(key, text) {
  document.querySelectorAll(`[data-price="${key}"]`).forEach((node) => {
    node.textContent = text;
  });
}

export function initPricing() {
  const { monthly, annual, trial } = config.pricing;
  const annualFull = monthly * 12;
  const discount = annualFull > 0 ? Math.round((1 - annual / annualFull) * 100) : 0;

  // Цена тестового не публикуется, пока клиент не назвал сумму
  const hasTrialPrice = trial > 0;
  fill('trial', hasTrialPrice ? money(trial) : 'минимальная сумма');

  // Текст набирается легче и мельче, чем число, — см. макет.
  // Только в карточке тарифа: в строке шага размер задаёт сама строка.
  document.querySelectorAll('.plan__price[data-price="trial"]').forEach((node) => {
    node.classList.toggle('plan__price--text', !hasTrialPrice);
  });

  fill('monthly', money(monthly));
  fill('annual', money(annual));
  fill('annual-full', money(annualFull));

  // Скидки нет — бейдж «выгода N %» врал бы, поэтому убираем
  document.querySelectorAll('[data-price="discount"]').forEach((node) => {
    node.textContent = `выгода ${discount}${NBSP}%`;
    node.hidden = discount <= 0;
  });
}
