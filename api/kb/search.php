<?php
declare(strict_types=1);

// Простой локальный RAG-поиск по текстовым документам базы знаний.
// Никаких внешних сервисов и индексов: файлы *.txt из kb/documents читаются напрямую.

function kb_lower(string $s): string
{
    if (function_exists('mb_strtolower')) {
        return mb_strtolower($s, 'UTF-8');
    }
    return strtolower($s);
}

function kb_tokens(string $s): array
{
    $s = kb_lower($s);
    preg_match_all('/[\p{L}\p{N}]+/u', $s, $m);
    $stop = [
        'и', 'в', 'во', 'не', 'что', 'как', 'для', 'по', 'на', 'с', 'со', 'из', 'от', 'до', 'при',
        'или', 'а', 'но', 'же', 'бы', 'ли', 'у', 'о', 'об', 'обо', 'та', 'то', 'это', 'тот', 'такой',
        'если', 'чтобы', 'за', 'под', 'над', 'про', 'без', 'к', 'ко', 'я', 'вы', 'мы', 'он', 'она',
        'мой', 'ваш', 'наш', 'все', 'всего', 'может', 'можно', 'нужно', 'будет', 'был', 'была',
    ];
    $out = [];
    foreach ($m[0] as $w) {
        if (strlen($w) > 4 && !in_array($w, $stop, true)) { // >2 символов кириллицы в UTF-8
            $out[] = $w;
        }
    }
    return array_values(array_unique($out));
}

function kb_load_chunks(string $dir): array
{
    $files = glob(rtrim($dir, '/\\') . '/*.txt');
    if (!is_array($files)) {
        return [];
    }
    sort($files);
    $chunks = [];
    foreach ($files as $file) {
        $raw = (string)@file_get_contents($file);
        if ($raw === '') {
            continue;
        }
        $source = basename($file);
        $title = $source;
        $url = '';
        $lines = preg_split('/\R/u', $raw) ?: [];
        $bodyStart = 0;
        foreach ($lines as $i => $line) {
            if (preg_match('/^#\s*SOURCE:\s*(.+)$/u', $line, $mm)) {
                $source = trim($mm[1]);
                $bodyStart = $i + 1;
            } elseif (preg_match('/^#\s*TITLE:\s*(.+)$/u', $line, $mm)) {
                $title = trim($mm[1]);
                $bodyStart = $i + 1;
            } elseif (preg_match('/^#\s*URL:\s*(.+)$/u', $line, $mm)) {
                $url = trim($mm[1]);
                $bodyStart = $i + 1;
            }
        }
        $body = implode("\n", array_slice($lines, $bodyStart));
        $body = trim($body);
        if ($body === '') {
            continue;
        }
        $flat = preg_replace('/\s+/u', ' ', $body) ?: $body;
        $words = preg_split('/\s+/u', trim($flat)) ?: [];
        $buffer = '';
        $recent = [];
        foreach ($words as $w) {
            if ($buffer !== '' && strlen($buffer) + strlen($w) + 1 > 1800) {
                $chunks[] = ['title' => $title, 'url' => $url, 'source' => $source, 'text' => trim($buffer)];
                $recent = array_slice($recent, -18); // небольшое перекрытие для контекста
                $buffer = implode(' ', $recent);
            }
            $buffer .= ($buffer === '' ? '' : ' ') . $w;
            $recent[] = $w;
            if (count($recent) > 24) {
                $recent = array_slice($recent, -24);
            }
        }
        if (trim($buffer) !== '') {
            $chunks[] = ['title' => $title, 'url' => $url, 'source' => $source, 'text' => trim($buffer)];
        }
    }
    return $chunks;
}

function kb_search(string $query, string $dir, int $limit = 4, int $maxChars = 3600): string
{
    $qTokens = kb_tokens($query);
    if (count($qTokens) === 0) {
        return '';
    }
    $phrase = implode(' ', $qTokens);
    $scored = [];
    foreach (kb_load_chunks($dir) as $chunk) {
        $textLower = kb_lower($chunk['text']);
        $titleLower = kb_lower($chunk['title']);
        $score = 0.0;
        foreach ($qTokens as $t) {
            $pattern = '/(?<![\p{L}\p{N}])' . preg_quote($t, '/') . '(?![\p{L}\p{N}])/u';
            if (preg_match($pattern, $textLower)) {
                $score += 1.0;
            }
            if (strpos($titleLower, $t) !== false) {
                $score += 1.5;
            }
        }
        if ($score > 0 && strpos($textLower, $phrase) !== false) {
            $score += 3.0;
        }
        if ($score > 0) {
            $chunk['score'] = $score;
            $scored[] = $chunk;
        }
    }
    if (count($scored) === 0) {
        return '';
    }
    usort($scored, function ($a, $b) {
        return ($b['score'] <=> $a['score']) ?: strcmp($a['title'], $b['title']);
    });

    $out = '';
    $used = 0;
    $n = 0;
    foreach ($scored as $chunk) {
        if ($n >= $limit || $used >= $maxChars) {
            break;
        }
        $ref = $chunk['url'] !== '' ? $chunk['url'] : $chunk['source'];
        $block = '[' . ($n + 1) . '] «' . $chunk['title'] . '» — ' . $ref . "\n" . $chunk['text'] . "\n\n";
        if ($used + strlen($block) > $maxChars && $n > 0) {
            break;
        }
        $out .= $block;
        $used += strlen($block);
        $n++;
    }
    return trim($out);
}
