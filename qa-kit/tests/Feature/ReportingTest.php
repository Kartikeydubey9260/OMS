<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Cache;
use Laravel\Sanctum\Sanctum;
use OMS\Core\Models\AuditLog;
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

/* ----------------------------------------------------------------- dashboard */

beforeEach(fn () => Cache::flush());

it('summarises counts, revenue and averages from real data', function () {
    actingAsRole('manager');
    Order::factory()->pending()->count(2)->create(['total' => 100]);
    Order::factory()->confirmed()->create(['total' => 100]);
    Order::factory()->processing()->create(['total' => 100]);
    Order::factory()->completed()->create(['total' => 200]);
    Order::factory()->completed()->create(['total' => 400]);
    Order::factory()->cancelled()->create(['total' => 999]);

    $d = getJson('/api/dashboard/summary')->assertOk()->json('data');

    expect($d['total_orders'])->toBe(7)
        ->and($d['pending_orders'])->toBe(2)
        ->and($d['confirmed_orders'])->toBe(1)
        ->and($d['processing_orders'])->toBe(1)
        ->and($d['completed_orders'])->toBe(2)
        ->and($d['cancelled_orders'])->toBe(1)
        ->and((float) $d['total_revenue'])->toBe(600.0)          // completed orders only
        ->and((float) $d['average_order_value'])->toBe(300.0)    // revenue ÷ completed count
        ->and($d['total_customers'])->toBe(Customer::count())
        ->and($d['total_products'])->toBe(Product::count());
});

it('returns zeros (not errors or nulls) on an empty system', function () {
    actingAsRole('admin');

    $d = getJson('/api/dashboard/summary')->assertOk()->json('data');

    expect($d['total_orders'])->toBe(0)->and((float) $d['total_revenue'])->toBe(0.0)->and((float) $d['average_order_value'])->toBe(0.0);
});

it('reports a status distribution that sums to the total', function () {
    actingAsRole('admin');
    Order::factory()->pending()->count(2)->create();
    Order::factory()->completed()->count(3)->create();

    $rows = collect(getJson('/api/dashboard/status-distribution')->assertOk()->json('data'));

    expect($rows->sum('count'))->toBe(5)
        ->and($rows->firstWhere('status', 'completed')['count'])->toBe(3);
});

it('builds a zero-filled daily revenue trend', function () {
    actingAsRole('admin');
    Order::factory()->completed()->create(['total' => 100, 'order_date' => '2026-03-10']);
    Order::factory()->completed()->create(['total' => 50, 'order_date' => '2026-03-10']);
    Order::factory()->completed()->create(['total' => 25, 'order_date' => '2026-03-12']);
    Order::factory()->pending()->create(['total' => 999, 'order_date' => '2026-03-11']); // not revenue

    $rows = collect(getJson('/api/dashboard/revenue-trend?period=day&from=2026-03-09&to=2026-03-13')->assertOk()->json('data'));

    expect($rows->pluck('label')->all())->toBe(['2026-03-09', '2026-03-10', '2026-03-11', '2026-03-12', '2026-03-13'])
        ->and($rows->map(fn ($r) => (float) $r['revenue'])->all())->toBe([0.0, 150.0, 0.0, 25.0, 0.0])
        ->and($rows->pluck('orders')->map(fn ($n) => (int) $n)->all())->toBe([0, 2, 0, 1, 0]);
});

it('supports month and week periods', function () {
    actingAsRole('admin');
    Order::factory()->completed()->create(['total' => 100, 'order_date' => '2026-01-15']);
    Order::factory()->completed()->create(['total' => 40, 'order_date' => '2026-03-02']);

    $months = collect(getJson('/api/dashboard/revenue-trend?period=month&from=2026-01-01&to=2026-03-31')->assertOk()->json('data'));
    $weeks = collect(getJson('/api/dashboard/revenue-trend?period=week&from=2026-01-01&to=2026-03-31')->assertOk()->json('data'));

    expect($months->pluck('label')->all())->toBe(['2026-01', '2026-02', '2026-03'])
        ->and($months->map(fn ($r) => (float) $r['revenue'])->all())->toBe([100.0, 0.0, 40.0])
        ->and($weeks->sum(fn ($r) => (float) $r['revenue']))->toBe(140.0);
});

