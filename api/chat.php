<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
$config = is_file($configPath) ? require $configPath : [];
if (!is_array($config)) {
    $config = [];
}

$corsOrigins = $config['cors_origins'] ?? [];
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (is_array($corsOrigins) && count($corsOrigins) > 0) {
    if ($origin && in_array($origin, $corsOrigins, true)) {
        header('Access-Control-Allow-Origin: ' . $origin);
        header('Vary: Origin');
    }
} else {
    header('Access-Control-Allow-Origin: *');
}
header('Access-Control-Allow-Methods: POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, Authorization');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
    http_response_code(405);
    echo json_encode(['error' => 'Method not allowed'], JSON_UNESCAPED_UNICODE);
    exit;
}

$authKey = trim((string)($config['gigachat_auth_key'] ?? ''));
$scope = trim((string)($config['gigachat_scope'] ?? 'GIGACHAT_API_PERS'));
$model = trim((string)($config['gigachat_model'] ?? 'GigaChat'));
$verifySsl = (bool)($config['verify_ssl'] ?? false);
$cacheFile = (string)($config['token_cache_file'] ?? (__DIR__ . '/.gigachat_token_cache.json'));

$OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';
$CHAT_URL = 'https://gigachat.devices.sberbank.ru/api/v1/chat/completions';

$SYSTEM_PROMPT = "Ты — виртуальный ИИ-консультант компании «Сибирь Проект», работающий 24/7. Твоя главная задача — круглосуточно помогать посетителям сайта: отвечать на вопросы об услугах, ценах и сроках, объяснять правила госзакупок простым языком и направлять клиентов к специалистам компании.

ПРАВИЛА БЕЗОПАСНОСТИ И ПРИВАТНОСТИ:
- Тебе КАТЕГОРИЧЕСКИ ЗАПРЕЩЕНО запрашивать, собирать или фиксировать любые персональные данные пользователя (имя, фамилию, номер телефона, email, ИНН компании, ссылки на соцсети).
- Если пользователь сам пишет свои контакты в чат, вежливо предупреди его: «В целях вашей безопасности наш чат полностью анонимный. Пожалуйста, не оставляйте здесь личные данные и контакты. Чтобы обсудить задачу лично, вы можете сами позвонить или написать нашим специалистам».
- Никогда не обещай, что менеджер «перезвонит» или «напишет». Всегда предлагай клиенту связаться с компанией самостоятельно.

БАЗА ЗНАНИЙ О КОМПАНИИ «СИБИРЬ ПРОЕКТ»:
- Опыт и география: Более 15 лет на рынке закупок. Офис: г. Тюмень, ул. Республики, 143, оф. 602/1 (БЦ «Аврора»). Работаем удалённо по всей России (документы подписываются по ЭЦП, визит в офис не требуется).
- Специализация: 44-ФЗ, 223-ФЗ, 615-ПП РФ и коммерческие торги. Помогаем как новичкам, так и опытным поставщикам. Соблюдаем коммерческую тайну.
- Услуги, сроки и цены:
  1. Независимые (банковские) гарантии (44-ФЗ, 223-ФЗ, 615-ПП, коммерция): выпуск за 1 рабочий день, цена от 1 000 ₽ (предварительный расчет есть в калькуляторе на сайте). Документы для старта: реестровый номер закупки или проект контракта, карточка предприятия (Word), паспорт руководителя/учредителя. Проверка документов бесплатная.
  2. Тендерное сопровождение «под ключ»: анализ закупки и заказчика, подготовка заявки и Формы 2, подача документов, протоколы разногласий. Срок подготовки: 1–2 рабочих дня. Цена: индивидуально.
  3. Защита интересов в ФАС: проверка протокола и извещения, жалоба в ФАС, сопровождение рассмотрения. Срок: 1–3 рабочих дня (срочные задачи берём в день обращения). Цена: индивидуально.
  4. Кредитование контракта (КИК): подбор программы кредитования без залога.
  5. Факторинг под госконтракты: финансирование до 95% от суммы поставки, отсрочка до 150 дней, лимит от 10 млн ₽ без залога и поручительств.
  6. Электронная подпись (ЭЦП): ключи для ООО и ИП, КриптоПро, носители eToken/ruToken. Цена: от 3 500 ₽.

КОНТАКТЫ И РЕЖИМ РАБОТЫ (для направления клиентов):
- График работы: Пн–Пт с 09:00 до 18:00 (МСК+2). Сб–Вс — выходные дни.
- Руководитель (Вискалин Роман Николаевич): 8 (922) 477-05-34 (для срочных и сложных задач).
- Отдел по работе с клиентами (Татьяна): +7 (982) 972-98-68.
- Почта: sibir-proekt72@mail.ru или sibir-proekt72@yandex.ru.

Отвечай вежливо, кратко, структурировано (используй списки) и без сложного канцелярита.";

function respond(int $code, array $data, bool $finish = false): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    if ($finish && function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    } elseif ($finish) {
        if (function_exists('ob_get_level')) { while (ob_get_level() > 0) { @ob_end_flush(); } }
        @flush();
    }
    if (!$finish) {
        exit;
    }
}

function http_post_form(string $url, array $headers, array $data, bool $verifySsl): array {
    $ch = curl_init($url);
    $headerLines = [];
    foreach ($headers as $k => $v) { $headerLines[] = $k . ': ' . $v; }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headerLines,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_TIMEOUT => 20,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
    ]);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => $body === false ? '' : (string)$body, 'error' => $err];
}

