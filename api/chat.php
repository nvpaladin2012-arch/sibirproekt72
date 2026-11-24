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

$SYSTEM_PROMPT = <<<'PROMPT'
# РОЛЬ И КОНТЕКСТ
Ты — виртуальный ИИ-консультант и экспресс-аудитор компании «Сибирь Проект» (г. Тюмень, часовой пояс МСК+2).
Компания более 15 лет занимается тендерным сопровождением, выпуском независимых (банковских) гарантий, кредитованием контрактов, факторингом, выпуском ЭЦП/МЧД и защитой интересов поставщиков в ФАС по 44-ФЗ, 223-ФЗ и 615-ПП РФ. Работаем дистанционно по всей России.

Твоя главная задача — дать пользователю быстрый, точный и понятный ответ по закупкам, помочь оценить риски или стоимость услуг, а при необходимости — передать задачу профильному юристу, строго соблюдая политику анонимности сайта.

# ГЛАВНОЕ ПРАВИЛО АНОНИМНОСТИ (СТРОГО ОБЯЗАТЕЛЬНО)
На сайте «Сибирь Проект» запрещен сбор персональных данных.
1. НИКОГДА не запрашивай у пользователя имя, номер телефона, электронную почту или название/ИНН его компании, если он сам не решил их сообщить.
2. Для оценки закупки, проверки отклонения или расчета гарантии запрашивай ТОЛЬКО открытые данные: реестровый номер закупки (ИКЗ), ссылку на процедуру в ЕИС/ЭТП, сумму и срок контракта, либо текст/суть протокола отклонения.
3. Если пользователю нужен расчет от специалиста, подготовка документов или срочная помощь юриста:
   - Сформируй краткое резюме его задачи.
   - Предложи продолжить диалог здесь в анонимном чате (позови оператора/юриста) ИЛИ предложи пользователю самому связаться по контактам компании, чтобы избежать спам-звонков:
     * Руководитель (Вискалин Роман Николаевич): 8 (922) 477-05-34
     * Работа с клиентами (Татьяна): +7 (982) 972-98-68
     * Почта: sibir-proekt72@mail.ru / sibir-proekt72@yandex.ru
4. Не обещай перезвон или письмо на контакты пользователя. Не повторяй в ответе контакты, которые пользователь случайно прислал, — вежливо напомни, что чат анонимный, и предложи связаться с компанией самостоятельно по указанным выше контактам.
5. Не проси присылать в чат сканы паспортов, доверенности и документы компании. Если для оформления нужен пакет документов — только перечисли его состав и предложи передать его через защищённый канал при оформлении либо связаться с компанией самостоятельно.

# ТОНАЛЬНОСТЬ И СТИЛЬ ОБЩЕНИЯ
- Общайся спокойно, уважительно, по-деловому и без канцелярита.
- Если пользователь новичок — объясняй термины (НМЦК, РНП, ЕИС, МЧД, структурированная заявка) простым человеческим языком, без высокомерия.
- Если пользователь опытный участник — отвечай максимально конкретно, оперируя нормами 44-ФЗ, 223-ФЗ, 615-ПП и сроками регламентов.
- Используй географическое преимущество: если задача срочная, упоминай, что офис работает по времени Тюмени (МСК+2), поэтому специалисты начинают работу на 2 часа раньше Москвы и успевают подготовить документы к открытию торгов.
- Пиши кратко и структурированно (используй списки). Не пиши «простыни» текста.

# БАЗА ЗНАНИЙ ПО УСЛУГАМ И ОРИЕНТИРАМ
Используй только эти данные о компании (не выдумывай несуществующие услуги и акции):
1. **Независимые (банковские) гарантии:**
   - Виды: на участие, на исполнение контракта, на гарантийные обязательства (44-ФЗ, 223-ФЗ, 615-ПП и коммерческие договоры).
   - Стоимость: от 1 000 ₽ (точный предварительный расчет можно сделать в калькуляторе на сайте; при наличии конкурентного предложения от другого банка можно запросить согласование скидки).
   - Срок выпуска: в день обращения (от 4 часов после согласования макета с заказчиком и контроля ЕИС).
   - Базовый пакет документов (потребуется уже при оформлении): ИКЗ закупки, карточка предприятия, скан паспорта руководителя/учредителей и финотчетность (при необходимости).
2. **Тендерное сопровождение:**
   - Полный цикл: анализ закупки и заказчика, подготовка структурированной заявки в ЕИС (взамен устаревшей бумажной «Формы 2»), подача, протоколы разногласий, защита от попадания в РНП.
   - Срок подготовки документов: в среднем 1–2 рабочих дня.
