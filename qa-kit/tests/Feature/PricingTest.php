<?php

declare(strict_types=1);

use Illuminate\Testing\TestResponse;
use OMS\Products\Models\Product;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/** Builds products for [price, qty] lines and calls the preview endpoint (nothing is persisted). */
function previewFor(array $lines, ?string $type = null, float $value = 0, ?float $tax = null): TestResponse
{
    $items = collect($lines)->map(fn (array $l) => [
        'product_id' => Product::factory()->create(['price' => $l[0], 'stock_quantity' => 1000, 'status' => 'active'])->id,
        'quantity' => $l[1],
    ])->all();

    return postJson('/api/orders/preview', array_filter([
        'items' => $items,
        'discount_type' => $type,
        'discount_value' => $type ? $value : null,
        'tax_rate' => $tax,
    ], fn ($v) => $v !== null));
}

function cents(mixed $v): int
{
    return (int) round(((float) $v) * 100);
}

dataset('pricing_cases', [
    // lines [price, qty], discount type, value, tax override, subtotal, discount, tax, total
    'assessment example (350 − 20 + 33 = 363)' => [[[100, 2], [50, 3]], 'fixed', 20, null, 350.00, 20.00, 33.00, 363.00],
    'no discount, default 10% tax' => [[[100, 2], [50, 3]], null, 0, null, 350.00, 0.00, 35.00, 385.00],
    'percent discount' => [[[100, 2], [50, 3]], 'percent', 10, null, 350.00, 35.00, 31.50, 346.50],
    'fixed discount clamped to subtotal' => [[[100, 1]], 'fixed', 500, null, 100.00, 100.00, 0.00, 0.00],
    'half-up rounding' => [[[33.33, 3]], 'percent', 15, null, 99.99, 15.00, 8.50, 93.49],
    'custom tax rate' => [[[100, 2], [50, 3]], null, 0, 18, 350.00, 0.00, 63.00, 413.00],
    'zero tax rate' => [[[10, 1]], null, 0, 0, 10.00, 0.00, 0.00, 10.00],
]);

it('calculates subtotal, discount, tax and total on the server', function (array $lines, ?string $type, float $value, ?float $tax, float $sub, float $disc, float $taxAmt, float $total) {
    actingAsRole('manager');

    $d = previewFor($lines, $type, $value, $tax)->assertOk()->json('data');

    expect((float) $d['subtotal'])->toEqualWithDelta($sub, 0.001)
        ->and((float) $d['discount_amount'])->toEqualWithDelta($disc, 0.001)
        ->and((float) $d['tax_amount'])->toEqualWithDelta($taxAmt, 0.001)
        ->and((float) $d['total'])->toEqualWithDelta($total, 0.001);
})->with('pricing_cases');

it('allocates discount, tax and totals to lines without losing a cent', function () {
    actingAsRole('admin');
    // three equal lines + a discount that cannot be split evenly (10.00 / 3)
    $payload = orderPayload();
    $payload['items'] = collect(range(1, 3))->map(fn () => [
        'product_id' => Product::factory()->create(['price' => 10, 'stock_quantity' => 100])->id,
        'quantity' => 1,
    ])->all();
    $payload['discount_type'] = 'fixed';
    $payload['discount_value'] = 10;

    $id = postJson('/api/orders', $payload)->assertCreated()->json('data.id');
    $d = getJson("/api/orders/{$id}")->json('data');
    $items = collect($d['items']);

    expect($items->sum(fn ($i) => cents($i['discount_amount'])))->toBe(cents($d['discount_amount']))
        ->and($items->sum(fn ($i) => cents($i['tax_amount'])))->toBe(cents($d['tax_amount']))
        ->and($items->sum(fn ($i) => cents($i['line_total'])))->toBe(cents($d['total']));
});

it('stores the same total that the preview promised', function () {
    actingAsRole('manager');
    $payload = orderPayload();

    $preview = postJson('/api/orders/preview', ['items' => $payload['items'], 'discount_type' => 'fixed', 'discount_value' => 20])->json('data.total');
    $stored = postJson('/api/orders', $payload)->assertCreated()->json('data.total');

    expect((float) $stored)->toBe((float) $preview);
});

it('rejects invalid preview input', function (array $override) {
    actingAsRole('manager');
    $payload = ['items' => orderPayload()['items']];

    postJson('/api/orders/preview', array_replace($payload, $override))->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
})->with([
    'no items' => [['items' => []]],
    'zero quantity' => [['items' => [['product_id' => 1, 'quantity' => 0]]]],
    'absurd quantity' => [['items' => [['product_id' => 1, 'quantity' => 1000000]]]],
    'percent over 100' => [['discount_type' => 'percent', 'discount_value' => 101]],
    'negative discount' => [['discount_type' => 'fixed', 'discount_value' => -1]],
    'unknown product' => [['items' => [['product_id' => 99999999, 'quantity' => 1]]]],
]);

it('rejects inactive products in a preview', function () {
    actingAsRole('manager');
    $inactive = Product::factory()->create(['status' => 'inactive']);

    postJson('/api/orders/preview', ['items' => [['product_id' => $inactive->id, 'quantity' => 1]]])->assertUnprocessable();
});

it('limits the preview endpoint to roles that can create orders', function () {
    actingAsRole('staff');

    postJson('/api/orders/preview', ['items' => orderPayload()['items']])->assertForbidden();
});
