<?php
putenv('DB_CONNECTION=sqlite');
putenv('DB_DATABASE=' . __DIR__ . '/storage/database.sqlite');
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
$kernel->bootstrap();

$repo = app(\OMS\Orders\Repositories\OrderRepository::class);
$orders = $repo->paginate(['search' => 'zzz']);
echo count($orders->items()) . "\n";
$orders2 = $repo->paginate(['search' => '1000']);
echo count($orders2->items()) . "\n";
