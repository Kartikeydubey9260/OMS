<?php

declare(strict_types=1);

use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/*
 * Authorization must run BEFORE validation, so empty payloads still return 403 (not 422).
 * Matrix: docs/04-api-spec.md "Permission matrix".
 */

dataset('staff_forbidden', [
    ['POST', '/api/orders'],
    ['POST', '/api/customers'],
    ['POST', '/api/products'],
    ['GET', '/api/users'],
    ['POST', '/api/users'],
    ['GET', '/api/roles'],
    ['GET', '/api/audit-logs'],
    ['GET', '/api/dashboard/summary'],
    ['GET', '/api/dashboard/revenue-trend'],
    ['GET', '/api/dashboard/status-distribution'],
]);

dataset('manager_forbidden', [
    ['GET', '/api/users'],
    ['POST', '/api/users'],
    ['GET', '/api/roles'],
    ['PUT', '/api/roles/1/permissions'],
    ['POST', '/api/products'],
    ['GET', '/api/audit-logs'],
]);

it('forbids staff on restricted endpoints', function (string $method, string $uri) {
    actingAsRole('staff');
    $this->json($method, $uri, [])->assertForbidden()->assertJsonPath('code', 'FORBIDDEN')->assertJsonPath('success', false);
})->with('staff_forbidden');

it('forbids managers on admin-only endpoints', function (string $method, string $uri) {
    actingAsRole('manager');
    $this->json($method, $uri, [])->assertForbidden()->assertJsonPath('code', 'FORBIDDEN');
})->with('manager_forbidden');

it('lets admins reach everything in the matrix', function () {
    actingAsRole('admin');
    foreach (['/api/users', '/api/roles', '/api/audit-logs', '/api/dashboard/summary', '/api/customers', '/api/products', '/api/orders'] as $uri) {
        getJson($uri)->assertOk();
    }
});

it('lets managers use orders, dashboard, customers and products (read)', function () {
    actingAsRole('manager');
    foreach (['/api/orders', '/api/dashboard/summary', '/api/customers', '/api/products', '/api/users/assignable'] as $uri) {
        getJson($uri)->assertOk();
    }
});

it('scopes staff to their assigned orders in list and detail', function () {
    $staff = actingAsRole('staff');
    $mine = Order::factory()->confirmed()->create(['assigned_to' => $staff->id]);
    $theirs = Order::factory()->confirmed()->create(['assigned_to' => makeUser('staff')->id]);
    $unassigned = Order::factory()->pending()->create(['assigned_to' => null]);

    $ids = collect(getJson('/api/orders?per_page=100')->assertOk()->json('data'))->pluck('id');

    expect($ids)->toContain($mine->id)->not->toContain($theirs->id)->not->toContain($unassigned->id);
    getJson("/api/orders/{$mine->id}")->assertOk();
    getJson("/api/orders/{$theirs->id}")->assertForbidden();
    getJson("/api/orders/{$unassigned->id}")->assertForbidden();
});

it('prevents staff from bypassing scope with filters', function () {
    $staff = actingAsRole('staff');
    $other = makeUser('staff');
    $theirs = Order::factory()->create(['assigned_to' => $other->id]);

    $ids = collect(getJson("/api/orders?assigned_to={$other->id}&per_page=100")->json('data'))->pluck('id');

    expect($ids)->not->toContain($theirs->id);
});

it('lets staff advance only their own orders and only through allowed statuses', function () {
    $staff = actingAsRole('staff');
    $mine = Order::factory()->confirmed()->create(['assigned_to' => $staff->id]);
    $notMine = Order::factory()->confirmed()->create(['assigned_to' => makeUser('staff')->id]);

    setStatusViaApi($mine->id, 'processing')->assertOk();
    setStatusViaApi($mine->id, 'ready')->assertOk();
    setStatusViaApi($mine->id, 'cancelled', 'no')->assertForbidden();           // staff may not cancel
    setStatusViaApi($notMine->id, 'processing')->assertForbidden();             // not assigned
    $pending = Order::factory()->pending()->create(['assigned_to' => $staff->id]);
    setStatusViaApi($pending->id, 'confirmed')->assertForbidden();              // staff may not confirm
});

it('lets staff add notes to assigned orders only', function () {
    $staff = actingAsRole('staff');
    $mine = Order::factory()->create(['assigned_to' => $staff->id]);
    $theirs = Order::factory()->create(['assigned_to' => makeUser('staff')->id]);

    postJson("/api/orders/{$mine->id}/notes", ['body' => 'hello'])->assertCreated();
    postJson("/api/orders/{$theirs->id}/notes", ['body' => 'hello'])->assertForbidden();
});

it('forbids staff from assigning or editing orders', function () {
    $staff = actingAsRole('staff');
    $mine = Order::factory()->pending()->create(['assigned_to' => $staff->id]);

    postJson("/api/orders/{$mine->id}/assign", ['assigned_to' => $staff->id])->assertForbidden();
    $this->putJson("/api/orders/{$mine->id}", ['version' => $mine->version, 'priority' => 'high'])->assertForbidden();
    $this->deleteJson("/api/orders/{$mine->id}")->assertForbidden();
});

it('lets staff view customers and products but not change them', function () {
    actingAsRole('staff');
    $customer = Customer::factory()->create();
    $product = Product::factory()->create();

    getJson('/api/customers')->assertOk();
    getJson("/api/customers/{$customer->id}")->assertOk();
    getJson('/api/products')->assertOk();
    $this->putJson("/api/customers/{$customer->id}", ['name' => 'x'])->assertForbidden();
    $this->putJson("/api/products/{$product->id}", ['name' => 'x'])->assertForbidden();
    $this->deleteJson("/api/customers/{$customer->id}")->assertForbidden();
});

it('prevents an admin from removing core permissions from the admin role (lock-out protection)', function () {
    $admin = actingAsRole('admin');
    $role = \Spatie\Permission\Models\Role::findByName('admin');

    $this->putJson("/api/roles/{$role->id}/permissions", ['permissions' => ['orders.view_all']])->assertUnprocessable();

    expect($admin->fresh()->can('users.manage'))->toBeTrue();
});

it('applies permission changes immediately (cache cleared) and audits them', function () {
    actingAsRole('admin');
    $staffRole = \Spatie\Permission\Models\Role::findByName('staff');
    $perms = $staffRole->permissions->pluck('name')->push('products.manage')->all();

    $this->putJson("/api/roles/{$staffRole->id}/permissions", ['permissions' => $perms])->assertOk();

    expect($staffRole->fresh()->hasPermissionTo('products.manage'))->toBeTrue()
        ->and(\OMS\Core\Models\AuditLog::where('action', 'role.permissions_updated')->exists())->toBeTrue();
});

it('rejects permission names that do not exist', function () {
    actingAsRole('admin');
    $role = \Spatie\Permission\Models\Role::findByName('staff');

    $this->putJson("/api/roles/{$role->id}/permissions", ['permissions' => ['does.not.exist']])->assertUnprocessable();
});
