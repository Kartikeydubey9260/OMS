<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\patchJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

/* ---------------------------------------------------------------- customers */

it('creates a customer', function () {
    actingAsRole('manager');

    postJson('/api/customers', ['name' => 'Acme Corp', 'email' => 'ACME@Example.test', 'phone' => '+91 99999 00000', 'city' => 'Noida'])
        ->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.name', 'Acme Corp');

    $this->assertDatabaseHas('customers', ['name' => 'Acme Corp']);
});

it('validates customers', function (array $payload, array $errors) {
    actingAsRole('admin');
    Customer::factory()->create(['email' => 'taken@example.test']);

    postJson('/api/customers', $payload)->assertUnprocessable()->assertJsonValidationErrors($errors);
})->with([
    'empty' => [[], ['name', 'email']],
    'bad email' => [['name' => 'A', 'email' => 'nope'], ['email']],
    'duplicate email' => [['name' => 'A', 'email' => 'taken@example.test'], ['email']],
    'duplicate email (case-insensitive)' => [['name' => 'A', 'email' => 'TAKEN@example.test'], ['email']],
    'name too long' => [['name' => str_repeat('a', 300), 'email' => 'a@b.test'], ['name']],
]);

it('updates a customer and audits old/new values', function () {
    $user = actingAsRole('manager');
    $c = Customer::factory()->create(['phone' => '111']);

    putJson("/api/customers/{$c->id}", ['name' => $c->name, 'email' => $c->email, 'phone' => '222'])->assertOk();

    $log = AuditLog::where('action', 'customer.updated')->where('auditable_id', $c->id)->first();
    expect($log->old_values)->toBe(['phone' => '111'])->and($log->new_values)->toBe(['phone' => '222'])->and($log->user_id)->toBe($user->id);
});

it('shows customer statistics (cancelled excluded from value, drafts excluded)', function () {
    actingAsRole('manager');
    $c = Customer::factory()->create();
    Order::factory()->pending()->create(['customer_id' => $c->id, 'total' => 110]);
    Order::factory()->completed()->create(['customer_id' => $c->id, 'total' => 220]);
    Order::factory()->cancelled()->create(['customer_id' => $c->id, 'total' => 500]);
    Order::factory()->draft()->create(['customer_id' => $c->id, 'total' => 900]);
    Order::factory()->confirmed()->create(); // someone else's

    $d = getJson("/api/customers/{$c->id}")->assertOk()->json('data');

    expect($d['total_orders'])->toBe(4)
        ->and($d['pending_orders'])->toBe(1)
        ->and($d['completed_orders'])->toBe(1)
        ->and($d['cancelled_orders'])->toBe(1)
        ->and((float) $d['total_order_value'])->toBe(330.0)
        ->and($d['recent_orders'])->toHaveCount(4);
});

it('searches and filters customers', function () {
    actingAsRole('manager');
    Customer::factory()->create(['name' => 'Findable Ltd', 'is_active' => true]);
    Customer::factory()->create(['name' => 'Dormant Ltd', 'is_active' => false]);

    expect(collect(getJson('/api/customers?search=Findable')->json('data'))->pluck('name'))->toContain('Findable Ltd')->not->toContain('Dormant Ltd');
    expect(collect(getJson('/api/customers?is_active=0')->json('data'))->pluck('name'))->toContain('Dormant Ltd')->not->toContain('Findable Ltd');
});

it('deactivates instead of destroying customers that have orders', function () {
    actingAsRole('admin');
    $c = Customer::factory()->create();
    $order = Order::factory()->create(['customer_id' => $c->id]);

    deleteJson("/api/customers/{$c->id}")->assertStatus(200);

    expect(Order::find($order->id))->not->toBeNull();
    expect(Customer::withTrashed()->find($c->id))->not->toBeNull();
    getJson('/api/customers/lookup?q=' . urlencode($c->name))->assertOk()->assertJsonMissing(['id' => $c->id]);
});

/* ----------------------------------------------------------------- products */

it('creates a product (admin only)', function () {
    actingAsRole('admin');

    postJson('/api/products', ['name' => 'Widget', 'sku' => 'WID-1', 'price' => 19.99, 'stock_quantity' => 25, 'status' => 'active'])
        ->assertCreated()->assertJsonPath('data.sku', 'WID-1');

    $this->assertDatabaseHas('products', ['sku' => 'WID-1']);
});

