<?php

declare(strict_types=1);

use OMS\Products\Models\Product;

use function Pest\Laravel\postJson;

dataset('invalid_order_payloads', [
    'customer missing' => [fn () => array_diff_key(orderPayload(), ['customer_id' => 1]), 'customer_id', 'Customer is required.'],
    'customer does not exist' => [fn () => orderPayload(['customer_id' => 99999999]), 'customer_id', 'Customer must exist.'],
    'no items' => [fn () => orderPayload(['items' => []]), 'items', 'Order must contain at least one product.'],
    'items missing' => [fn () => array_diff_key(orderPayload(), ['items' => 1]), 'items', 'Order must contain at least one product.'],
    'quantity zero' => [fn () => orderPayload(['items' => [['product_id' => Product::factory()->create()->id, 'quantity' => 0]]]), 'items.0.quantity', 'Quantity must be greater than 0.'],
    'quantity negative' => [fn () => orderPayload(['items' => [['product_id' => Product::factory()->create()->id, 'quantity' => -3]]]), 'items.0.quantity', 'Quantity must be greater than 0.'],
    'quantity not integer' => [fn () => orderPayload(['items' => [['product_id' => Product::factory()->create()->id, 'quantity' => 1.5]]]), 'items.0.quantity', null],
    'product does not exist' => [fn () => orderPayload(['items' => [['product_id' => 99999999, 'quantity' => 1]]]), 'items.0.product_id', 'Product must exist.'],
    'product inactive' => [fn () => orderPayload(['items' => [['product_id' => Product::factory()->create(['status' => 'inactive'])->id, 'quantity' => 1]]]), 'items.0.product_id', 'Product is inactive.'],
    'invalid priority' => [fn () => orderPayload(['priority' => 'asap']), 'priority', null],
    'invalid initial status' => [fn () => orderPayload(['status' => 'completed']), 'status', null],
    'percent discount over 100' => [fn () => orderPayload(['discount_type' => 'percent', 'discount_value' => 150]), 'discount_value', null],
    'negative discount' => [fn () => orderPayload(['discount_type' => 'fixed', 'discount_value' => -5]), 'discount_value', null],
    'bad date' => [fn () => orderPayload(['order_date' => 'yesterday-ish']), 'order_date', null],
    'unknown assignee' => [fn () => orderPayload(['assigned_to' => 99999999]), 'assigned_to', null],
]);

it('rejects invalid order payloads with field-keyed messages', function ($payload, string $field, ?string $message) {
    actingAsRole('admin');
    // Pest may hand us the closure or its already-resolved array (bound datasets) — support both.
    $payload = $payload instanceof Closure ? $payload() : $payload;

    $res = postJson('/api/orders', $payload)
        ->assertUnprocessable()
        ->assertJsonPath('success', false)
        ->assertJsonPath('code', 'VALIDATION_ERROR')
        ->assertJsonValidationErrors($field);

    if ($message !== null) {
        expect($res->json("errors.{$field}.0"))->toBe($message);
    }
    $this->assertDatabaseCount('orders', 0);
})->with('invalid_order_payloads');

it('rejects deactivated customers', function () {
    actingAsRole('admin');
    $payload = orderPayload();
    \OMS\Customers\Models\Customer::find($payload['customer_id'])->update(['is_active' => false]);

    postJson('/api/orders', $payload)->assertUnprocessable()->assertJsonValidationErrors('customer_id');
});

it('rejects an assignee who is inactive', function () {
    actingAsRole('admin');
    $inactive = makeUser('staff', ['is_active' => false]);

    postJson('/api/orders', orderPayload(['assigned_to' => $inactive->id]))->assertUnprocessable()->assertJsonValidationErrors('assigned_to');
});

it('does not mass-assign protected attributes', function () {
    $user = actingAsRole('manager');

    $id = postJson('/api/orders', orderPayload(['created_by' => 99999, 'stock_reserved' => true, 'version' => 50, 'order_number' => 'HACK-1', 'status' => 'pending']))
        ->assertCreated()->json('data.id');

    $order = \OMS\Orders\Models\Order::find($id);
    expect($order->created_by)->toBe($user->id)
        ->and((bool) $order->stock_reserved)->toBeFalse()
        ->and($order->version)->toBe(1)
        ->and($order->order_number)->not->toBe('HACK-1');
});
