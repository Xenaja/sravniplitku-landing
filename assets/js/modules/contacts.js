/**
 * Контакты страницы.
 *
 * Телефон, телеграм и почта стояли в разметке девятью отдельными
 * ссылками: смена номера означала три правки в разных местах страницы,
 * и пропустить одну ничего не мешало. Теперь значения живут в
 * config.contacts, а разметка их только размечает.
 *
 * Номер задаётся один раз в человекочитаемом виде — из него собираются
 * и tel:, и ссылка на WhatsApp: цифры для них одни и те же.
 *
 * В разметке остаются настоящие значения: без скриптов страница
 * показывает контакты как есть, скрипт лишь пересчитывает.
 * Подпись заменяется только там, где стоит data-contact-text, — у
 * кнопок вроде «Написать в Телеграм» своя подпись, её трогать нельзя.
 */

import { config } from '../config.js';

export function initContacts() {
  const { phone, telegram, email } = config.contacts;
  const digits = phone.replace(/\D/g, '');

  const targets = {
    phone: { href: `tel:+${digits}`, text: phone },
    whatsapp: { href: `https://wa.me/${digits}`, text: 'WhatsApp' },
    telegram: { href: telegram, text: 'Telegram' },
    email: { href: `mailto:${email}`, text: email },
  };

  document.querySelectorAll('[data-contact]').forEach((link) => {
    const target = targets[link.dataset.contact];

    if (!target) {
      console.error(`[contacts] неизвестный контакт «${link.dataset.contact}»`);
      return;
    }

    link.setAttribute('href', target.href);
    if (link.hasAttribute('data-contact-text')) link.textContent = target.text;
  });
}
