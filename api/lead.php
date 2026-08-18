<?php
/**
 * Приём заявок с лендинга: лид-магнит и заявка на доступ.
 *
 * Отвечает JSON: {"ok": true} либо {"ok": false, "error": "текст"}.
 * Формат ожидает assets/js/modules/lead-form.js.
 *
 * Персональные данные не уходят на сторонние сервисы: заявка кладётся
 * в лог на этом же сервере и отправляется письмом на почту клиента.
 *
 * Перед запуском:
 *   1. Заполнить MAIL_TO и MAIL_FROM ниже.
 *   2. Проверить, что каталог logs/ доступен на запись и закрыт снаружи.
 *   3. Отправить тестовую заявку и убедиться, что письмо дошло.
 */

declare(strict_types=1);

// ---------- Настройки ----------

/** Куда падают заявки. Несколько адресов — через запятую. */
const MAIL_TO = 'hello@sravniplitku.ru';

/** Обратный адрес. Домен должен совпадать с доменом сайта, иначе письма уйдут в спам. */
const MAIL_FROM = 'no-reply@sravniplitku.ru';

/** Тема письма зависит от формы: заявки не должны сливаться в одну кучу. */
const MAIL_SUBJECTS = [
    'lead-magnet' => 'Лид-магнит: запрос файла «7 приёмов»',
    'access'      => 'Заявка на тестовый доступ',
];
const MAIL_SUBJECT_FALLBACK = 'Заявка с лендинга «СравниПлитку»';

/** Минимальный интервал между заявками с одного адреса, секунды. */
const THROTTLE_SECONDS = 20;

const LOG_DIR = __DIR__ . '/logs';

// ---------- Ответ ----------

header('Content-Type: application/json; charset=utf-8');
header('X-Content-Type-Options: nosniff');

/**
 * Возвращаемого типа нет намеренно: `never` появился только в PHP 8.1,
 * а этот файл должен работать и на 7.4 у недорогих хостингов.
 *
 * @param array<string, mixed> $payload
 */
function respond(array $payload, int $status = 200)
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['ok' => false, 'error' => 'Метод не поддерживается'], 405);
}

// ---------- Ввод ----------

/**
 * Обрезаем длину и убираем управляющие символы: в письмо и лог
 * не должно попасть ничего, что ломает разметку строки.
 */
function field(string $name, int $maxLength = 200): string
{
    $raw = (string) ($_POST[$name] ?? '');
    $clean = preg_replace('/[\x00-\x1F\x7F]/u', ' ', $raw) ?? '';

    return mb_substr(trim($clean), 0, $maxLength);
}

// Ловушка для ботов: браузер это поле не отправляет, а простые скрипты заполняют.
if (field('company_website') !== '') {
    respond(['ok' => true]);
}

// Контакт — одно поле: телефон или почта, что человеку удобнее.
$contactRaw = field('contact', 120);
$contact = '';

if (mb_strpos($contactRaw, '@') !== false) {
    $email = filter_var($contactRaw, FILTER_VALIDATE_EMAIL);
    if ($email === false) {
        respond(['ok' => false, 'error' => 'Проверьте адрес почты'], 422);
    }
    $contact = $email;
} else {
    $digits = preg_replace('/\D/', '', $contactRaw) ?? '';

    if (strlen($digits) === 10) {
        $digits = '7' . $digits;
    } elseif (strlen($digits) === 11 && $digits[0] === '8') {
        $digits = '7' . substr($digits, 1);
    }

    if (!preg_match('/^7\d{10}$/', $digits)) {
        respond(['ok' => false, 'error' => 'Проверьте телефон или почту'], 422);
    }
    $contact = '+' . $digits;
}

// Без согласия обрабатывать данные нельзя.
if (field('consent') === '') {
    respond(['ok' => false, 'error' => 'Нужно согласие на обработку данных'], 422);
}

// ---------- Защита от повторов ----------

$ip = (string) ($_SERVER['REMOTE_ADDR'] ?? 'unknown');

if (!is_dir(LOG_DIR)) {
    @mkdir(LOG_DIR, 0750, true);
}

$throttleFile = LOG_DIR . '/throttle-' . md5($ip) . '.txt';

if (is_file($throttleFile) && (time() - (int) filemtime($throttleFile)) < THROTTLE_SECONDS) {
    respond(['ok' => false, 'error' => 'Заявка уже отправлена, подождите немного'], 429);
}

@touch($throttleFile);

// ---------- Сбор заявки ----------

$lead = [
    'Контакт'              => $contact,
    'Форма'                => field('form_id', 40),
    'Сеть или магазин'     => field('network', 60),
    'Точек продаж'         => field('points', 60),
    'Средний чек'          => field('check', 60),
    'Подписывает счёт'     => field('decision_maker', 60),
    'Сегмент'              => field('segment', 30),
    'Источник клика'       => field('source', 60),
    'Страница'             => field('page_url', 500),
    'utm_source'           => field('utm_source'),
    'utm_medium'           => field('utm_medium'),
    'utm_campaign'         => field('utm_campaign'),
    'utm_content'          => field('utm_content'),
    'utm_term'             => field('utm_term'),
    // Отметка согласия с временем и адресом — доказательство по ФЗ-152
    'Согласие'             => 'обработка ПД и сообщения о сервисе, ' . date('d.m.Y H:i:s'),
    'IP'                   => $ip,
];

$lead = array_filter($lead, static fn (string $value): bool => $value !== '');

// ---------- Лог ----------

$logLine = date('c') . ' ' . json_encode($lead, JSON_UNESCAPED_UNICODE) . PHP_EOL;

if (@file_put_contents(LOG_DIR . '/leads.log', $logLine, FILE_APPEND | LOCK_EX) === false) {
    // Письмо ещё может уйти, но потерю лога нужно видеть в логах сервера
    error_log('[lead.php] не удалось записать ' . LOG_DIR . '/leads.log');
}

// ---------- Письмо ----------

$body = "Новая заявка с лендинга «СравниПлитку»\n\n";
foreach ($lead as $label => $value) {
    $body .= $label . ': ' . $value . "\n";
}

$headers = [
    'From: СравниПлитку <' . MAIL_FROM . '>',
    'Content-Type: text/plain; charset=UTF-8',
    'Content-Transfer-Encoding: 8bit',
    'MIME-Version: 1.0',
];

$formId = field('form_id', 40);
$subjectText = MAIL_SUBJECTS[$formId] ?? MAIL_SUBJECT_FALLBACK;
$subject = '=?UTF-8?B?' . base64_encode($subjectText) . '?=';
$sent = @mail(MAIL_TO, $subject, $body, implode("\r\n", $headers));

if (!$sent) {
    error_log('[lead.php] mail() вернул false, заявка осталась только в логе');
    // Заявка сохранена, поэтому для посетителя это успех.
}

respond(['ok' => true]);
