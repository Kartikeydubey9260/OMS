<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Hash;
use OMS\Users\Models\User;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

function userWithPassword(string $role = 'admin', array $attrs = []): User
{
    return makeUser($role, $attrs + ['password' => Hash::make('secret-pass-1')]);
}

it('logs in with valid credentials and returns a token, role and permissions', function () {
    $user = userWithPassword('manager');

    postJson('/api/login', ['email' => $user->email, 'password' => 'secret-pass-1'])
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonStructure(['data' => ['token', 'user' => ['id', 'name', 'email', 'role', 'permissions']]])
        ->assertJsonPath('data.user.role', 'manager')
        ->assertJsonMissingPath('data.user.password');
});

it('rejects wrong credentials with 401 INVALID_CREDENTIALS', function () {
    $user = userWithPassword();

    postJson('/api/login', ['email' => $user->email, 'password' => 'wrong'])
        ->assertUnauthorized()
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'INVALID_CREDENTIALS')
        ->assertJsonMissingPath('data.token');
});

it('does not reveal whether the email exists', function () {
    $a = postJson('/api/login', ['email' => 'nobody@oms.test', 'password' => 'x'])->json('message');
    $user = userWithPassword();
    $b = postJson('/api/login', ['email' => $user->email, 'password' => 'x'])->json('message');

    expect($a)->toBe($b);
});

it('blocks inactive users from logging in', function () {
    $user = userWithPassword('staff', ['is_active' => false]);

    postJson('/api/login', ['email' => $user->email, 'password' => 'secret-pass-1'])->assertUnauthorized();
});

it('validates the login payload', function () {
    postJson('/api/login', [])->assertUnprocessable()->assertJsonValidationErrors(['email', 'password']);
});

it('throttles repeated failed logins', function () {
    config(['oms.login_throttle' => 5]);
    $user = userWithPassword();

    foreach (range(1, 5) as $i) {
        postJson('/api/login', ['email' => $user->email, 'password' => 'bad'])->assertUnauthorized();
    }
    postJson('/api/login', ['email' => $user->email, 'password' => 'bad'])
        ->assertStatus(429)
        ->assertJsonPath('code', 'TOO_MANY_REQUESTS');
});

it('returns the authenticated user on /me', function () {
    $user = actingAsRole('staff');

    getJson('/api/me')->assertOk()->assertJsonPath('data.email', $user->email)->assertJsonPath('data.role', 'staff');
});

it('protects every business endpoint when unauthenticated', function (string $uri) {
    getJson($uri)->assertUnauthorized()->assertJsonPath('code', 'UNAUTHENTICATED');
})->with(['/api/me', '/api/orders', '/api/customers', '/api/products', '/api/users', '/api/dashboard/summary', '/api/audit-logs', '/api/notifications']);

it('revokes the token on logout', function () {
    $user = userWithPassword();
    $token = postJson('/api/login', ['email' => $user->email, 'password' => 'secret-pass-1'])->json('data.token');

    $this->withToken($token)->postJson('/api/logout')->assertOk();
    app('auth')->forgetGuards();

    $this->withToken($token)->getJson('/api/me')->assertUnauthorized();
});

it('exposes a public health endpoint', function () {
    getJson('/api/health')->assertOk()->assertJsonPath('success', true);
});
