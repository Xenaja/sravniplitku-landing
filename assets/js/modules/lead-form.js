/**
 * Форма заявки.
 * Модуль обслуживает любую форму с [data-lead-form] и не знает заранее,
 * какие в ней поля: разбирает те, что нашлись в разметке. Сейчас форма
 * на странице одна.
 *
 * Телефон — отдельное обязательное поле: он нужен всегда, даже если
 * гайд просят прислать в мессенджер (сообщения в Telegram и WhatsApp
 * тоже уходят по номеру). Переключатель «Куда прислать гайд» решает
 * только канал доставки; при выборе «Почта» рядом раскрывается поле
 * адреса — до этого оно скрыто и не участвует в проверке.
 *
 * Проверка идёт по уходу из поля, а не только по отправке: ошибку видно
 * сразу, а не после того, как форма отклонит всё разом.
 *
 * Ответ сервера ожидается как {"ok": true} либо {"ok": false, "error": "…"}.
 */

import { config } from '../config.js';
import { getUtm } from './utm.js';
import { track } from './analytics.js';
import { isPreview } from './preview.js';

const MESSAGES = {
  phoneEmpty: 'Оставьте телефон — на него можно позвонить',
  phoneInvalid: 'Проверьте телефон: например, +7 999 123-45-67',
  emailEmpty: 'Укажите почту, куда прислать гайд',
  emailInvalid: 'Проверьте адрес почты',
  selectEmpty: 'Выберите вариант',
  radioEmpty: 'Выберите вариант',
};

/** «8 (999) 123-45-67» → «+79991234567»; null, если номер не похож на российский */
export function normalizePhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');

  if (digits.length === 10) digits = `7${digits}`;
  else if (digits.length === 11 && digits[0] === '8') digits = `7${digits.slice(1)}`;

  return /^7\d{10}$/.test(digits) ? `+${digits}` : null;
}

/** Подсказка ввода: «+7 999 123-45-67» */
export function formatPhone(raw) {
  let digits = String(raw || '').replace(/\D/g, '');
  if (!digits) return '';

  if (digits[0] === '8' || digits[0] === '9') digits = `7${digits.replace(/^8/, '')}`;
  if (digits[0] !== '7') digits = `7${digits}`;
  digits = digits.slice(0, 11);

  const rest = digits.slice(1);
  let out = '+7';
  if (rest.length) out += ` ${rest.slice(0, 3)}`;
  if (rest.length > 3) out += ` ${rest.slice(3, 6)}`;
  if (rest.length > 6) out += `-${rest.slice(6, 8)}`;
  if (rest.length > 8) out += `-${rest.slice(8, 10)}`;
  return out;
}

export function initLeadForm() {
  document.querySelectorAll('[data-lead-form]').forEach(setupForm);
  bindSourceLinks();
}

/**
 * Клик по кнопке с data-lead-source запоминает, откуда пришла заявка,
 * и подстраивает под неё сам блок: из тарифов человек ждёт доступ,
 * а не руководство по продажам.
 *
 * Источник пишется в форму, на которую ведёт ссылка, а не в первую
 * попавшуюся: форм на странице может стать больше одной.
 */
function bindSourceLinks() {
  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lead-source]');
    if (!trigger) return;

    const href = trigger.getAttribute('href') || '';
    const target = href.startsWith('#') ? document.querySelector(href) : null;
    const form = (target && target.querySelector('[data-lead-form]'))
      || document.querySelector('[data-lead-form]');
    const field = form && form.querySelector('[data-lead-source-field]');
    if (field) field.value = trigger.dataset.leadSource;

    applyLeadMode(trigger.dataset.leadSource, target || sectionOf(form));
  });
}

/** Секция, в которой живёт форма: тексты лежат рядом с ней, а не внутри */
function sectionOf(form) {
  return form ? form.closest('section') : null;
}

/**
 * Исходные тексты блока — это и есть вариант по умолчанию (лид-магнит).
 * Снимаем их с разметки один раз при первом переключении, чтобы не
 * дублировать те же строки ещё и в конфиге.
 */
let defaultMode = null;

function readMode(root) {
  const points = [...root.querySelectorAll('[data-lead-points] .lead-magnet__point')];
  const texts = [...root.querySelectorAll('[data-lead-text] p')];
  const formId = root.querySelector('input[name="form_id"]');
  const channel = root.querySelector('[data-lead-channel-label]');
  const submit = root.querySelector('[data-submit-label]');
  const badge = root.querySelector('[data-lead-badge]');
  const title = root.querySelector('[data-lead-title]');

  return {
    badge: badge ? badge.textContent : '',
    title: title ? title.textContent : '',
    text: texts.map((p) => p.textContent),
    // Галочка — не текст пункта, поэтому берём только последний узел
    points: points.map((p) => p.lastChild.textContent.trim()),
    channelLabel: channel ? channel.textContent : '',
    submit: submit ? submit.textContent : '',
    formId: formId ? formId.value : '',
  };
}

