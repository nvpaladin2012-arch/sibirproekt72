<?php
declare(strict_types=1);

header('Content-Type: application/json; charset=utf-8');
header('Access-Control-Allow-Origin: *');
header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type');

if (($_SERVER['REQUEST_METHOD'] ?? '') === 'OPTIONS') {
    http_response_code(204);
    exit;
}

$configPath = __DIR__ . '/config.php';
$config = is_file($configPath) ? require $configPath : [];
if (!is_array($config)) { $config = []; }

$authKey = trim((string)($config['gigachat_auth_key'] ?? ''));
$scope = trim((string)($config['gigachat_scope'] ?? 'GIGACHAT_API_PERS'));
$verifySsl = (bool)($config['verify_ssl'] ?? false);
$cacheFile = (string)($config['token_cache_file'] ?? (__DIR__ . '/.gigachat_token_cache.json'));
$OAUTH_URL = 'https://ngw.devices.sberbank.ru:9443/api/v2/oauth';

function respond(int $code, array $data): void {
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
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

function token_is_fresh(string $cacheFile, int $marginSec = 120): bool {
    $cache = read_token_cache($cacheFile);
    if (!is_array($cache) || empty($cache['access_token'])) return false;
    $expiresAt = (int)($cache['expires_at'] ?? 0);
    return time() < ($expiresAt - $marginSec);
}

function do_refresh(string $oauthUrl, string $authKey, string $scope, bool $verifySsl, string $cacheFile): array {
    $lockFile = $cacheFile . '.lock';
    $fp = @fopen($lockFile, 'c');
    if ($fp) {
        if (!@flock($fp, LOCK_EX)) { @fclose($fp); $fp = null; }
    }
    try {
        // Re-check after acquiring lock
        if (token_is_fresh($cacheFile, 120)) {
            return ['ok' => true, 'cached' => true];
        }
        $headers = [
            'Content-Type' => 'application/x-www-form-urlencoded',
            'Accept' => 'application/json',
            'RqUID' => bin2hex(random_bytes(16)),
            'Authorization' => 'Basic ' . $authKey,
        ];
        $res = http_post_form($oauthUrl, $headers, ['scope' => $scope], $verifySsl);
        if ($res['error'] || $res['status'] < 200 || $res['status'] >= 300) {
            return ['ok' => false, 'error' => ($res['error'] ?: ('HTTP ' . $res['status']))];
        }
        $payload = json_decode($res['body'], true);
        if (!is_array($payload) || empty($payload['access_token'])) {
            return ['ok' => false, 'error' => 'Invalid OAuth response'];
        }
        $token = (string)$payload['access_token'];
        $expiresAt = time() + 29 * 60;
        if (isset($payload['expires_at'])) {
            $exp = (float)$payload['expires_at'];
            if ($exp > 1000000000000) { $exp = $exp / 1000.0; }
            if ($exp > 0) { $expiresAt = (int)$exp; }
        }
        write_token_cache($cacheFile, ['access_token' => $token, 'expires_at' => $expiresAt]);
        return ['ok' => true, 'cached' => false, 'expires_at' => $expiresAt];
    } finally {
        if ($fp) { @flock($fp, LOCK_UN); @fclose($fp); }
    }
}

if ($authKey === '' || $authKey === 'PASTE_YOUR_AUTHORIZATION_KEY_HERE') {
    respond(500, ['ok' => false, 'error' => 'GigaChat auth key is not configured']);
    exit;
}

// If already fresh, return immediately
if (token_is_fresh($cacheFile, 120)) {
    $cache = read_token_cache($cacheFile);
    respond(200, ['ok' => true, 'cached' => true, 'expires_at' => ($cache['expires_at'] ?? null)]);
    exit;
}

$bg = isset($_GET['bg']) && $_GET['bg'] === '1';
if ($bg) {
    respond(202, ['ok' => true, 'refreshing' => true]);
    if (function_exists('fastcgi_finish_request')) {
        @fastcgi_finish_request();
    } else {
        // try to flush response so client can proceed
        if (function_exists('ob_get_level')) { while (ob_get_level() > 0) { @ob_end_flush(); } }
        @flush();
    }
    ignore_user_abort(true);
    @set_time_limit(40);
    do_refresh($OAUTH_URL, $authKey, $scope, $verifySsl, $cacheFile);
    exit;
}

$result = do_refresh($OAUTH_URL, $authKey, $scope, $verifySsl, $cacheFile);
if (!empty($result['ok'])) {
    respond(200, $result);
} else {
    respond(502, ['ok' => false, 'error' => $result['error'] ?? 'Refresh failed']);
}