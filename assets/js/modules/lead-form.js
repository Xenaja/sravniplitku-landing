/**
 * Формы страницы.
 * Их две и они разного объёма: лид-магнит просит только контакт и число
 * точек, заявка на доступ — ещё и портрет салона. Модуль общий: разница
 * целиком в разметке, скрипт лишь разбирает поля, которые в ней нашлись.
 *
 * Контакт — одно поле на телефон или почту: что человеку удобнее, то
 * и пишет. Тип определяется по наличию «@».
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
  contactEmpty: 'Оставьте телефон или почту — на них придёт ответ',
  contactInvalid: 'Проверьте контакт: нужен телефон +7 999 123-45-67 или почта mail@salon.ru',
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

/**
 * Разбирает контакт: телефон или почта.
 * @returns {{ type: 'phone'|'email', value: string }|null}
 */
export function parseContact(raw) {
  const value = String(raw || '').trim();
  if (!value) return null;

  if (value.includes('@')) {
    // Намеренно нестрого: адреса бывают причудливее любой регулярки,
    // а окончательную проверку всё равно делает сервер
    return /^[^\s@]+@[^\s@.]+\.[^\s@]{2,}$/.test(value) ? { type: 'email', value } : null;
  }

  const phone = normalizePhone(value);
  return phone ? { type: 'phone', value: phone } : null;
}

export function initLeadForm() {
  document.querySelectorAll('[data-lead-form]').forEach(setupForm);
  bindSourceLinks();
}

/**
 * Клик по кнопке с data-lead-source запоминает, откуда пришла заявка.
 * Форм теперь две, поэтому источник пишется в ту, на которую ведёт ссылка,
 * а не в первую попавшуюся.
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
  });
}

function setupForm(form) {
  const statusEl = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const sourceField = form.querySelector('[data-lead-source-field]');
  const pageUrlField = form.querySelector('[data-page-url-field]');
  const contactInput = form.querySelector('[data-validate="contact"]');
  const submitLabelText = submitLabel ? submitLabel.textContent : '';

  if (pageUrlField) pageUrlField.value = window.location.href.slice(0, 500);

  bindContactMask(contactInput);
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
      const result = await send(form, contactInput);

      if (result.ok) {
        track('lead_form_submit', {
          form: form.id,
          source: sourceField ? sourceField.value : '',
        });
        showStatus(statusEl, config.form.messages.success, 'success');
        form.reset();
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
    if (submitLabel) submitLabel.textContent = loading ? config.form.messages.sending : submitLabelText;
    form.setAttribute('aria-busy', String(loading));
  }
}

/* ---------- отправка ---------- */

async function send(form, contactInput) {
  const data = new FormData(form);

  // На сервер уходит разобранный контакт, в поле у человека остаётся его запись
  if (contactInput) {
    const parsed = parseContact(contactInput.value);
    if (parsed) {
      data.set('contact', parsed.value);
      data.set('contact_type', parsed.type);
    }
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

  if (control.dataset.validate === 'contact') {
    if (!value) message = MESSAGES.contactEmpty;
    else if (!parseContact(value)) message = MESSAGES.contactInvalid;
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

function bindContactMask(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    // Почту не форматируем: маска телефона превратила бы её в мусор
    if (input.value.includes('@')) return;
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