function applyLeadMode(source, root) {
  if (!root) return;

  const name = (config.lead && config.lead.sources && config.lead.sources[source]) || null;
  const modes = (config.lead && config.lead.modes) || {};

  if (!defaultMode) defaultMode = readMode(root);
  const mode = name ? modes[name] : defaultMode;
  if (!mode) return;

  const badge = root.querySelector('[data-lead-badge]');
  if (badge) badge.textContent = mode.badge;

  const title = root.querySelector('[data-lead-title]');
  if (title) title.textContent = mode.title;

  const textBox = root.querySelector('[data-lead-text]');
  if (textBox) {
    textBox.replaceChildren(...mode.text.map((line) => {
      const p = document.createElement('p');
      p.className = 'lead-magnet__text';
      p.textContent = line;
      return p;
    }));
  }

  const pointsBox = root.querySelector('[data-lead-points]');
  if (pointsBox) {
    pointsBox.replaceChildren(...mode.points.map((line) => {
      const p = document.createElement('p');
      p.className = 'lead-magnet__point';
      const check = document.createElement('span');
      check.className = 'lead-magnet__check';
      check.setAttribute('aria-hidden', 'true');
      check.textContent = '✓';
      p.append(check, line);
      return p;
    }));
  }

  const channel = root.querySelector('[data-lead-channel-label]');
  if (channel) channel.textContent = mode.channelLabel;

  const submit = root.querySelector('[data-submit-label]');
  if (submit) submit.textContent = mode.submit;

  // От form_id зависит тема письма в api/lead.php
  const formId = root.querySelector('input[name="form_id"]');
  if (formId) formId.value = mode.formId;
}

function setupForm(form) {
  const statusEl = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const sourceField = form.querySelector('[data-lead-source-field]');
  const pageUrlField = form.querySelector('[data-page-url-field]');
  const phoneInput = form.querySelector('[data-validate="phone"]');
  // Подпись кнопки не запоминаем при старте: блок умеет переключаться
  // на «Отправить заявку», и запомненный текст вернул бы прежний вариант.
  let submitLabelText = submitLabel ? submitLabel.textContent : '';

  if (pageUrlField) pageUrlField.value = window.location.href.slice(0, 500);

  bindPhoneMask(phoneInput);
  bindChannelToggle(form);
  bindBlurValidation(form);
  bindErrorReset(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const problems = validate(form);
    if (problems.length) {
      showStatus(statusEl, config.form.messages.validation, 'error');
      problems[0].focus();
      return;
    }

    if (form.elements.company_website && form.elements.company_website.value) {
      showStatus(statusEl, config.form.messages.success, 'success');
      return;
    }

    if (isPreview()) {
      showStatus(statusEl, config.form.messages.demo, 'neutral');
      return;
    }

    if (!config.form.endpoint) {
      console.error('[lead-form] не задан config.form.endpoint — отправлять некуда');
      showStatus(statusEl, config.form.messages.error, 'error');
      return;
    }

    setLoading(true);
    showStatus(statusEl, config.form.messages.sending, 'neutral');

    try {
      const result = await send(form, phoneInput);

      if (result.ok) {
        track('lead_form_submit', {
          form: form.id,
          source: sourceField ? sourceField.value : '',
        });
        showStatus(statusEl, config.form.messages.success, 'success');
        form.reset();
        // reset() возвращает переключатель к разметке (Telegram), поэтому
        // поле почты нужно спрятать обратно вручную
        bindChannelToggle(form);
      } else {
        showStatus(statusEl, result.error || config.form.messages.error, 'error');
      }
    } catch (error) {
      console.error('[lead-form] отправка не удалась:', error);
      const offline = error.name === 'AbortError' || !navigator.onLine;
      showStatus(statusEl, offline ? config.form.messages.offline : config.form.messages.error, 'error');
    } finally {
      setLoading(false);
    }
  });

  function setLoading(loading) {
    if (submitButton) submitButton.disabled = loading;
    if (submitLabel && loading) submitLabelText = submitLabel.textContent;
    if (submitLabel) submitLabel.textContent = loading ? config.form.messages.sending : submitLabelText;
    form.setAttribute('aria-busy', String(loading));
  }
}

/* ---------- отправка ---------- */

