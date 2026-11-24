<?php
declare(strict_types=1);

// Раздел «Knowledge Base»: загрузка/удаление документов для RAG-поиска.
// Доступ только по токену kb_admin_token из api/config.php.

header('Content-Type: application/json; charset=utf-8');

$configPath = __DIR__ . '/config.php';
$config = is_file($configPath) ? require $configPath : [];
if (!is_array($config)) {
    $config = [];
}
$adminToken = trim((string)($config['kb_admin_token'] ?? ''));

function kb_respond(int $code, array $data): void
{
    http_response_code($code);
    echo json_encode($data, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

if ($adminToken === '' || $adminToken === 'CHANGE_ME') {
    kb_respond(403, ['error' => 'Knowledge Base отключён: задайте kb_admin_token в api/config.php']);
}

$authHeader = (string)($_SERVER['HTTP_AUTHORIZATION'] ?? '');
$xToken = (string)($_SERVER['HTTP_X_KB_TOKEN'] ?? '');
$givenToken = '';
if (preg_match('/^Bearer\s+(.+)$/i', $authHeader, $m)) {
    $givenToken = trim($m[1]);
} elseif ($xToken !== '') {
    // Некоторые хостинги не передают заголовок Authorization в PHP
    $givenToken = $xToken;
}
if (!hash_equals($adminToken, $givenToken)) {
    kb_respond(401, ['error' => 'Неверный токен администратора базы знаний']);
}

$docsDir = __DIR__ . '/kb/documents';
if (!is_dir($docsDir)) {
    @mkdir($docsDir, 0755, true);
}

function kb_safe_name(string $name): string
{
    $name = basename(str_replace('\\', '/', $name));
    $name = preg_replace('/[^\w.\-\x{0400}-\x{04FF}]/u', '_', $name) ?: 'document.txt';
    return $name === '' ? 'document.txt' : $name;
}

function kb_header(string $title, string $source, string $url): string
{
    return '# SOURCE: ' . str_replace("\n", ' ', $source) . "\n"
        . '# TITLE: ' . str_replace("\n", ' ', $title) . "\n"
        . '# URL: ' . str_replace("\n", ' ', $url) . "\n\n";
}

function kb_title_from_file(string $file): string
{
    $raw = (string)@file_get_contents($file);
    if (preg_match('/^#\s*TITLE:\s*(.+)$/mu', $raw, $m)) {
        return trim($m[1]);
    }
    return basename($file);
}

$action = (string)($_GET['action'] ?? $_POST['action'] ?? 'list');

if ($action === 'list') {
    $files = glob($docsDir . '/*.txt') ?: [];
    sort($files);
    $items = [];
    foreach ($files as $file) {
        $items[] = [
            'name' => basename($file),
            'title' => kb_title_from_file($file),
            'size' => filesize($file),
            'modified' => date('Y-m-d H:i', (int)filemtime($file)),
        ];
    }
    kb_respond(200, ['documents' => $items]);
}

if ($action === 'upload') {
    $file = $_FILES['file'] ?? null;
    if (!is_array($file) || (int)($file['error'] ?? 1) !== UPLOAD_ERR_OK || !is_uploaded_file((string)$file['tmp_name'])) {
        kb_respond(400, ['error' => 'Файл не загружен']);
    }
    $origName = kb_safe_name((string)$file['name']);
    $ext = strtolower((string)pathinfo($origName, PATHINFO_EXTENSION));
    if (!in_array($ext, ['txt', 'md', 'html', 'pdf'], true)) {
        kb_respond(400, ['error' => 'Поддерживаются .txt, .md, .html и .pdf']);
    }
    $base = pathinfo($origName, PATHINFO_FILENAME);
    $title = trim((string)($_POST['title'] ?? $base));
    $url = trim((string)($_POST['url'] ?? ''));
    $content = '';

    if ($ext === 'pdf') {
        $tmp = sys_get_temp_dir() . '/kb_' . bin2hex(random_bytes(6)) . '.pdf';
        @move_uploaded_file((string)$file['tmp_name'], $tmp);
        if (function_exists('shell_exec')) {
            $out = @shell_exec('pdftotext -layout ' . escapeshellarg($tmp) . ' - 2>/dev/null');
            if (is_string($out)) {
                $content = $out;
            }
        }
        @unlink($tmp);
        if (trim($content) === '' && isset($_FILES['text_file']) && is_array($_FILES['text_file'])
            && (int)($_FILES['text_file']['error'] ?? 1) === UPLOAD_ERR_OK) {
            $content = (string)@file_get_contents((string)$_FILES['text_file']['tmp_name']);
        }
        if (trim($content) === '') {
            kb_respond(400, ['error' => 'Не удалось извлечь текст из PDF. Загрузите также текстовый файл в поле «Текст PDF (optional)» или пришлите .txt.']);
        }
    } else {
        $content = (string)@file_get_contents((string)$file['tmp_name']);
        $content = html_entity_decode($content, ENT_QUOTES | ENT_HTML5, 'UTF-8');
        if ($ext === 'html') {
            $content = strip_tags($content);
            $content = preg_replace('/[ \t]+/u', ' ', $content) ?: $content;
            $content = preg_replace('/\n\s*\n+/u', "\n\n", $content) ?: $content;
        }
    }

    $name = kb_safe_name((preg_match('/^\d+-/', $base) ? '' : '03-') . $base . '.txt');
    $ok = @file_put_contents($docsDir . '/' . $name, kb_header($title, $origName, $url) . trim($content) . "\n", LOCK_EX);
    if ($ok === false) {
        kb_respond(500, ['error' => 'Не удалось записать документ. Проверьте права на папку api/kb/documents']);
    }
    $length = function_exists('mb_strlen') ? mb_strlen($content, 'UTF-8') : strlen($content);
    kb_respond(200, ['ok' => true, 'name' => $name, 'title' => $title, 'chars' => $length]);
}

if ($action === 'delete') {
    $raw = file_get_contents('php://input');
    $data = json_decode($raw ?: '', true);
    $name = is_array($data) ? (string)($data['name'] ?? '') : (string)($_POST['name'] ?? '');
    $name = kb_safe_name($name);
    if ($name === '' || substr($name, -4) !== '.txt') {
        kb_respond(400, ['error' => 'Укажите имя .txt документа']);
    }
    $path = $docsDir . '/' . $name;
    if (!is_file($path) || !@unlink($path)) {
        kb_respond(404, ['error' => 'Документ не найден']);
    }
    kb_respond(200, ['ok' => true, 'name' => $name]);
}

kb_respond(400, ['error' => 'Неизвестное действие']);
