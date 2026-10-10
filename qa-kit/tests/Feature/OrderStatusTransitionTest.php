<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderStatusHistory;

use function Pest\Laravel\getJson;

dataset('valid_transitions', function () {
    foreach (transitionMap() as $from => $targets) {
        foreach ($targets as $to) {
            yield "{$from} → {$to}" => [$from, $to];
        }
    }
});

dataset('invalid_transitions', function () {
    foreach (transitionMap() as $from => $targets) {
        foreach (ALL_STATUSES as $to) {
            if (! in_array($to, $targets, true)) {
                yield "{$from} → {$to}" => [$from, $to];
            }
        }
    }
});

it('performs every valid transition (admin) and records history + audit', function (string $from, string $to) {
    $admin = actingAsRole('admin');
    $order = Order::factory()->state(['status' => $from])->create();

    setStatusViaApi($order->id, $to, in_array($to, ['cancelled']) ? 'Customer request' : 'Moving on')
        ->assertOk()
        ->assertJsonPath('success', true)
        ->assertJsonPath('data.status', $to);

    $history = OrderStatusHistory::where('order_id', $order->id)->latest('id')->first();
    expect($history->from_status)->toBe($from)
        ->and($history->to_status)->toBe($to)
        ->and($history->changed_by)->toBe($admin->id);

    expect(AuditLog::where('action', 'order.status_changed')->where('auditable_id', $order->id)->exists())->toBeTrue();
})->with('valid_transitions');

it('rejects every invalid transition with 422 INVALID_STATUS_TRANSITION and changes nothing', function (string $from, string $to) {
    actingAsRole('admin');
    $order = Order::factory()->state(['status' => $from])->create();
    $historyCount = OrderStatusHistory::where('order_id', $order->id)->count();

    setStatusViaApi($order->id, $to, 'x')
        ->assertUnprocessable()
        ->assertJsonPath('code', 'INVALID_STATUS_TRANSITION');

    expect($order->fresh()->status->value ?? $order->fresh()->status)->toBe($from)
        ->and(OrderStatusHistory::where('order_id', $order->id)->count())->toBe($historyCount);
})->with('invalid_transitions');

it('rejects unknown status values with a validation error', function () {
    actingAsRole('admin');
    $order = Order::factory()->pending()->create();

    setStatusViaApi($order->id, 'teleported')->assertUnprocessable()->assertJsonValidationErrors('status');
});

it('requires a reason when cancelling after confirmation', function (string $from) {
    actingAsRole('admin');
    $order = Order::factory()->state(['status' => $from])->create();

    setStatusViaApi($order->id, 'cancelled')->assertUnprocessable()->assertJsonValidationErrors('remarks');
    setStatusViaApi($order->id, 'cancelled', 'Out of stock at supplier')->assertOk();
})->with(['confirmed', 'processing', 'ready']);

it('stores remarks and timestamps on the order', function () {
    actingAsRole('admin');
    $order = Order::factory()->pending()->create();

    setStatusViaApi($order->id, 'confirmed', 'Customer confirmed the order.')->assertOk();
    $order->refresh();

    expect($order->confirmed_at)->not->toBeNull();
    $res = getJson("/api/orders/{$order->id}")->assertOk();
    $entry = collect($res->json('data.status_history'))->firstWhere('to_status', 'confirmed');
    expect($entry['remarks'])->toBe('Customer confirmed the order.')->and($entry['from_status'])->toBe('pending');
});

it('refuses to leave draft when the order has no items', function () {
    actingAsRole('admin');
    $order = Order::factory()->draft()->create();
    $order->items()->delete();

    setStatusViaApi($order->id, 'pending')->assertUnprocessable();
});

it('bumps the version on every transition', function () {
    actingAsRole('admin');
    $order = Order::factory()->pending()->create();
    $v = $order->version;

    setStatusViaApi($order->id, 'confirmed')->assertOk();

    expect($order->fresh()->version)->toBe($v + 1);
});

it('rejects a stale version supplied with a status change', function () {
    actingAsRole('admin');
    $order = Order::factory()->pending()->create();

    $this->postJson("/api/orders/{$order->id}/status", ['status' => 'confirmed', 'version' => $order->version + 5])
        ->assertStatus(409)->assertJsonPath('code', 'CONFLICT');
});