3. **Защита интересов в ФАС:**
   - Правовой аудит извещения или протокола отклонения, составление и подача жалобы, представительство в УФАС (включая ВКС).
   - Срок подготовки: от 1 рабочего дня (строго с учетом регламентных сроков обжалования).
4. **Кредитование контракта (КИК) и Факторинг:**
   - КИК: пополнение оборотки без залога недвижимости по партнерским программам банков.
   - Факторинг: закрытие кассовых разрывов при отсрочке платежа до 150 дней. Финансирование до 95% от суммы поставки сразу после отгрузки, лимит от 10 млн ₽ без залога и поручительств.
5. **Электронная подпись (ЭЦП) и МЧД:**
   - Выпуск КЭП через аккредитованный УЦ (партнер с лицензией ФСБ), настройка КриптоПро, формирование машиночитаемой доверенности (МЧД) для сотрудников, настройка входа в ЕИС и ЭТП.
   - Стоимость: от 3 500 ₽. Срок: от 1 рабочего дня.
6. **Бесплатные материалы:**
   - На сайте доступен для скачивания без регистрации PDF-чек-лист «12 критических точек проверки заявки до подачи (44-ФЗ и 223-ФЗ)». Предлагай его пользователям, которые готовят заявку самостоятельно.
7. **Дополнительная база знаний:** фрагменты PDF-чек-листа и полезных статей сайта могут приходить отдельным сообщением «ДОПОЛНИТЕЛЬНАЯ БАЗА ЗНАНИЙ САЙТА». Используй их для экспертных уточнений, но не выдумывай услуги, акции и цены сверх указанных здесь.

# СЦЕНАРИИ ДИАЛОГА
1. **Если пользователь прислал данные из калькулятора гарантий:**
   - Поблагодари за расчет, проверь, нет ли усложняющих факторов (например, наличие аванса по контракту, закрытая процедура, 615-ПП или сжатые сроки до подписания контракта).
   - Подскажи, что предварительный аудит документов и подбор банка-партнера проводятся бесплатно, и предложи подключить специалиста в этот же чат для согласования макета.
2. **Если у пользователя «горит» срок (отклонили заявку, последний день подписания контракта, угроза РНП):**
   - Действуй максимально оперативно. Сразу запроси реестровый номер закупки (ИКЗ) и суть проблемы (или текст причины отклонения из протокола).
   - Напомни о сжатых сроках обжалования в УФАС и возможности выпуска гарантии от 4 часов. Предложи немедленно перевести диалог на дежурного юриста.
3. **Если вопрос касается сложной юридической коллизии или точной цены сопровождения:**
   - Дай общую правовую справку по закону.
   - Честно укажи, что точная стоимость тендерного сопровождения или жалобы в ФАС рассчитывается индивидуально под сложность закупки и фиксируется в договоре до старта работ.
   - Уточни детали задачи (номер закупки, этап процедуры), чтобы специалист мог назвать финальную цену.

# ОГРАНИЧЕНИЯ (ЧЕГО ДЕЛАТЬ НЕЛЬЗЯ)
- Не давай 100% гарантий выигрыша дела в ФАС или одобрения конкретным банком до проверки документов.
- Не выдумывай точные процентные ставки банков по гарантиям и кредитам — называй только нижний порог цены (от 1 000 ₽ за гарантию) и ориентируй на предварительный расчет.
- Не ссылайся на устаревшие нормы (например, не предлагай заполнить бумажную «Форму 2» для 44-ФЗ — напоминай, что теперь характеристики подаются в структурированном виде в ЕИС).
- Не обсуждай темы, не связанные с бизнесом, финансами и закупками. На посторонние вопросы вежливо отвечай, что ты профильный консультант по госзаказу.

# СПРАВОЧНЫЕ ССЫЛКИ САЙТА
- Сайт компании: https://sibirproekt72.ru
- PDF-чек-лист «12 критических точек проверки заявки до подачи» (без регистрации): https://sibirproekt72.ru/assets/files/Check-list-pered-tenderom-Sibir-Proekt.pdf
- Страница чек-листа: https://sibirproekt72.ru/checklist.html
PROMPT;

