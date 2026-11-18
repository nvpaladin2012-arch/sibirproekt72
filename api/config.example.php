<?php
// Скопируйте этот файл как config.php и заполните значения.
// ВАЖНО: не публикуйте config.php с реальным ключом в публичный репозиторий.

return [
    // Authorization Key из Sber Developers (для заголовка Authorization: Basic <key>)
    'gigachat_auth_key' => 'PASTE_YOUR_AUTHORIZATION_KEY_HERE',

    // Scope: GIGACHAT_API_PERS / GIGACHAT_API_B2B / GIGACHAT_API_CORP
    'gigachat_scope' => 'GIGACHAT_API_PERS',

    // Модель: GigaChat или GigaChat-Pro
    'gigachat_model' => 'GigaChat',

    // Для тестового режима можно отключить проверку SSL (сертификаты Минцифры/цепочка Сбера)
    'verify_ssl' => false,

    // Разрешенные Origin для CORS (оставьте пустым массивом, чтобы разрешить любой)
    'cors_origins' => [
        'https://sibirproekt72.ru',
        'https://www.sibirproekt72.ru',
        'https://nvpaladin2012-arch.github.io',
    ],

    // Путь к файлу кэша токена (должен быть доступен для записи PHP)
    'token_cache_file' => __DIR__ . '/.gigachat_token_cache.json',
];