function http_post_json(string $url, array $headers, array $payload, bool $verifySsl): array {
    $ch = curl_init($url);
    $headerLines = [];
    foreach ($headers as $k => $v) { $headerLines[] = $k . ': ' . $v; }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headerLines,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 35,
        CURLOPT_CONNECTTIMEOUT => 8,
        CURLOPT_SSL_VERIFYPEER => $verifySsl,
        CURLOPT_SSL_VERIFYHOST => $verifySsl ? 2 : 0,
    ]);
    $body = curl_exec($ch);
    $err = curl_error($ch);
    $status = (int)curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);
    return ['status' => $status, 'body' => $body === false ? '' : (string)$body, 'error' => $err];
}

function read_token_cache(string $cacheFile): ?array {
    if (!is_file($cacheFile)) return null;
    $raw = @file_get_contents($cacheFile);
    if ($raw === false) return null;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function write_token_cache(string $cacheFile, array $data): void {
    @file_put_contents($cacheFile, json_encode($data, JSON_UNESCAPED_UNICODE), LOCK_EX);
}

function get_cached_access_token(string $cacheFile): ?string {
    $cache = read_token_cache($cacheFile);
    if (is_array($cache) && !empty($cache['access_token'])) {
        $expiresAt = (int)($cache['expires_at'] ?? 0);
        if (time() < ($expiresAt - 60)) {
            return (string)$cache['access_token'];
        }
    }
    return null;
}

function token_expires_soon(string $cacheFile, int $marginSec = 600): bool {
    $cache = read_token_cache($cacheFile);
    if (!is_array($cache) || empty($cache['access_token'])) return true;
    $expiresAt = (int)($cache['expires_at'] ?? 0);
    return time() >= ($expiresAt - $marginSec);
}

function refresh_access_token_bg(string $oauthUrl, string $authKey, string $scope, bool $verifySsl, string $cacheFile): void {
    $lockFile = $cacheFile . '.lock';
    $fp = @fopen($lockFile, 'c');
    if ($fp && !@flock($fp, LOCK_EX | LOCK_NB)) { @fclose($fp); return; }
    try {
        $cache = read_token_cache($cacheFile);
        $expiresAt = is_array($cache) ? (int)($cache['expires_at'] ?? 0) : 0;
        if ($expiresAt > time() + 600) return;
        $headers = [
            'Content-Type' => 'application/x-www-form-urlencoded',
            'Accept' => 'application/json',
            'RqUID' => bin2hex(random_bytes(16)),
            'Authorization' => 'Basic ' . $authKey,
        ];
        $res = http_post_form($oauthUrl, $headers, ['scope' => $scope], $verifySsl);
        if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) return;
        $payload = json_decode($res['body'], true);
        if (!is_array($payload) || empty($payload['access_token'])) return;
        $token = (string)$payload['access_token'];
        $newExp = time() + 29 * 60;
        if (isset($payload['expires_at'])) {
            $exp = (float)$payload['expires_at'];
            if ($exp > 1000000000000) { $exp = $exp / 1000.0; }
            if ($exp > 0) { $newExp = (int)$exp; }
        }
        write_token_cache($cacheFile, ['access_token' => $token, 'expires_at' => $newExp]);
    } finally {
        if ($fp) { @flock($fp, LOCK_UN); @fclose($fp); }
    }
}

if ($authKey === '' || $authKey === 'PASTE_YOUR_AUTHORIZATION_KEY_HERE') {
    respond(500, ['error' => 'GigaChat auth key is not configured']);
}

$raw = file_get_contents('php://input');
$req = json_decode($raw ?: '', true);
if (!is_array($req)) {
    respond(400, ['error' => 'Invalid JSON']);
}
$message = trim((string)($req['message'] ?? ''));
if ($message === '') {
    respond(400, ['error' => 'Message is empty']);
}
$history = $req['history'] ?? [];
if (!is_array($history)) { $history = []; }

$safeHistory = [];
$history = array_slice($history, -12);
foreach ($history as $item) {
    if (!is_array($item)) continue;
    $role = trim((string)($item['role'] ?? ''));
    $content = trim((string)($item['content'] ?? ''));
    if (($role === 'user' || $role === 'assistant') && $content !== '') {
        $safeHistory[] = ['role' => $role, 'content' => $content];
    }
}

$messages = [['role' => 'system', 'content' => $SYSTEM_PROMPT]];
foreach ($safeHistory as $m) { $messages[] = $m; }
$messages[] = ['role' => 'user', 'content' => $message];

$token = get_cached_access_token($cacheFile);
if ($token === null) {
    respond(503, ['error' => 'Token expired, retry', 'retry' => true, 'need_refresh' => true]);
}

$payload = [
    'model' => $model,
    'messages' => $messages,
    'temperature' => 0.2,
    'n' => 1,
];
$res = http_post_json($CHAT_URL, [
    'Content-Type' => 'application/json',
    'Accept' => 'application/json',
    'Authorization' => 'Bearer ' . $token,
], $payload, $verifySsl);

if ($res['status'] === 401) {
    @unlink($cacheFile);
    respond(503, ['error' => 'Unauthorized, retry', 'retry' => true, 'need_refresh' => true]);
}

if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
    respond(502, ['error' => 'GigaChat API request failed: ' . ($res['error'] ?: ('HTTP ' . $res['status']))]);
}

$data = json_decode($res['body'], true);
$answer = $data['choices'][0]['message']['content'] ?? '';
if (!is_string($answer) || trim($answer) === '') {
    respond(502, ['error' => 'Unexpected response from GigaChat']);
}

$shouldProactiveRefresh = token_expires_soon($cacheFile, 600);
respond(200, ['answer' => trim($answer)], $shouldProactiveRefresh);
if ($shouldProactiveRefresh) {
    ignore_user_abort(true);
    @set_time_limit(40);
    refresh_access_token_bg($OAUTH_URL, $authKey, $scope, $verifySsl, $cacheFile);
}
