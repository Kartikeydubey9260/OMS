<?php
putenv('DB_CONNECTION=mysql');
putenv('DB_HOST=127.0.0.1');
putenv('DB_PORT=3306');
putenv('DB_DATABASE=oms_e2e');
putenv('DB_USERNAME=root');
putenv('DB_PASSWORD=');
require 'vendor/autoload.php';
$app = require_once 'bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();

$repo = app(\OMS\Orders\Repositories\OrderRepository::class);
$orders = $repo->paginate(['search' => 'zzz-no-match']);
echo "Count: " . $orders->count() . "\n";
