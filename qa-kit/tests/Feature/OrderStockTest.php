<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\patchJson;

function pendingOrderFor(Product $product, int $qty): int
{
    return createOrderViaApi([
        'customer_id' => Customer::factory()->create()->id,
        'items' => [['product_id' => $product->id, 'quantity' => $qty]],
        'discount_type' => null,
        'discount_value' => 0,
    ]);
}

it('reserves stock when an order is confirmed', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 100]);
    $id = pendingOrderFor($p, 5);

    setStatusViaApi($id, 'confirmed')->assertOk();

    expect($p->fresh()->stock_quantity)->toBe(95)
        ->and((bool) Order::find($id)->stock_reserved)->toBeTrue();
});

it('keeps stock untouched for draft and pending orders', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 10]);
    $id = pendingOrderFor($p, 4);
    setStatusViaApi($id, 'draft')->assertOk();

    expect($p->fresh()->stock_quantity)->toBe(10);
});

it('refuses to confirm with insufficient stock and changes nothing (atomic)', function () {
    actingAsRole('admin');
    $a = Product::factory()->create(['stock_quantity' => 10, 'name' => 'Plenty']);
    $b = Product::factory()->create(['stock_quantity' => 1, 'name' => 'Scarce']);
    $id = createOrderViaApi([
        'items' => [['product_id' => $a->id, 'quantity' => 5], ['product_id' => $b->id, 'quantity' => 2]],
    ]);

    $res = setStatusViaApi($id, 'confirmed')->assertUnprocessable()->assertJsonPath('code', 'INSUFFICIENT_STOCK');

    expect($res->json('message'))->toContain('Scarce')
        ->and($a->fresh()->stock_quantity)->toBe(10) // the first product must NOT have been decremented
        ->and($b->fresh()->stock_quantity)->toBe(1)
        ->and(Order::find($id)->status->value ?? Order::find($id)->status)->toBe('pending')
        ->and((bool) Order::find($id)->stock_reserved)->toBeFalse();
});

it('never oversells: the second of two competing orders is rejected', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 5]);
    $one = pendingOrderFor($p, 3);
    $two = pendingOrderFor($p, 3);

    setStatusViaApi($one, 'confirmed')->assertOk();
    setStatusViaApi($two, 'confirmed')->assertUnprocessable()->assertJsonPath('code', 'INSUFFICIENT_STOCK');

    expect($p->fresh()->stock_quantity)->toBe(2);
});

it('restores stock when a confirmed, processing or ready order is cancelled', function (string $stage) {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 20]);
    $id = pendingOrderFor($p, 6);
    setStatusViaApi($id, 'confirmed')->assertOk();
    foreach (['processing' => ['processing'], 'ready' => ['processing', 'ready'], 'confirmed' => []][$stage] as $s) {
        setStatusViaApi($id, $s)->assertOk();
    }
    expect($p->fresh()->stock_quantity)->toBe(14);

    setStatusViaApi($id, 'cancelled', 'Customer cancelled')->assertOk();

    expect($p->fresh()->stock_quantity)->toBe(20)
        ->and((bool) Order::find($id)->stock_reserved)->toBeFalse();
})->with(['confirmed', 'processing', 'ready']);

it('does not change stock when a draft or pending order is cancelled', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 20]);
    $id = pendingOrderFor($p, 6);

    setStatusViaApi($id, 'cancelled', 'changed mind')->assertOk();

    expect($p->fresh()->stock_quantity)->toBe(20);
});

it('does not restore stock twice', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 20]);
    $id = pendingOrderFor($p, 6);
    setStatusViaApi($id, 'confirmed')->assertOk();
    setStatusViaApi($id, 'cancelled', 'x')->assertOk();
    setStatusViaApi($id, 'cancelled', 'x')->assertUnprocessable(); // terminal

    expect($p->fresh()->stock_quantity)->toBe(20);
});

it('keeps stock deducted for completed orders', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 20]);
    $id = pendingOrderFor($p, 6);
    foreach (['confirmed', 'processing', 'ready', 'completed'] as $s) {
        setStatusViaApi($id, $s)->assertOk();
    }

    expect($p->fresh()->stock_quantity)->toBe(14);
});

it('allows manual stock adjustments but never below zero, and audits them', function () {
    actingAsRole('admin');
    $p = Product::factory()->create(['stock_quantity' => 10]);

    patchJson("/api/products/{$p->id}/stock", ['delta' => -3, 'reason' => 'damaged'])->assertOk();
    patchJson("/api/products/{$p->id}/stock", ['delta' => -50, 'reason' => 'oops'])->assertUnprocessable();
    patchJson("/api/products/{$p->id}/stock", ['delta' => 5])->assertUnprocessable(); // reason required

    expect($p->fresh()->stock_quantity)->toBe(7)
        ->and(AuditLog::where('action', 'product.stock_adjusted')->where('auditable_id', $p->id)->count())->toBe(1);
});
