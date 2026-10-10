<?php
require 'vendor/autoload.php';
$client = new \GuzzleHttp\Client();
$login = $client->post('http://127.0.0.1:8001/api/login', [
    'json' => [
        'email' => 'manager@example.com',
        'password' => 'password'
    ]
]);
$token = json_decode($login->getBody(), true)['data']['token'];

$res = $client->get('http://127.0.0.1:8001/api/orders?search=zzz-no-match', [
    'headers' => [
        'Authorization' => 'Bearer ' . $token,
        'Accept' => 'application/json'
    ]
]);
$data = json_decode($res->getBody(), true);
echo "Count: " . count($data['data']) . "\n";