async function send(form, phoneInput) {
  const data = new FormData(form);

  // На сервер уходит нормализованный номер (+79991234567), в поле
  // у человека остаётся его собственная запись с пробелами и дефисами
  if (phoneInput) {
    const normalized = normalizePhone(phoneInput.value);
    if (normalized) data.set('phone', normalized);
  }

  Object.entries(getUtm()).forEach(([key, value]) => data.set(key, value));
  data.delete('company_website');

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), config.form.timeoutMs);

  try {
    const response = await fetch(config.form.endpoint, {
      method: 'POST',
      headers: { Accept: 'application/json' },
      body: data,
      signal: controller.signal,
    });

    let payload = null;
    try {
      payload = await response.json();
    } catch {
      // Сервер ответил не-JSON — судим по HTTP-коду
    }

    if (!response.ok) return { ok: false, error: payload && payload.error };
    return payload && typeof payload.ok === 'boolean' ? payload : { ok: true };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- проверка ---------- */

/** @returns {HTMLElement[]} поля, на которых нашлась ошибка */
function validate(form) {
  const problems = [];

  form.querySelectorAll('[data-field]').forEach((field) => {
    const control = checkField(field);
    if (control) problems.push(control);
  });

  form.querySelectorAll('[data-consent]').forEach((consent) => {
    const box = consent.querySelector('input[type="checkbox"]');
    if (!box || !box.required) return;

    const invalid = !box.checked;
    consent.classList.toggle('consent--invalid', invalid);
    box.setAttribute('aria-invalid', String(invalid));
    if (invalid) problems.push(box);
  });

  return problems;
}

/** Проверяет одно поле. @returns {HTMLElement|null} элемент с ошибкой */
function checkField(field) {
  // Скрытое поле не участвует в проверке — сейчас это только почта,
  // пока выбран не тот канал доставки (bindChannelToggle)
  if (field.hidden) return null;

  // Группа переключателей: контрола со значением нет, есть набор
  const radios = [...field.querySelectorAll('input[type="radio"]')];
  if (radios.length) {
    const chosen = radios.some((r) => r.checked);
    setFieldError(field, radios[0], chosen ? '' : MESSAGES.radioEmpty);
    return chosen ? null : radios[0];
  }

  const control = field.querySelector('.field__control');
  if (!control) return null;

  const value = control.value.trim();
  let message = '';

  if (control.dataset.validate === 'phone') {
    if (!value) message = MESSAGES.phoneEmpty;
    else if (!normalizePhone(value)) message = MESSAGES.phoneInvalid;
  } else if (control.dataset.validate === 'email') {
    if (!value) message = MESSAGES.emailEmpty;
    else if (!/^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value)) message = MESSAGES.emailInvalid;
  } else if (control.required && !value) {
    message = MESSAGES.selectEmpty;
  }

  setFieldError(field, control, message);
  return message ? control : null;
}

function setFieldError(field, control, message) {
  const errorEl = field.querySelector('[data-field-error]');

  field.classList.toggle('field--invalid', Boolean(message));
  control.setAttribute('aria-invalid', String(Boolean(message)));

  if (!errorEl) return;

  if (message) {
    if (!errorEl.id) {
      errorEl.id = `err-${control.name || Math.random().toString(36).slice(2)}`;
    }
    control.setAttribute('aria-describedby', errorEl.id);
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    control.removeAttribute('aria-describedby');
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}

/** Проверка по уходу из поля: ошибку видно сразу, а не после отправки */
function bindBlurValidation(form) {
  form.addEventListener('focusout', (event) => {
    const field = event.target.closest('[data-field]');
    if (!field || !form.contains(field)) return;
    // Фокус мог уйти внутрь того же поля — например между переключателями
    if (field.contains(event.relatedTarget)) return;
    checkField(field);
  });
}

/** Ошибка гаснет, как только человек начал править поле */
function bindErrorReset(form) {
  const clear = (event) => {
    const field = event.target.closest('[data-field]');
    if (field) {
      const control = field.querySelector('.field__control')
        || field.querySelector('input[type="radio"]');
      if (control) setFieldError(field, control, '');
    }

    const consent = event.target.closest('[data-consent]');
    if (consent && event.target.checked) {
      consent.classList.remove('consent--invalid');
      event.target.setAttribute('aria-invalid', 'false');
    }
  };

  form.addEventListener('input', clear);
  form.addEventListener('change', clear);
}

/* ---------- вспомогательное ---------- */

/**
 * Показывает поле почты, только если выбран канал «Почта» — до этого
 * оно скрыто атрибутом hidden и не участвует в проверке (см. checkField).
 * Ошибка, если была, гаснет вместе с полем: скрытая красная рамка
 * никому не видна, но осталась бы в DOM.
 */
function bindChannelToggle(form) {
  const emailField = form.querySelector('[data-channel-email]');
  const channelInputs = [...form.querySelectorAll('[data-channel-input]')];
  if (!emailField || !channelInputs.length) return;

  function apply() {
    const selected = channelInputs.find((input) => input.checked);
    const showEmail = Boolean(selected) && selected.value === 'email';
    emailField.hidden = !showEmail;
    if (!showEmail) {
      const control = emailField.querySelector('.field__control');
      if (control) setFieldError(emailField, control, '');
    }
  }

  channelInputs.forEach((input) => input.addEventListener('change', apply));
  apply();
}

function bindPhoneMask(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    if (!/^[+\d]/.test(input.value)) return;

    // Форматируем только когда курсор в конце — иначе правка середины
    // номера превращается в борьбу с кареткой
    if (input.selectionStart !== input.value.length) return;

    const formatted = formatPhone(input.value);
    if (formatted !== input.value) {
      input.value = formatted;
      input.setSelectionRange(formatted.length, formatted.length);
    }
  });
}

function showStatus(el, text, kind) {
  if (!el) return;

  el.textContent = text;
  el.hidden = false;
  el.classList.remove('form-status--success', 'form-status--error');

  if (kind === 'success') el.classList.add('form-status--success');
  if (kind === 'error') el.classList.add('form-status--error');
}
