<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use OMS\Orders\Models\Order;
use Laravel\Sanctum\Sanctum;

use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;

/* ---------------------------------------------------------------- assignment */

it('assigns an order, audits old → new and records an activity', function () {
    actingAsRole('manager');
    $staff = makeUser('staff');
    $order = Order::factory()->pending()->create(['assigned_to' => null]);

    postJson("/api/orders/{$order->id}/assign", ['assigned_to' => $staff->id])
        ->assertOk()
        ->assertJsonPath('data.assigned_to.id', $staff->id);

    $log = AuditLog::where('action', 'order.assigned')->where('auditable_id', $order->id)->first();
    expect($log)->not->toBeNull()
        ->and($log->old_values['assigned_to'])->toBeNull()
        ->and($log->new_values['assigned_to'])->toBe($staff->id)
        ->and($order->activities()->where('type', 'assigned')->exists())->toBeTrue();
});

it('records the previous assignee when reassigning and ignores a no-op', function () {
    actingAsRole('admin');
    [$a, $b] = [makeUser('staff'), makeUser('staff')];
    $order = Order::factory()->pending()->create(['assigned_to' => $a->id]);

    postJson("/api/orders/{$order->id}/assign", ['assigned_to' => $b->id])->assertOk();
    postJson("/api/orders/{$order->id}/assign", ['assigned_to' => $b->id])->assertOk(); // same person again

    $logs = AuditLog::where('action', 'order.assigned')->where('auditable_id', $order->id)->get();
    expect($logs)->toHaveCount(1)
        ->and($logs->first()->old_values['assigned_to'])->toBe($a->id)
        ->and($logs->first()->new_values['assigned_to'])->toBe($b->id);
});

it('rejects unknown or inactive assignees and terminal orders', function () {
    actingAsRole('admin');
    $inactive = makeUser('staff', ['is_active' => false]);
    $pending = Order::factory()->pending()->create();
    $completed = Order::factory()->completed()->create();
    $staff = makeUser('staff');

    postJson("/api/orders/{$pending->id}/assign", ['assigned_to' => 99999999])->assertUnprocessable();
    postJson("/api/orders/{$pending->id}/assign", ['assigned_to' => $inactive->id])->assertUnprocessable();
    postJson("/api/orders/{$completed->id}/assign", ['assigned_to' => $staff->id])->assertUnprocessable();
});

/* --------------------------------------------------------------------- notes */

it('adds a note, shows it in the detail and the activity feed', function () {
    $user = actingAsRole('manager');
    $order = Order::factory()->pending()->create();

    postJson("/api/orders/{$order->id}/notes", ['body' => 'Call the customer tomorrow'])
        ->assertCreated()
        ->assertJsonPath('data.body', 'Call the customer tomorrow');

    $d = getJson("/api/orders/{$order->id}")->json('data');
    expect(collect($d['notes_list'])->pluck('body'))->toContain('Call the customer tomorrow')
        ->and($order->activities()->where('type', 'note_added')->where('user_id', $user->id)->exists())->toBeTrue();
});

it('allows notes on terminal orders', function (string $state) {
    actingAsRole('admin');
    $order = Order::factory()->{$state}()->create();

    postJson("/api/orders/{$order->id}/notes", ['body' => 'post-mortem'])->assertCreated();
})->with(['completed', 'cancelled']);

it('validates notes and stores markup as plain text (escaped on render)', function () {
    actingAsRole('admin');
    $order = Order::factory()->pending()->create();

    postJson("/api/orders/{$order->id}/notes", ['body' => ''])->assertUnprocessable()->assertJsonValidationErrors('body');
    postJson("/api/orders/{$order->id}/notes", ['body' => str_repeat('x', 5001)])->assertUnprocessable()->assertJsonValidationErrors('body');
    postJson("/api/orders/{$order->id}/notes", ['body' => '<script>alert(1)</script>'])
        ->assertCreated()->assertJsonPath('data.body', '<script>alert(1)</script>');
});

/* ------------------------------------------------------------- notifications */

it('notifies the new assignee, but never the actor', function () {
    $admin = actingAsRole('admin');
    $staff = makeUser('staff');

    createOrderViaApi(['assigned_to' => $staff->id]);

    $n = $staff->notifications()->get();
    expect($n)->toHaveCount(1)
        ->and($n->first()->data)->toHaveKeys(['type', 'message', 'order_id', 'order_number'])
        ->and($n->first()->data['type'])->toBe('order_assigned')
        ->and(strtolower($n->first()->data['message']))->toContain('assigned')
        ->and($admin->notifications()->count())->toBe(0);
});

it('does not notify when someone assigns an order to themselves', function () {
    $admin = actingAsRole('admin');

    createOrderViaApi(['assigned_to' => $admin->id]);

    expect($admin->notifications()->count())->toBe(0);
});

it('notifies creator and assignee when an order is confirmed, but not the person confirming', function () {
    $manager = makeUser('manager');
    $staff = makeUser('staff');
    $admin = makeUser('admin');
    Sanctum::actingAs($manager);
    $id = createOrderViaApi(['assigned_to' => $staff->id]);

    Sanctum::actingAs($admin);
    setStatusViaApi($id, 'confirmed')->assertOk();

    $types = fn ($u) => $u->notifications()->get()->pluck('data.type')->all();
    expect($types($staff))->toContain('order_assigned', 'order_confirmed')
        ->and($types($manager))->toBe(['order_confirmed'])
        ->and($admin->notifications()->count())->toBe(0);
});

it('notifies creator and assignee when an order is cancelled', function () {
    $manager = makeUser('manager');
    $staff = makeUser('staff');
    $admin = makeUser('admin');
    Sanctum::actingAs($manager);
    $id = createOrderViaApi(['assigned_to' => $staff->id]);

    Sanctum::actingAs($admin);
    setStatusViaApi($id, 'cancelled', 'Customer request')->assertOk();

    expect($staff->notifications()->get()->pluck('data.type')->all())->toContain('order_cancelled')
        ->and($manager->notifications()->get()->pluck('data.type')->all())->toContain('order_cancelled')
        ->and($admin->notifications()->count())->toBe(0);
});

it('lists, counts and marks notifications as read for the current user only', function () {
    $admin = makeUser('admin');
    $staff = makeUser('staff');
    Sanctum::actingAs($admin);
    createOrderViaApi(['assigned_to' => $staff->id]);
    createOrderViaApi(['assigned_to' => $staff->id]);

    Sanctum::actingAs($staff);
    getJson('/api/notifications/unread-count')->assertOk()->assertJsonPath('data.count', 2);
    $list = getJson('/api/notifications?unread=1')
        ->assertOk()
        ->assertJsonCount(2, 'data')
        ->assertJsonStructure(['data' => [['id', 'read_at', 'created_at', 'data' => ['type', 'message', 'order_id', 'order_number']]]]);
    $id = $list->json('data.0.id');

    postJson("/api/notifications/{$id}/read")->assertOk();
    getJson('/api/notifications/unread-count')->assertJsonPath('data.count', 1);
    expect(getJson('/api/notifications')->json('data'))->toHaveCount(2); // read ones stay in the full list

    // somebody else cannot touch it
    Sanctum::actingAs(makeUser('manager'));
    expect(postJson("/api/notifications/{$id}/read")->status())->toBeIn([403, 404]);

    Sanctum::actingAs($staff);
    postJson('/api/notifications/read-all')->assertOk();
    getJson('/api/notifications/unread-count')->assertJsonPath('data.count', 0);
});

it('requires authentication for notifications', function () {
    getJson('/api/notifications/unread-count')->assertUnauthorized();
});