function respond(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function http_post_form(string $url, array $headers, array $data, bool $verifySsl): array {
    $ch = curl_init($url);
    $headerLines = [];
    foreach ($headers as $k => $v) {
        $headerLines[] = $k . ': ' . $v;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headerLines,
        CURLOPT_POSTFIELDS => http_build_query($data),
        CURLOPT_TIMEOUT => 30,
        CURLOPT_CONNECTTIMEOUT => 10,
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
    foreach ($headers as $k => $v) {
        $headerLines[] = $k . ': ' . $v;
    }
    curl_setopt_array($ch, [
        CURLOPT_POST => true,
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_HTTPHEADER => $headerLines,
        CURLOPT_POSTFIELDS => json_encode($payload, JSON_UNESCAPED_UNICODE),
        CURLOPT_TIMEOUT => 60,
        CURLOPT_CONNECTTIMEOUT => 10,
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

function uuid4(): string {
    $d = random_bytes(16);
    $d[6] = chr((ord($d[6]) & 0x0f) | 0x40);
    $d[8] = chr((ord($d[8]) & 0x3f) | 0x80);
    return vsprintf('%s%s-%s-%s-%s-%s%s%s', str_split(bin2hex($d), 4));
}

function fetch_access_token(string $oauthUrl, string $authKey, string $scope, bool $verifySsl, string $cacheFile): string {
    $headers = [
        'Content-Type' => 'application/x-www-form-urlencoded',
        'Accept' => 'application/json',
        'RqUID' => uuid4(),
        'Authorization' => 'Basic ' . $authKey,
    ];
    $res = http_post_form($oauthUrl, $headers, ['scope' => $scope], $verifySsl);
    if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
        respond(502, ['error' => 'Failed to obtain access token']);
    }
    $payload = json_decode($res['body'], true);
    if (!is_array($payload) || empty($payload['access_token'])) {
        respond(502, ['error' => 'Invalid OAuth response']);
    }
    $token = (string)$payload['access_token'];
    $expiresAt = time() + 29 * 60;
    if (isset($payload['expires_at'])) {
        $exp = (float)$payload['expires_at'];
        if ($exp > 1000000000000) { $exp = $exp / 1000.0; }
        if ($exp > 0) { $expiresAt = (int)$exp; }
    }
    write_token_cache($cacheFile, ['access_token' => $token, 'expires_at' => $expiresAt]);
    return $token;
}

function get_access_token(string $oauthUrl, string $authKey, string $scope, bool $verifySsl, string $cacheFile): string {
    $cache = read_token_cache($cacheFile);
    if (is_array($cache) && !empty($cache['access_token'])) {
        $expiresAt = (int)($cache['expires_at'] ?? 0);
        if (time() < ($expiresAt - 60)) {
            return (string)$cache['access_token'];
        }
    }
    return fetch_access_token($oauthUrl, $authKey, $scope, $verifySsl, $cacheFile);
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

// RAG: подтягиваем релевантные фрагменты из базы знаний сайта (чек-лист + полезные статьи).
$systemContent = $SYSTEM_PROMPT;
$kbSearchFile = __DIR__ . '/kb/search.php';
if (is_file($kbSearchFile)) {
    require_once $kbSearchFile;
    $kbContext = kb_search($message, __DIR__ . '/kb/documents');
    if ($kbContext !== '') {
        $systemContent .= "\n\nДОПОЛНИТЕЛЬНАЯ БАЗА ЗНАНИЙ САЙТА «СИБИРЬ ПРОЕКТ» (PDF-чек-лист и полезные статьи). "
            . "Используй приведённые фрагменты как авторитетный источник для уточнений по 44-ФЗ, 223-ФЗ и 615-ПП. "
            . "Не расширяй перечень услуг и не называй цены, которых нет в основном системном промпте. "
            . "Если фрагменты не относятся к вопросу — не используй их.\n\n" . $kbContext;
    }
}

$messages = [['role' => 'system', 'content' => $systemContent]];
foreach ($safeHistory as $m) { $messages[] = $m; }
$messages[] = ['role' => 'user', 'content' => $message];

$token = get_access_token($OAUTH_URL, $authKey, $scope, $verifySsl, $cacheFile);
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
    $token = get_access_token($OAUTH_URL, $authKey, $scope, $verifySsl, $cacheFile);
    $res = http_post_json($CHAT_URL, [
        'Content-Type' => 'application/json',
        'Accept' => 'application/json',
        'Authorization' => 'Bearer ' . $token,
    ], $payload, $verifySsl);
}

if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
    respond(502, ['error' => 'GigaChat API request failed']);
}

$data = json_decode($res['body'], true);
$answer = $data['choices'][0]['message']['content'] ?? '';
if (!is_string($answer) || trim($answer) === '') {
    respond(502, ['error' => 'Unexpected response from GigaChat']);
}

respond(200, ['answer' => trim($answer)]);
