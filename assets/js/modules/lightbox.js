/**
 * Увеличение скриншота.
 * В карточке шага кадр всего ~170px, деталей не разобрать. Клик по нему
 * открывает полный скриншот сервиса в модалке.
 *
 * Работает с любым элементом, у которого есть data-zoom:
 *   data-zoom          — путь к большой картинке
 *   data-zoom-alt      — альтернативный текст
 *   data-zoom-caption  — подпись под картинкой
 *
 * Большие файлы не грузятся, пока их не откроют: src проставляется по клику.
 */

const CLOSE_LABEL = 'Закрыть';

export function initLightbox() {
  const triggers = [...document.querySelectorAll('[data-zoom]')];
  if (!triggers.length) return;

  // Без нативного <dialog> не городим полифилл — просто открываем картинку
  // отдельной вкладкой: увидеть её важнее, чем сделать это красиво.
  const supported = typeof HTMLDialogElement !== 'undefined'
    && typeof HTMLDialogElement.prototype.showModal === 'function';

  if (!supported) {
    triggers.forEach((trigger) => {
      trigger.addEventListener('click', () => window.open(trigger.dataset.zoom, '_blank', 'noopener'));
    });
    return;
  }

  let dialog = null;
  let image = null;
  let caption = null;
  let lastTrigger = null;

  function build() {
    dialog = document.createElement('dialog');
    dialog.className = 'lightbox';

    image = document.createElement('img');
    image.className = 'lightbox__img';

    caption = document.createElement('p');
    caption.className = 'lightbox__caption';

    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'lightbox__close';
    close.textContent = CLOSE_LABEL;
    close.addEventListener('click', () => dialog.close());

    const bar = document.createElement('div');
    bar.className = 'lightbox__bar';
    bar.append(caption, close);

    dialog.append(image, bar);

    // Клик мимо картинки — по самому <dialog> — закрывает
    dialog.addEventListener('click', (event) => {
      if (event.target === dialog) dialog.close();
    });

    dialog.addEventListener('close', () => {
      unlockScroll();
      // Фокус возвращается на ту же миниатюру, откуда открыли
      if (lastTrigger) lastTrigger.focus();
      // Освобождаем память: снимок может весить сотню килобайт
      image.removeAttribute('src');
    });

    document.body.append(dialog);
  }

  function lockScroll() {
    const gap = window.innerWidth - document.documentElement.clientWidth;
    document.body.style.overflow = 'hidden';
    // Компенсируем исчезнувшую полосу прокрутки, иначе страница дёрнется
    if (gap > 0) document.body.style.paddingRight = `${gap}px`;
  }

  function unlockScroll() {
    document.body.style.overflow = '';
    document.body.style.paddingRight = '';
  }

  triggers.forEach((trigger) => {
    trigger.addEventListener('click', () => {
      if (!dialog) build();

      lastTrigger = trigger;
      image.src = trigger.dataset.zoom;
      image.alt = trigger.dataset.zoomAlt || '';
      caption.textContent = trigger.dataset.zoomCaption || '';

      lockScroll();
      dialog.showModal();
    });
  });
}
