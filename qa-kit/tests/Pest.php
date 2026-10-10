<?php

declare(strict_types=1);

/* OMS Pest bootstrap + shared helpers. See docs/13-test-contract.md for all shared test assumptions. */

use OMS\Customers\Models\Customer;
use OMS\Products\Models\Product;
use OMS\Users\Models\User;
use OMS\Users\Database\Seeders\RolePermissionSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Laravel\Sanctum\Sanctum;
use Spatie\Permission\PermissionRegistrar;

use function Pest\Laravel\postJson;

uses(Tests\TestCase::class, RefreshDatabase::class)->in('Feature', '../qa-kit/tests/Feature');
uses(Tests\TestCase::class)->in('Unit', '../qa-kit/tests/Unit');

const ALL_STATUSES = ['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'];

/** The single source of truth for the state machine — mirrors docs/05-business-rules.md §2. */
function transitionMap(): array
{
    return [
        'draft' => ['pending', 'cancelled'],
        'pending' => ['confirmed', 'cancelled', 'draft'],
        'confirmed' => ['processing', 'cancelled'],
        'processing' => ['ready', 'cancelled'],
        'ready' => ['completed', 'cancelled'],
        'completed' => [],
        'cancelled' => [],
    ];
}

function seedRoles(): void
{
    app(PermissionRegistrar::class)->forgetCachedPermissions();
    test()->seed(RolePermissionSeeder::class);
}

function makeUser(string $role, array $attrs = []): User
{
    seedRoles();
    $user = User::factory()->create($attrs + ['is_active' => true]);
    $user->assignRole($role);

    return $user;
}

function actingAsRole(string $role, array $attrs = []): User
{
    $user = makeUser($role, $attrs);
    Sanctum::actingAs($user);

    return $user;
}

/** Valid create-order payload: the assessment example (2×100 + 3×50, −20, 10% tax = 363). */
function orderPayload(array $override = []): array
{
    $customer = Customer::factory()->create();
    $a = Product::factory()->create(['price' => 100, 'stock_quantity' => 100, 'status' => 'active']);
    $b = Product::factory()->create(['price' => 50, 'stock_quantity' => 100, 'status' => 'active']);

    return array_replace([
        'customer_id' => $customer->id,
        'order_date' => now()->toDateString(),
        'priority' => 'normal',
        'status' => 'pending',
        'discount_type' => 'fixed',
        'discount_value' => 20,
        'items' => [
            ['product_id' => $a->id, 'quantity' => 2],
            ['product_id' => $b->id, 'quantity' => 3],
        ],
    ], $override);
}

/** Creates an order through the real API as the currently authenticated user and returns its id. */
function createOrderViaApi(array $override = []): int
{
    $res = postJson('/api/orders', orderPayload($override))->assertCreated();

    return (int) $res->json('data.id');
}

function setStatusViaApi(int $orderId, string $status, ?string $remarks = null): \Illuminate\Testing\TestResponse
{
    return postJson("/api/orders/{$orderId}/status", array_filter(['status' => $status, 'remarks' => $remarks]));
}
