<?php

declare(strict_types=1);

use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\getJson;

beforeEach(function () {
    $this->manager = actingAsRole('manager');

    $this->customerA = Customer::factory()->create(['name' => 'Acme Alpha', 'email' => 'alpha@example.test']);
    $this->customerB = Customer::factory()->create(['name' => 'Beta Corp', 'email' => 'beta@example.test']);
    $this->productX = Product::factory()->create(['name' => 'Gadget X', 'sku' => 'GAD-X', 'price' => 100]);
    $this->productY = Product::factory()->create(['name' => 'Widget Y', 'sku' => 'WID-Y', 'price' => 450]);

    // Customer A: two completed orders, 10 units of Gadget X total ($1000).
    $this->orderA1 = reportOrder($this->customerA, $this->productX, 6, 100, 'completed', '2026-03-10');
    $this->orderA2 = reportOrder($this->customerA, $this->productX, 4, 100, 'completed', '2026-03-12');

    // Customer B: one pending order, 5 units of Widget Y total ($2250).
    $this->orderB1 = reportOrder($this->customerB, $this->productY, 5, 450, 'pending', '2026-03-11');
});

function reportOrder(Customer $customer, Product $product, int $quantity, float $price, string $status, string $orderDate): Order
{
    $order = Order::factory()->create([
        'customer_id' => $customer->id,
        'status' => $status,
        'order_date' => $orderDate,
        'total' => round($quantity * $price, 2),
    ]);
    $order->items()->delete();
    $order->items()->create([
        'product_id' => $product->id,
        'product_name' => $product->name,
        'sku' => $product->sku,
        'quantity' => $quantity,
        'unit_price' => $price,
        'line_subtotal' => round($quantity * $price, 2),
        'discount_amount' => 0,
        'tax_amount' => 0,
        'line_total' => round($quantity * $price, 2),
    ]);

    return $order;
}

it('returns the full report dataset for a manager', function () {
    $data = getJson('/api/dashboard/reports')->assertOk()->json('data');

    expect($data)->toHaveKeys([
        'summary', 'orders_by_status', 'top_products_by_quantity', 'top_products_by_price',
        'top_clients_by_orders', 'top_clients_by_price', 'per_client_report', 'per_product_report', 'filter_options',
    ]);

    // Summary across all orders (completed + pending).
    expect($data['summary']['total_orders'])->toBe(3)
        ->and((float) $data['summary']['total_revenue'])->toBe(3250.0)
        ->and($data['summary']['total_items_sold'])->toBe(15);
});

it('ranks top products by quantity and by revenue', function () {
    $data = getJson('/api/dashboard/reports')->assertOk()->json('data');

    expect($data['top_products_by_quantity'][0]['product_id'])->toBe($this->productX->id)
        ->and((int) $data['top_products_by_quantity'][0]['total_quantity'])->toBe(10);

    expect($data['top_products_by_price'][0]['product_id'])->toBe($this->productY->id)
        ->and((float) $data['top_products_by_price'][0]['total_revenue'])->toBe(2250.0);
});

it('ranks top clients by order count and by order value', function () {
    $data = getJson('/api/dashboard/reports')->assertOk()->json('data');

    expect($data['top_clients_by_orders'][0]['client_id'])->toBe($this->customerA->id)
        ->and((int) $data['top_clients_by_orders'][0]['orders_count'])->toBe(2);

    expect($data['top_clients_by_price'][0]['client_id'])->toBe($this->customerB->id)
        ->and((float) $data['top_clients_by_price'][0]['total_spent'])->toBe(2250.0);
});

it('renders per-client and per-product detailed reports', function () {
    $data = getJson('/api/dashboard/reports')->assertOk()->json('data');

    $clientRows = collect($data['per_client_report']['data'])->keyBy('client_id');
    expect($clientRows)->toHaveKeys([(string) $this->customerA->id, (string) $this->customerB->id]);

    $productRows = collect($data['per_product_report']['data'])->keyBy('product_id');
    expect($productRows)->toHaveKeys([(string) $this->productX->id, (string) $this->productY->id]);

    expect($data['per_client_report']['meta'])->toMatchArray([
        'current_page' => 1,
        'per_page' => 10,
        'total' => 2,
        'last_page' => 1,
    ])->and($data['per_product_report']['meta'])->toMatchArray([
        'current_page' => 1,
        'per_page' => 10,
        'total' => 2,
        'last_page' => 1,
    ]);
});

it('filters by status, year, month and date range', function () {
    // Status filter
    $completed = getJson('/api/dashboard/reports?status=completed')->assertOk()->json('data');
    expect($completed['summary']['total_orders'])->toBe(2)
        ->and(collect($completed['top_clients_by_orders'])->pluck('client_id'))->toContain($this->customerA->id);

    // Year filter
    $otherYear = getJson('/api/dashboard/reports?year=2030')->assertOk()->json('data');
    expect($otherYear['summary']['total_orders'])->toBe(0);

    // Month filter
    $march = getJson('/api/dashboard/reports?year=2026&month=3')->assertOk()->json('data');
    expect($march['summary']['total_orders'])->toBe(3);

    $feb = getJson('/api/dashboard/reports?year=2026&month=2')->assertOk()->json('data');
    expect($feb['summary']['total_orders'])->toBe(0);

    // Date-to-date range
    $range = getJson('/api/dashboard/reports?start_date=2026-03-11&end_date=2026-03-11')->assertOk()->json('data');
    expect($range['summary']['total_orders'])->toBe(1);
});

