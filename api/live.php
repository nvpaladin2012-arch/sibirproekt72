<?php
declare(strict_types=1);

// Серверная часть «живого» чата: присутствие посетителей, активные приглашения,
// ретрансляция сообщений оператора и панель оператора. Хранилище — JSON-файлы
// с коротким TTL. Персональные данные (имена, телефоны, e-mail) не собираются.

header('Content-Type: application/json; charset=utf-8');

$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
$allowedOrigins = [
    'https://sibirproekt72.ru',
    'https://www.sibirproekt72.ru',
    'http://localhost:8080',
    'http://127.0.0.1:8080',
];
if ($origin && in_array($origin, $allowedOrigins, true)) {
    header('Access-Control-Allow-Origin: ' . $origin);
    header('Vary: Origin');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');
header('Cache-Control: no-store');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

function respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function isHttps(): bool
{
    return (!empty($_SERVER['HTTPS']) && $_SERVER['HTTPS'] !== 'off')
        || (($_SERVER['HTTP_X_FORWARDED_PROTO'] ?? '') === 'https');
}

function readBody(): array
{
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return is_array($_POST) ? $_POST : [];
    }
    $data = json_decode($raw, true);
    return is_array($data) ? $data : (is_array($_POST) ? $_POST : []);
}

function readJson(string $path, $default)
{
    if (!is_file($path)) return $default;
    $raw = @file_get_contents($path);
    if ($raw === false) return $default;
    $data = json_decode($raw, true);
    return is_array($data) ? $data : $default;
}

function writeJson(string $path, array $data): bool
{
    $tmp = $path . '.tmp.' . bin2hex(random_bytes(4));
    if (@file_put_contents($tmp, json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES), LOCK_EX) === false) {
        return false;
    }
    @rename($tmp, $path);
    return true;
}

function validId(string $id): bool
{
    return (bool)preg_match('/^[A-Za-z0-9_-]{8,64}$/', $id);
}

function cleanText($value, int $max = 4000): string
{
    $s = trim((string)$value);
    $s = preg_replace('/[\x00-\x08\x0B\x0C\x0E-\x1F]/u', '', $s) ?? '';
    return mb_substr($s, 0, $max);
}

$dataDir = __DIR__ . '/live-data';
if (!is_dir($dataDir)) @mkdir($dataDir, 0777, true);
if (!is_dir($dataDir) || !is_writable($dataDir)) {
    respond(500, ['ok' => false, 'error' => 'Хранилище чата недоступно для записи']);
}

$visitorsFile = $dataDir . '/visitors.json';
$messagesFile = $dataDir . '/messages.json';
$invitesFile  = $dataDir . '/invites.json';
$sessionsFile = $dataDir . '/sessions.json';
$phrasesFile  = $dataDir . '/phrases.json';

$now = time();

$visitors = readJson($visitorsFile, []);
$messages = readJson($messagesFile, []);
$invites  = readJson($invitesFile, []);
$sessions = readJson($sessionsFile, []);

function cleanupData(array &$visitors, array &$messages, array &$invites, array &$sessions, int $now): void
{
    foreach ($visitors as $id => $v) {
        $last = (int)($v['last_seen'] ?? 0);
        if ($last < $now - 120) {
            unset($visitors[$id], $messages[$id], $invites[$id]);
        } else {
            $list = $messages[$id] ?? [];
            $kept = [];
            foreach ($list as $m) {
                if ((int)($m['ts'] ?? 0) >= $now - 86400) $kept[] = $m;
            }
            if (count($kept) > 200) $kept = array_slice($kept, -200);
            $messages[$id] = $kept;
        }
    }
    foreach ($sessions as $token => $s) {
        if ((int)($s['expires'] ?? 0) < $now) unset($sessions[$token]);
    }
}

function currentToken(): string
{
    return (string)($_COOKIE['sp_live_session'] ?? '');
}

function isOperator(array $sessions): bool
{
    $token = currentToken();
    if ($token === '') return false;
    $key = hash('sha256', $token);
    if (!isset($sessions[$key])) return false;
    return (int)($sessions[$key]['expires'] ?? 0) >= time();
}

function verifyPassword(string $password): bool
{
    $cfgPath = __DIR__ . '/live-auth.php';
    if (!is_file($cfgPath)) return false;
    $cfg = require $cfgPath;
    if (!is_array($cfg) || empty($cfg['salt']) || empty($cfg['password_hash'])) return false;
    $hash = hash('sha256', (string)$cfg['salt'] . $password);
    return hash_equals((string)$cfg['password_hash'], $hash);
}

