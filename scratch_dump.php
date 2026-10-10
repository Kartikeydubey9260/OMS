<?php
require __DIR__.'/vendor/autoload.php';
$app = require_once __DIR__.'/bootstrap/app.php';
$app->make(Illuminate\Contracts\Console\Kernel::class)->bootstrap();
$user = OMS\Users\Models\User::where('email', 'like', '%staff2%')->first();
echo json_encode($user->notifications()->get()->toArray(), JSON_PRETTY_PRINT);