it('validates products', function (array $payload, array $errors) {
    actingAsRole('admin');
    Product::factory()->create(['sku' => 'TAKEN-1']);

    postJson('/api/products', $payload)->assertUnprocessable()->assertJsonValidationErrors($errors);
})->with([
    'empty' => [[], ['name', 'sku', 'price', 'stock_quantity']],
    'duplicate sku' => [['name' => 'x', 'sku' => 'TAKEN-1', 'price' => 1, 'stock_quantity' => 1], ['sku']],
    'negative price' => [['name' => 'x', 'sku' => 'N-1', 'price' => -1, 'stock_quantity' => 1], ['price']],
    'negative stock' => [['name' => 'x', 'sku' => 'N-2', 'price' => 1, 'stock_quantity' => -1], ['stock_quantity']],
    'non numeric price' => [['name' => 'x', 'sku' => 'N-3', 'price' => 'abc', 'stock_quantity' => 1], ['price']],
    'bad status' => [['name' => 'x', 'sku' => 'N-4', 'price' => 1, 'stock_quantity' => 1, 'status' => 'maybe'], ['status']],
]);

it('forbids managers and staff from creating products', function (string $role) {
    actingAsRole($role);

    postJson('/api/products', ['name' => 'x', 'sku' => 'F-1', 'price' => 1, 'stock_quantity' => 1])->assertForbidden();
})->with(['manager', 'staff']);

it('updates a product and audits price changes', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['price' => 10, 'name' => 'Old']);

    putJson("/api/products/{$p->id}", ['name' => 'Old', 'sku' => $p->sku, 'price' => 15, 'stock_quantity' => $p->stock_quantity, 'status' => 'active'])->assertOk();

    $log = AuditLog::where('action', 'product.updated')->where('auditable_id', $p->id)->first();
    expect((float) $log->old_values['price'])->toBe(10.0)->and((float) $log->new_values['price'])->toBe(15.0);
});

it('lets the same SKU stay on update but not collide with another product', function () {
    actingAsRole('admin');
    $a = Product::factory()->create();
    $b = Product::factory()->create();
    $payload = fn (Product $p, string $sku) => ['name' => $p->name, 'sku' => $sku, 'price' => 5, 'stock_quantity' => 5, 'status' => 'active'];

    putJson("/api/products/{$a->id}", $payload($a, $a->sku))->assertOk();
    putJson("/api/products/{$a->id}", $payload($a, $b->sku))->assertUnprocessable()->assertJsonValidationErrors('sku');
});

it('filters products by status, search and low stock; lookup returns active products only', function () {
    actingAsRole('manager');
    Product::factory()->create(['name' => 'Alpha Active', 'status' => 'active', 'stock_quantity' => 2, 'low_stock_threshold' => 5]);
    Product::factory()->create(['name' => 'Alpha Inactive', 'status' => 'inactive', 'stock_quantity' => 100]);

    expect(collect(getJson('/api/products?search=Alpha&status=inactive')->json('data'))->pluck('name')->all())->toBe(['Alpha Inactive']);
    expect(collect(getJson('/api/products?low_stock=1')->json('data'))->pluck('name'))->toContain('Alpha Active');
    expect(collect(getJson('/api/products/lookup?q=Alpha')->json('data'))->pluck('name')->all())->toBe(['Alpha Active']);
});

it('keeps order history readable after a product is edited or deactivated', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    $item = Order::find($id)->items()->first();
    Product::find($item->product_id)->update(['status' => 'inactive', 'price' => 1]);

    $d = getJson("/api/orders/{$id}")->assertOk()->json('data');

    expect((float) $d['total'])->toBe(363.0);
});

it('adjusts stock by delta and rejects a result below zero', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 4]);

    patchJson("/api/products/{$p->id}/stock", ['delta' => 6, 'reason' => 'restock'])->assertOk();
    patchJson("/api/products/{$p->id}/stock", ['delta' => -11, 'reason' => 'too much'])->assertUnprocessable();

    expect($p->fresh()->stock_quantity)->toBe(10);
});
