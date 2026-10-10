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

$req = Illuminate\Http\Request::create('/api/customers', 'POST', [
    'name' => 'Dup Test',
    'email' => 'manager@example.com' // existing email
]);
$req->headers->set('Accept', 'application/json');
$req->setUserResolver(function () {
    return OMS\Users\Models\User::where('email', 'manager@example.com')->first();
});
$res = app()->handle($req);
echo $res->getStatusCode() . "\n";
echo $res->getContent() . "\n";
