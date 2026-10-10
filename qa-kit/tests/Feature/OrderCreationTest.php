<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Core\Services\AuditLogger;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderItem;
use OMS\Orders\Models\OrderStatusHistory;
use OMS\Products\Models\Product;

use function Pest\Laravel\assertDatabaseCount;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

it('creates an order with server-calculated totals (350 − 20 + 33 = 363)', function () {
    actingAsRole('manager');

    $res = postJson('/api/orders', orderPayload())
        ->assertCreated()
        ->assertJsonPath('success', true)
        ->assertJsonPath('message', 'Order created successfully');

    expect((float) $res->json('data.subtotal'))->toBe(350.0)
        ->and((float) $res->json('data.discount_amount'))->toBe(20.0)
        ->and((float) $res->json('data.tax_amount'))->toBe(33.0)
        ->and((float) $res->json('data.total'))->toBe(363.0)
        ->and($res->json('data.order_number'))->toMatch('/^ORD-\d+$/')
        ->and($res->json('data.items'))->toHaveCount(2);
});

it('ignores totals and prices sent by the client', function () {
    actingAsRole('admin');
    $payload = orderPayload(['total' => 1, 'subtotal' => 1, 'tax_amount' => 0, 'grand_total' => 1]);
    $payload['items'][0]['unit_price'] = 0.01;

    $res = postJson('/api/orders', $payload)->assertCreated();

    expect((float) $res->json('data.total'))->toBe(363.0);
    expect((float) OrderItem::where('order_id', $res->json('data.id'))->orderBy('id')->first()->unit_price)->toBe(100.0);
});

it('snapshots product name, sku and unit price on each item', function () {
    actingAsRole('admin');
    $payload = orderPayload();
    $id = postJson('/api/orders', $payload)->json('data.id');

    $product = Product::find($payload['items'][0]['product_id']);
    $product->update(['price' => 999, 'name' => 'Renamed']);

    $item = OrderItem::where('order_id', $id)->where('product_id', $product->id)->first();
    expect((float) $item->unit_price)->toBe(100.0)->and($item->product_name)->not->toBe('Renamed');
});

it('merges duplicate product rows into one line', function () {
    actingAsRole('admin');
    $payload = orderPayload();
    $pid = $payload['items'][0]['product_id'];
    $payload['items'] = [['product_id' => $pid, 'quantity' => 1], ['product_id' => $pid, 'quantity' => 2]];

    $id = postJson('/api/orders', $payload)->assertCreated()->json('data.id');

    expect(OrderItem::where('order_id', $id)->count())->toBe(1)
        ->and(OrderItem::where('order_id', $id)->value('quantity'))->toBe(3);
});

it('writes status history, activity and audit rows for a new order', function () {
    $user = actingAsRole('manager');
    $id = postJson('/api/orders', orderPayload())->json('data.id');

    $history = OrderStatusHistory::where('order_id', $id)->first();
    expect($history)->not->toBeNull()
        ->and($history->from_status)->toBeNull()
        ->and($history->to_status)->toBe('pending')
        ->and($history->changed_by)->toBe($user->id);

    $audit = AuditLog::where('action', 'order.created')->where('auditable_id', $id)->first();
    expect($audit)->not->toBeNull()->and($audit->user_id)->toBe($user->id);

    getJson("/api/orders/{$id}")->assertOk()->assertJsonCount(1, 'data.status_history');
});

it('does not touch stock when an order is created', function () {
    actingAsRole('admin');
    $payload = orderPayload();
    postJson('/api/orders', $payload)->assertCreated();

    expect(Product::find($payload['items'][0]['product_id'])->stock_quantity)->toBe(100);
});

it('rolls back everything when a later step fails (no orphan order, items or history)', function () {
    actingAsRole('admin');
    $this->mock(AuditLogger::class, function ($mock) {
        $mock->shouldReceive('log')->andThrow(new RuntimeException('boom'));
    });

    postJson('/api/orders', orderPayload())
        ->assertStatus(500)
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'SERVER_ERROR')
        ->assertJsonMissingPath('trace');

    assertDatabaseCount('orders', 0);
    assertDatabaseCount('order_items', 0);
    assertDatabaseCount('order_status_histories', 0);
});

it('generates unique, sequential-looking order numbers', function () {
    actingAsRole('admin');
    $a = postJson('/api/orders', orderPayload())->json('data.order_number');
    $b = postJson('/api/orders', orderPayload())->json('data.order_number');

    expect($a)->not->toBe($b)->and(Order::where('order_number', $a)->count())->toBe(1);
});

it('applies a percentage discount', function () {
    actingAsRole('admin');
    $res = postJson('/api/orders', orderPayload(['discount_type' => 'percent', 'discount_value' => 10]))->assertCreated();

    expect((float) $res->json('data.discount_amount'))->toBe(35.0)
        ->and((float) $res->json('data.tax_amount'))->toBe(31.5)
        ->and((float) $res->json('data.total'))->toBe(346.5);
});

it('stores the initial note as an order note', function () {
    actingAsRole('admin');
    $id = postJson('/api/orders', orderPayload(['notes' => 'Deliver before Friday']))->json('data.id');

    expect(Order::find($id)->notes()->where('body', 'Deliver before Friday')->exists())->toBeTrue();
});

it('previews totals without saving anything', function () {
    actingAsRole('manager');
    $payload = orderPayload();

    postJson('/api/orders/preview', ['items' => $payload['items'], 'discount_type' => 'fixed', 'discount_value' => 20])
        ->assertOk()
        ->assertJsonPath('data.total', fn ($v) => (float) $v === 363.0);

    assertDatabaseCount('orders', 0);
});