function nextMessageId(array $list): int
{
    $max = 0;
    foreach ($list as $m) $max = max($max, (int)($m['id'] ?? 0));
    return $max + 1;
}

function appendMessage(array &$messages, string $id, string $role, string $text, int $now): int
{
    $list = $messages[$id] ?? [];
    $msgId = nextMessageId($list);
    $list[] = ['id' => $msgId, 'role' => $role, 'text' => $text, 'ts' => $now];
    if (count($list) > 200) $list = array_slice($list, -200);
    $messages[$id] = $list;
    return $msgId;
}

$body = readBody();
$action = (string)($_GET['action'] ?? ($body['action'] ?? ''));

cleanupData($visitors, $messages, $invites, $sessions, $now);

switch ($action) {
    case 'health':
        respond(200, ['ok' => true, 'feature' => 'live-chat', 'version' => 1]);
        break;

    case 'login':
        $password = (string)($body['password'] ?? '');
        if (!verifyPassword($password)) {
            respond(401, ['ok' => false, 'error' => 'Неверный пароль']);
        }
        $token = bin2hex(random_bytes(32));
        $sessions[hash('sha256', $token)] = ['created' => $now, 'expires' => $now + 8 * 3600];
        writeJson($sessionsFile, $sessions);
        $cookie = 'sp_live_session=' . $token . '; Path=/; Max-Age=28800; HttpOnly; SameSite=Lax' . (isHttps() ? '; Secure' : '');
        header('Set-Cookie: ' . $cookie);
        respond(200, ['ok' => true]);
        break;

    case 'logout':
        $token = currentToken();
        if ($token !== '') unset($sessions[hash('sha256', $token)]);
        writeJson($sessionsFile, $sessions);
        header('Set-Cookie: sp_live_session=; Path=/; Max-Age=0; HttpOnly; SameSite=Lax' . (isHttps() ? '; Secure' : ''));
        respond(200, ['ok' => true]);
        break;

    case 'ping':
    case 'poll':
        $id = (string)($body['id'] ?? ($_GET['id'] ?? ''));
        if (!validId($id)) respond(400, ['ok' => false, 'error' => 'Некорректный идентификатор посетителя']);
        $isNew = !isset($visitors[$id]);
        $v = $visitors[$id] ?? [
            'id' => $id,
            'started' => $now,
            'mode' => 'ai',
            'last_message' => '',
            'unread' => 0,
        ];
        $v['url'] = cleanText($body['url'] ?? ($_GET['url'] ?? ''), 500);
        $v['title'] = cleanText($body['title'] ?? ($_GET['title'] ?? ''), 200);
        $started = (int)($body['started'] ?? ($_GET['started'] ?? 0));
        if ($started > 0 && $started <= $now) $v['started'] = $started;
        $v['last_seen'] = $now;
        $visitors[$id] = $v;
        writeJson($visitorsFile, $visitors);

        $since = (int)($body['since'] ?? ($_GET['since'] ?? 0));
        $list = $messages[$id] ?? [];
        $fresh = [];
        foreach ($list as $m) {
            if ((int)($m['id'] ?? 0) > $since) $fresh[] = $m;
        }
        foreach ($fresh as $m) {
            if (($m['role'] ?? '') === 'operator') $v['visitor_unread'] = 0;
        }
        $visitors[$id] = $v;
        writeJson($visitorsFile, $visitors);

        $invite = null;
        if (isset($invites[$id])) {
            $invite = [
                'id' => (int)($invites[$id]['id'] ?? 0),
                'text' => (string)($invites[$id]['text'] ?? ''),
            ];
        }
        respond(200, [
            'ok' => true,
            'mode' => (string)($v['mode'] ?? 'ai'),
            'invite' => $invite,
            'messages' => $fresh,
            'last_message_id' => nextMessageId($list) - 1,
            'server_time' => $now,
            'visitor_seconds' => max(0, $now - (int)($v['started'] ?? $now)),
        ]);
        break;

    case 'invite_done':
        $id = (string)($body['id'] ?? '');
        $inviteId = (int)($body['invite_id'] ?? 0);
        if (validId($id) && isset($invites[$id]) && (int)($invites[$id]['id'] ?? 0) === $inviteId) {
            unset($invites[$id]);
            writeJson($invitesFile, $invites);
        }
        respond(200, ['ok' => true]);
        break;

    case 'visitors':
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        $out = [];
        foreach ($visitors as $id => $v) {
            if ((int)($v['last_seen'] ?? 0) < $now - 90) continue;
            $list = $messages[$id] ?? [];
            $last = end($list);
            $out[] = [
                'id' => $id,
                'url' => (string)($v['url'] ?? ''),
                'title' => (string)($v['title'] ?? ''),
                'started' => (int)($v['started'] ?? $now),
                'seconds' => max(0, $now - (int)($v['started'] ?? $now)),
                'last_seen' => (int)($v['last_seen'] ?? $now),
                'mode' => (string)($v['mode'] ?? 'ai'),
                'unread' => (int)($v['unread'] ?? 0),
                'has_chat' => count($list) > 0,
                'last_message' => is_array($last) ? (string)($last['text'] ?? '') : '',
                'last_message_id' => nextMessageId($list) - 1,
            ];
        }
        usort($out, function ($a, $b) { return $b['last_seen'] <=> $a['last_seen']; });
        respond(200, ['ok' => true, 'visitors' => array_slice($out, 0, 100), 'server_time' => $now]);
        break;

    case 'messages':
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        $id = (string)($_GET['id'] ?? ($body['id'] ?? ''));
        if (!validId($id)) respond(400, ['ok' => false, 'error' => 'Некорректный идентификатор']);
        $since = (int)($_GET['since'] ?? ($body['since'] ?? 0));
        $list = $messages[$id] ?? [];
        $fresh = [];
        foreach ($list as $m) {
            if ((int)($m['id'] ?? 0) > $since) $fresh[] = $m;
        }
        if (isset($visitors[$id])) {
            $visitors[$id]['unread'] = 0;
            writeJson($visitorsFile, $visitors);
        }
        respond(200, ['ok' => true, 'messages' => $fresh, 'mode' => (string)($visitors[$id]['mode'] ?? 'ai')]);
        break;

    case 'message':
        $id = cleanText($body['id'] ?? '', 64);
        $text = cleanText($body['text'] ?? '', 4000);
        if (!validId($id) || $text === '') respond(400, ['ok' => false, 'error' => 'Пустое сообщение']);
        $operator = isOperator($sessions);
        $role = $operator ? 'operator' : 'user';
        if (!$operator) {
            $r = (string)($body['role'] ?? '');
            if ($r === 'assistant' || $r === 'user') $role = $r; // зеркало сообщений виджета для контекста оператора
        }
        if (!isset($visitors[$id])) {
            $visitors[$id] = ['id' => $id, 'started' => $now, 'last_seen' => $now, 'mode' => 'ai', 'unread' => 0];
        }
        $v = $visitors[$id];
        if ($operator) {
            $v['mode'] = 'operator';
            unset($invites[$id]);
        } elseif ($role === 'user') {
            $v['unread'] = (int)($v['unread'] ?? 0) + 1;
        }
        $v['last_seen'] = $now;
        $v['last_message'] = $text;
        $visitors[$id] = $v;
        $msgId = appendMessage($messages, $id, $role, $text, $now);
        writeJson($visitorsFile, $visitors);
        writeJson($messagesFile, $messages);
        writeJson($invitesFile, $invites);
        respond(200, ['ok' => true, 'id' => $msgId, 'role' => $role]);
        break;

    case 'invite':
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        $id = (string)($body['id'] ?? '');
        $text = cleanText($body['text'] ?? '', 500);
        if (!validId($id) || $text === '') respond(400, ['ok' => false, 'error' => 'Некорректные данные приглашения']);
        $invites[$id] = ['id' => $now, 'text' => $text, 'ts' => $now];
        writeJson($invitesFile, $invites);
        respond(200, ['ok' => true]);
        break;

    case 'takeover':
    case 'release':
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        $id = (string)($body['id'] ?? '');
        if (!validId($id) || !isset($visitors[$id])) respond(404, ['ok' => false, 'error' => 'Посетитель не найден']);
        $take = $action === 'takeover';
        $visitors[$id]['mode'] = $take ? 'operator' : 'ai';
        $visitors[$id]['last_seen'] = $now;
        $sysText = $take
            ? 'Специалист подключился к диалогу. Отвечать буду здесь, в чате.'
            : 'Диалог передан ИИ-консультанту.';
        appendMessage($messages, $id, 'system', $sysText, $now);
        writeJson($visitorsFile, $visitors);
        writeJson($messagesFile, $messages);
        respond(200, ['ok' => true, 'mode' => $visitors[$id]['mode']]);
        break;

    case 'phrases':
        $defaultPhrases = [
            'Здравствуйте! Чем могу помочь по вашей закупке?',
            'Гарантии от 1 000 ₽, выпуск от 4 часов после согласования макета с заказчиком.',
            'Для оценки достаточно ИКЗ, суммы и срока контракта — имя, телефон и e-mail не нужны.',
            'Чек-лист перед подачей заявки: https://sibirproekt72.ru/checklist.html',
            'Подскажите, пожалуйста, реестровый номер закупки (ИКЗ) или ссылку на процедуру в ЕИС.',
            'График работы: Пн–Пт 09:00–18:00 (МСК+2), Тюмень.',
        ];
        if (($_SERVER['REQUEST_METHOD'] ?? '') === 'POST') {
            if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
            $phrases = $body['phrases'] ?? [];
            if (!is_array($phrases)) respond(400, ['ok' => false, 'error' => 'Некорректный список фраз']);
            $clean = [];
            foreach ($phrases as $p) {
                $p = cleanText($p, 500);
                if ($p !== '') $clean[] = $p;
            }
            writeJson($phrasesFile, ['items' => array_slice($clean, 0, 50)]);
            respond(200, ['ok' => true, 'phrases' => $clean]);
        }
        $saved = readJson($phrasesFile, []);
        $items = is_array($saved['items'] ?? null) ? $saved['items'] : $defaultPhrases;
        // На панель оператора фразы отдаём только после входа
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        respond(200, ['ok' => true, 'phrases' => $items]);
        break;

    case 'spellcheck':
        if (!isOperator($sessions)) respond(401, ['ok' => false, 'error' => 'Требуется вход']);
        $text = cleanText($body['text'] ?? '', 4000);
        $errors = [];
        $remote = null;
        $ch = curl_init('https://speller.yandex.net/services/spellservice.json/checkText');
        if ($ch) {
            curl_setopt_array($ch, [
                CURLOPT_POST => true,
                CURLOPT_POSTFIELDS => http_build_query(['text' => $text, 'lang' => 'ru', 'ignoreUrls' => 1]),
                CURLOPT_RETURNTRANSFER => true,
                CURLOPT_TIMEOUT => 6,
                CURLOPT_CONNECTTIMEOUT => 3,
                CURLOPT_SSL_VERIFYPEER => false,
                CURLOPT_SSL_VERIFYHOST => 0,
            ]);
            $resp = curl_exec($ch);
            curl_close($ch);
            if (is_string($resp)) $remote = json_decode($resp, true);
        }
        if (is_array($remote)) {
            foreach ($remote as $e) {
                if (!is_array($e)) continue;
                $errors[] = [
                    'word' => (string)($e['word'] ?? ''),
                    'pos' => (int)($e['col'] ?? 0),
                    'len' => (int)($e['len'] ?? 0),
                    'suggestions' => array_slice(array_values((array)($e['s'] ?? [])), 0, 5),
                ];
            }
            $source = 'yandex';
        } else {
            // Локальный словарь частых опечаток — работает без внешнего сервиса.
            $dict = [
                'гарантийная' => 'гарантийная', 'гарантия' => 'гарантия',
                'калькулятор' => 'калькулятор', 'контракт' => 'контракт',
                'закупка' => 'закупка', 'реквизит' => 'реквизит',
                'пожалуйста' => 'пожалуйста', 'специалист' => 'специалист',
                'электронный' => 'электронный', 'подпись' => 'подпись',
                '截断' => 'ошибка',
            ];
            $typos = [
                'калькулятар' => 'калькулятор', 'кантракт' => 'контракт',
                'гарантия' => 'гарантия', 'пажалуйста' => 'пожалуйста',
                'спецеалист' => 'специалист', 'закувка' => 'закупка',
                'реквизиты' => 'реквизиты', 'ел.подпись' => 'ЭЦП',
                'нужно' => 'нужно', 'икз' => 'ИКЗ',
            ];
            if (preg_match_all('/[\p{L}]+/u', $text, $mm)) {
                foreach ($mm[0] as $word) {
                    $lower = mb_strtolower($word, 'UTF-8');
                    if (isset($typos[$lower]) && $typos[$lower] !== $lower) {
                        $pos = mb_strpos($text, $word);
                        $errors[] = ['word' => $word, 'pos' => $pos === false ? 0 : $pos, 'len' => mb_strlen($word, 'UTF-8'), 'suggestions' => [$typos[$lower]]];
                    }
                }
            }
            $source = 'local';
        }
        respond(200, ['ok' => true, 'errors' => $errors, 'source' => $source]);
        break;

    default:
        respond(400, ['ok' => false, 'error' => 'Неизвестное действие']);
}