it('rejects an invalid period', function () {
    actingAsRole('admin');

    getJson('/api/dashboard/revenue-trend?period=century')->assertUnprocessable();
});

/* ---------------------------------------------------------------- audit logs */

it('lists audit logs newest first with the documented shape', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    putJson("/api/orders/{$id}", ['version' => 1, 'priority' => 'high'])->assertOk();

    $res = getJson('/api/audit-logs')->assertOk()->assertJsonStructure([
        'data' => [['id', 'action', 'auditable_type', 'auditable_id', 'label', 'old_values', 'new_values', 'user', 'created_at']],
    ]);

    $ids = collect($res->json('data'))->pluck('id')->all();
    $desc = $ids;
    rsort($desc);
    $update = collect($res->json('data'))->firstWhere('action', 'order.updated');
    expect($ids)->toBe($desc)
        ->and($update['label'])->toMatch('/^Updated Order #ORD-\d+$/')
        ->and($update['old_values']['priority'])->toBe('normal')
        ->and($update['new_values']['priority'])->toBe('high');
});

it('filters audit logs by action, entity, user and date', function () {
    $admin = makeUser('admin');
    $manager = makeUser('manager');
    Sanctum::actingAs($admin);
    $a = createOrderViaApi();
    Sanctum::actingAs($manager);
    $b = createOrderViaApi();
    putJson("/api/orders/{$b}", ['version' => 1, 'priority' => 'urgent'])->assertOk();
    Sanctum::actingAs($admin);

    $byAction = collect(getJson('/api/audit-logs?action=order.updated')->json('data'));
    $byEntity = collect(getJson("/api/audit-logs?auditable_type=order&auditable_id={$a}")->json('data'));
    $byUser = collect(getJson("/api/audit-logs?user_id={$manager->id}")->json('data'));

    expect($byAction->pluck('action')->unique()->all())->toBe(['order.updated'])
        ->and($byEntity->pluck('auditable_id')->unique()->map(fn ($i) => (int) $i)->all())->toBe([$a])
        ->and($byUser->pluck('user.id')->unique()->map(fn ($i) => (int) $i)->all())->toBe([$manager->id])
        ->and(getJson('/api/audit-logs?date_from=2999-01-01')->json('data'))->toBe([]);
});

it('has no write endpoints for audit logs', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    $log = AuditLog::firstOrFail();

    expect($this->deleteJson("/api/audit-logs/{$log->id}")->status())->toBeIn([404, 405])
        ->and($this->putJson("/api/audit-logs/{$log->id}", ['label' => 'x'])->status())->toBeIn([404, 405])
        ->and($this->postJson('/api/audit-logs', [])->status())->toBeIn([404, 405])
        ->and($id)->toBeGreaterThan(0);
});

it('never stores passwords or tokens in audit values', function () {
    actingAsRole('admin');

    $userId = postJson('/api/users', ['name' => 'Audit Me', 'email' => 'audit-me@oms.test', 'password' => 'super-secret-1', 'role' => 'staff', 'is_active' => true])
        ->assertCreated()->json('data.id');
    putJson("/api/users/{$userId}", ['name' => 'Audit Me', 'email' => 'audit-me@oms.test', 'password' => 'another-secret-2', 'role' => 'staff', 'is_active' => true])->assertOk();

    $serialised = AuditLog::whereIn('action', ['user.created', 'user.updated'])->get()->toJson();
    expect(AuditLog::where('action', 'user.created')->exists())->toBeTrue()
        ->and($serialised)->not->toContain('super-secret-1')->not->toContain('another-secret-2')
        ->not->toMatch('/"(password|remember_token|token)"/');
});

it('restricts audit logs to admins', function (string $role) {
    actingAsRole($role);

    getJson('/api/audit-logs')->assertForbidden();
})->with(['manager', 'staff']);
