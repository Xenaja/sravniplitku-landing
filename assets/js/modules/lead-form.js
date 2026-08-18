/**
 * Форма лид-магнита.
 * Валидация телефона, обязательные согласия, состояния отправки
 * (загрузка / успех / ошибка), UTM-метки и источник клика.
 *
 * Форма отправляется на config.form.endpoint как multipart/form-data.
 * Ожидаемый ответ: {"ok": true} либо {"ok": false, "error": "текст"}.
 */

import { config } from '../config.js';
import { getUtm } from './utm.js';
import { track } from './analytics.js';
import { isPreview } from './preview.js';

const MESSAGES = {
  phoneEmpty: 'Укажите телефон – на него придёт файл',
  phoneInvalid: 'Похоже, номер неполный. Формат: +7 999 123-45-67',
  selectEmpty: 'Выберите вариант',
  consent: 'Без согласия мы не можем отправить файл',
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
  const form = document.querySelector('[data-lead-form]');
  if (!form) return;

  const statusEl = form.querySelector('[data-form-status]');
  const submitButton = form.querySelector('[data-submit]');
  const submitLabel = form.querySelector('[data-submit-label]');
  const sourceField = form.querySelector('[data-lead-source-field]');
  const pageUrlField = form.querySelector('[data-page-url-field]');
  const phoneInput = form.querySelector('[data-validate="phone"]');
  const submitLabelText = submitLabel ? submitLabel.textContent : '';

  if (pageUrlField) pageUrlField.value = window.location.href.slice(0, 500);

  bindSourceLinks(sourceField);
  bindPhoneMask(phoneInput);
  bindErrorReset(form);

  form.addEventListener('submit', async (event) => {
    event.preventDefault();

    const problems = validate(form);
    if (problems.length) {
      showStatus(statusEl, config.form.messages.validation, 'error');
      problems[0].control.focus();
      return;
    }

    // Бот заполнил скрытое поле — молча делаем вид, что всё хорошо
    if (form.elements.company_website && form.elements.company_website.value) {
      showStatus(statusEl, config.form.messages.success, 'success');
      return;
    }

    // Превью: проверки уже отработали, отправлять некуда и незачем
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
          source: sourceField ? sourceField.value : '',
          segment: form.elements.segment ? form.elements.segment.value : '',
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

async function send(form, phoneInput) {
  const data = new FormData(form);

  // На сервер уходит нормализованный номер, в поле у человека остаётся его запись
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

    if (!response.ok) {
      return { ok: false, error: payload && payload.error };
    }

    return payload && typeof payload.ok === 'boolean' ? payload : { ok: true };
  } finally {
    clearTimeout(timer);
  }
}

/* ---------- валидация ---------- */

function validate(form) {
  const problems = [];

  form.querySelectorAll('[data-field]').forEach((field) => {
    const control = field.querySelector('.field__control');
    if (!control) return;

    const value = control.value.trim();
    let message = '';

    if (control.dataset.validate === 'phone') {
      if (!value) message = MESSAGES.phoneEmpty;
      else if (!normalizePhone(value)) message = MESSAGES.phoneInvalid;
    } else if (control.required && !value) {
      message = MESSAGES.selectEmpty;
    }

    setFieldError(field, control, message);
    if (message) problems.push({ control });
  });

  form.querySelectorAll('[data-consent]').forEach((consent) => {
    const box = consent.querySelector('input[type="checkbox"]');
    if (!box || !box.required) return;

    const invalid = !box.checked;
    consent.classList.toggle('consent--invalid', invalid);
    box.setAttribute('aria-invalid', String(invalid));
    if (invalid) problems.push({ control: box });
  });

  return problems;
}

function setFieldError(field, control, message) {
  const errorEl = field.querySelector('[data-field-error]');

  field.classList.toggle('field--invalid', Boolean(message));
  control.setAttribute('aria-invalid', String(Boolean(message)));

  if (!errorEl) return;

  if (message) {
    if (!errorEl.id) errorEl.id = `err-${control.name || Math.random().toString(36).slice(2)}`;
    control.setAttribute('aria-describedby', errorEl.id);
    errorEl.textContent = message;
    errorEl.hidden = false;
  } else {
    control.removeAttribute('aria-describedby');
    errorEl.textContent = '';
    errorEl.hidden = true;
  }
}

/** Ошибка гаснет, как только человек начал править поле */
function bindErrorReset(form) {
  const clear = (event) => {
    const field = event.target.closest('[data-field]');
    if (field) {
      const control = field.querySelector('.field__control');
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

function bindPhoneMask(input) {
  if (!input) return;

  input.addEventListener('input', () => {
    // Форматируем только когда курсор в конце — иначе правка середины
    // номера превращается в борьбу с кареткой
    const atEnd = input.selectionStart === input.value.length;
    if (!atEnd) return;

    const formatted = formatPhone(input.value);
    if (formatted !== input.value) {
      input.value = formatted;
      input.setSelectionRange(formatted.length, formatted.length);
    }
  });
}

/** Клик по любой кнопке с data-lead-source запоминает, откуда пришла заявка */
function bindSourceLinks(sourceField) {
  if (!sourceField) return;

  document.addEventListener('click', (event) => {
    const trigger = event.target.closest('[data-lead-source]');
    if (trigger) sourceField.value = trigger.dataset.leadSource;
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
