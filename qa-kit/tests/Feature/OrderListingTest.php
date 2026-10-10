<?php

declare(strict_types=1);

use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderItem;
use OMS\Products\Models\Product;
use Illuminate\Support\Facades\DB;

use function Pest\Laravel\getJson;

function numbers(string $qs = ''): array
{
    return collect(getJson('/api/orders' . $qs)->assertOk()->json('data'))->pluck('order_number')->all();
}

beforeEach(function () {
    $this->manager = actingAsRole('manager');
    $this->assignee = makeUser('staff', ['name' => 'Zelda Assignee']);
    $this->customer = Customer::factory()->create(['name' => 'Quokka Industries', 'email' => 'buyer@quokka.test']);
    $this->product = Product::factory()->create(['name' => 'Zebra Widget', 'sku' => 'ZEB-001', 'price' => 10]);
    $this->order = Order::factory()->create([
        'customer_id' => $this->customer->id, 'assigned_to' => $this->assignee->id, 'status' => 'confirmed',
        'priority' => 'urgent', 'order_date' => '2026-03-15', 'total' => 77,
    ]);
    $this->order->items()->delete();
    OrderItem::factory()->create(['order_id' => $this->order->id, 'product_id' => $this->product->id, 'product_name' => 'Zebra Widget', 'sku' => 'ZEB-001']);
    Order::factory()->count(3)->create(['order_date' => '2026-01-10']);
});

it('searches by order number, customer name, customer email, product and assignee', function (string $term) {
    expect(numbers('?search=' . urlencode($term)))->toContain($this->order->order_number);
})->with(['by order number' => fn () => 'ORD-', 'by customer name' => 'Quokka', 'by customer email' => 'buyer@quokka', 'by product name' => 'Zebra', 'by product sku' => 'ZEB-001', 'by assignee' => 'Zelda']);

it('finds exactly the order when searching its full order number', function () {
    expect(numbers('?search=' . $this->order->order_number))->toBe([$this->order->order_number]);
});

it('returns nothing for a non-matching search', function () {
    expect(numbers('?search=zzz-nothing-matches'))->toBe([]);
});

it('treats LIKE wildcards in search literally', function () {
    expect(numbers('?search=' . urlencode('%')))->toBe([]);
});

it('filters by status, priority, customer, assignee and date range', function () {
    expect(numbers('?status=confirmed&customer_id=' . $this->customer->id))->toBe([$this->order->order_number]);
    expect(numbers('?priority=urgent&assigned_to=' . $this->assignee->id))->toBe([$this->order->order_number]);
    expect(numbers('?date_from=2026-03-01&date_to=2026-03-31'))->toBe([$this->order->order_number]);
    expect(numbers('?date_from=2026-03-16'))->not->toContain($this->order->order_number);
    expect(numbers('?date_to=2026-03-15'))->toContain($this->order->order_number);
});

it('accepts multiple statuses', function () {
    expect(numbers('?status[]=confirmed&status[]=draft&per_page=100'))->toContain($this->order->order_number);
});

it('sorts by every supported column and direction', function (string $column) {
    foreach (['asc', 'desc'] as $dir) {
        getJson("/api/orders?sort={$column}&direction={$dir}&per_page=50")->assertOk();
    }
})->with(['order_date', 'total', 'status', 'priority', 'customer', 'created_at']);

it('sorts by total descending correctly', function () {
    $totals = collect(getJson('/api/orders?sort=total&direction=desc&per_page=50')->json('data'))->pluck('total')->map(fn ($t) => (float) $t)->all();
    $sorted = $totals;
    rsort($sorted);

    expect($totals)->toBe($sorted)->and($totals[0])->toBe(77.0);
});

it('rejects unknown sort columns instead of passing them to SQL', function () {
    getJson('/api/orders?sort=' . urlencode('id; DROP TABLE orders'))->assertUnprocessable()->assertJsonPath('code', 'VALIDATION_ERROR');
    getJson('/api/orders?sort=password&direction=asc')->assertUnprocessable();
    getJson('/api/orders?direction=sideways')->assertUnprocessable();
    expect(Order::count())->toBeGreaterThan(0);
});

it('paginates on the server with meta and caps per_page at 100', function () {
    $res = getJson('/api/orders?per_page=2&page=2')->assertOk();
    expect($res->json('meta.per_page'))->toBe(2)->and($res->json('meta.current_page'))->toBe(2)->and($res->json('data'))->toHaveCount(2)->and($res->json('meta.total'))->toBe(4);
    expect(getJson('/api/orders?per_page=5000')->json('meta.per_page'))->toBeLessThanOrEqual(100);
    expect(getJson('/api/orders?per_page=0')->status())->toBeIn([200, 422]);
});

it('returns slim list rows without heavy relations', function () {
    $row = getJson('/api/orders')->json('data.0');

    expect($row)->toHaveKeys(['id', 'order_number', 'customer', 'order_date', 'status', 'priority', 'assigned_to', 'total'])
        ->and($row)->not->toHaveKeys(['activities', 'status_history', 'notes_list', 'items']);
});

it('uses a constant number of queries regardless of page size (no N+1)', function () {
    $count = function (): int {
        DB::flushQueryLog();
        DB::enableQueryLog();
        getJson('/api/orders?per_page=50')->assertOk();
        $n = count(DB::getQueryLog());
        DB::disableQueryLog();

        return $n;
    };

    $small = $count();
    Order::factory()->count(30)->create(['assigned_to' => $this->assignee->id]);
    $large = $count();

    expect($large)->toBe($small);
});

it('hides soft-deleted orders', function () {
    $this->order->delete();

    expect(numbers('?per_page=100'))->not->toContain($this->order->order_number);
});