it('filters per client and per product', function () {
    $perClient = getJson('/api/dashboard/reports?customer_id='.$this->customerA->id)->assertOk()->json('data');
    expect(collect($perClient['top_clients_by_orders'])->pluck('client_id'))->toHaveCount(1)
        ->and(collect($perClient['per_client_report']['data'])->pluck('client_id'))->toHaveCount(1)
        ->and($perClient['summary']['total_orders'])->toBe(2);

    $perProduct = getJson('/api/dashboard/reports?product_id='.$this->productY->id)->assertOk()->json('data');
    expect(collect($perProduct['per_product_report']['data'])->pluck('product_id'))->toHaveCount(1)
        ->and((int) $perProduct['summary']['total_items_sold'])->toBe(5);
});

it('paginates and sorts the detailed breakdowns like the other tables', function () {
    // Customer A spent $1000 (6×100 + 4×100); customer B spent $2250 (5×450).

    // Default: total_spent descending, 10 per page.
    $default = getJson('/api/dashboard/reports')->assertOk()->json('data');
    expect($default['per_client_report']['data'][0]['client_id'])->toBe($this->customerB->id);

    // Sort by total_spent ascending flips the order.
    $asc = getJson('/api/dashboard/reports?sort=total_spent&direction=asc')->assertOk()->json('data');
    expect($asc['per_client_report']['data'][0]['client_id'])->toBe($this->customerA->id);

    // Page 2 with per_page=1 shows the second client, with correct meta.
    $page2 = getJson('/api/dashboard/reports?page=2&per_page=1&sort=total_spent&direction=desc')->assertOk()->json('data');
    expect($page2['per_client_report']['meta'])->toMatchArray([
        'current_page' => 2,
        'per_page' => 1,
        'total' => 2,
        'last_page' => 2,
        'from' => 2,
        'to' => 2,
    ])->and($page2['per_client_report']['data'][0]['client_id'])->toBe($this->customerA->id);

    // Per-product breakdown defaults to total_revenue descending and can sort ascending.
    $prodAsc = getJson('/api/dashboard/reports?sort=total_revenue&direction=asc&per_page=1')->assertOk()->json('data');
    expect($prodAsc['per_product_report']['data'][0]['product_id'])->toBe($this->productX->id)
        ->and($prodAsc['per_product_report']['meta']['total'])->toBe(2);

    // Unknown sort columns fall back to the default order instead of 422s.
    $fallback = getJson('/api/dashboard/reports?sort=does.not.exist')->assertOk()->json('data');
    expect($fallback['per_client_report']['data'][0]['client_id'])->toBe($this->customerB->id);
});

it('provides filter options', function () {
    $data = getJson('/api/dashboard/reports')->assertOk()->json('data');

    expect($data['filter_options']['years'])->toContain('2026')
        ->and($data['filter_options']['statuses'])->toContain('completed', 'pending')
        ->and(collect($data['filter_options']['clients'])->pluck('id'))->toContain($this->customerA->id)
        ->and(collect($data['filter_options']['products'])->pluck('id'))->toContain($this->productX->id);
});

it('exports every report type in csv, xls, xlsx and pdf', function () {
    $types = [
        'overview',
        'top_products_quantity',
        'top_products_price',
        'top_clients_orders',
        'top_clients_price',
        'per_client',
        'per_product',
    ];
    $formats = ['csv', 'xls', 'xlsx', 'pdf'];

    foreach ($types as $type) {
        foreach ($formats as $format) {
            getJson("/api/dashboard/reports/export?type={$type}&format={$format}")->assertOk();
        }
    }
});

it('exports a csv with headers and data', function () {
    $response = getJson('/api/dashboard/reports/export?type=top_products_quantity&format=csv');

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('text/csv');
    expect($response->streamedContent())->toContain('Product')
        ->toContain('Gadget X');
});

it('exports pdf with application/pdf content type', function () {
    $response = getJson('/api/dashboard/reports/export?type=per_client&format=pdf');

    $response->assertOk();
    expect($response->headers->get('content-type'))->toContain('application/pdf');
    expect(substr($response->getContent(), 0, 4))->toBe('%PDF');
});

it('rejects staff without the reports.view permission', function () {
    actingAsRole('staff');

    getJson('/api/dashboard/reports')->assertForbidden();
    getJson('/api/dashboard/reports/export?type=overview&format=csv')->assertForbidden();
});

it('rejects unsupported export formats with 400', function () {
    getJson('/api/dashboard/reports/export?type=overview&format=doc')->assertStatus(400);
});
