<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\putJson;

it('updates a pending order, recalculates totals and bumps the version', function () {
    actingAsRole('manager');
    $id = createOrderViaApi();
    $order = Order::find($id);
    $product = Product::factory()->create(['price' => 200, 'stock_quantity' => 50]);

    $res = putJson("/api/orders/{$id}", [
        'version' => $order->version,
        'priority' => 'high',
        'items' => [['product_id' => $product->id, 'quantity' => 1]],
        'discount_type' => 'fixed',
        'discount_value' => 0,
    ])->assertOk();

    expect((float) $res->json('data.total'))->toBe(220.0) // 200 + 10% tax
        ->and($res->json('data.priority'))->toBe('high')
        ->and($res->json('data.version'))->toBe($order->version + 1)
        ->and($res->json('data.items'))->toHaveCount(1);
});

it('supports partial updates (only provided fields change)', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    $before = Order::find($id);

    putJson("/api/orders/{$id}", ['version' => $before->version, 'priority' => 'urgent'])->assertOk();

    $after = Order::find($id);
    expect($after->priority->value ?? $after->priority)->toBe('urgent')
        ->and((float) $after->total)->toBe((float) $before->total)
        ->and($after->items()->count())->toBe(2);
});

it('writes an audit entry containing only the changed keys with old and new values', function () {
    $user = actingAsRole('admin');
    $id = createOrderViaApi();

    putJson("/api/orders/{$id}", ['version' => 1, 'priority' => 'high'])->assertOk();

    $log = AuditLog::where('action', 'order.updated')->where('auditable_id', $id)->latest('id')->first();
    expect($log)->not->toBeNull()
        ->and($log->user_id)->toBe($user->id)
        ->and($log->old_values['priority'])->toBe('normal')
        ->and($log->new_values['priority'])->toBe('high')
        ->and($log->new_values)->not->toHaveKey('customer_id');
});

it('does not write an audit entry when nothing changed', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    $count = AuditLog::where('action', 'order.updated')->count();

    putJson("/api/orders/{$id}", ['version' => 1, 'priority' => 'normal'])->assertOk();

    expect(AuditLog::where('action', 'order.updated')->count())->toBe($count);
});

it('rejects a stale version with 409 CONFLICT and changes nothing', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();
    putJson("/api/orders/{$id}", ['version' => 1, 'priority' => 'high'])->assertOk();

    putJson("/api/orders/{$id}", ['version' => 1, 'priority' => 'low'])
        ->assertStatus(409)
        ->assertJsonPath('code', 'CONFLICT');

    expect(Order::find($id)->priority->value ?? Order::find($id)->priority)->toBe('high');
});

it('requires the version field', function () {
    actingAsRole('admin');
    $id = createOrderViaApi();

    putJson("/api/orders/{$id}", ['priority' => 'high'])->assertUnprocessable()->assertJsonValidationErrors('version');
});

it('only allows editing draft or pending orders', function (string $status) {
    actingAsRole('admin');
    $order = Order::factory()->state(['status' => $status])->create();

    putJson("/api/orders/{$order->id}", ['version' => $order->version, 'priority' => 'high'])
        ->assertUnprocessable();
})->with(['confirmed', 'processing', 'ready', 'completed', 'cancelled']);

it('lets only admins delete, and only draft or cancelled orders', function () {
    actingAsRole('admin');
    $draft = Order::factory()->draft()->create();
    $pending = Order::factory()->pending()->create();
    $cancelled = Order::factory()->cancelled()->create();

    deleteJson("/api/orders/{$pending->id}")->assertUnprocessable();
    deleteJson("/api/orders/{$draft->id}")->assertOk();
    deleteJson("/api/orders/{$cancelled->id}")->assertOk();

    $this->assertSoftDeleted('orders', ['id' => $draft->id]);
    getJson("/api/orders/{$draft->id}")->assertNotFound();
    expect(AuditLog::where('action', 'order.deleted')->where('auditable_id', $draft->id)->exists())->toBeTrue();
});

it('forbids managers from deleting orders', function () {
    actingAsRole('manager');
    $draft = Order::factory()->draft()->create();

    deleteJson("/api/orders/{$draft->id}")->assertForbidden();
});

it('returns 404 for unknown orders in the error envelope', function () {
    actingAsRole('admin');

    getJson('/api/orders/99999999')->assertNotFound()->assertJsonPath('code', 'NOT_FOUND')->assertJsonPath('success', false);
});

it('exposes allowed_transitions and permissions flags on the detail resource', function () {
    actingAsRole('manager');
    $id = createOrderViaApi();

    $res = getJson("/api/orders/{$id}")->assertOk();

    expect($res->json('data.allowed_transitions'))->toContain('confirmed')
        ->and($res->json('data.permissions.can_edit'))->toBeTrue()
        ->and($res->json('data.permissions.can_delete'))->toBeFalse();
});
