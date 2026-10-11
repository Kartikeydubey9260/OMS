<?php

declare(strict_types=1);

use OMS\Core\Models\AuditLog;
use Spatie\Permission\Models\Role;

use function Pest\Laravel\deleteJson;
use function Pest\Laravel\getJson;
use function Pest\Laravel\postJson;
use function Pest\Laravel\putJson;

it('lets an admin create a role and lists it with its user count', function () {
    actingAsRole('admin');

    postJson('/api/roles', ['name' => 'qa-crew'])->assertCreated()->assertJsonPath('data.name', 'qa-crew');

    $roles = getJson('/api/roles')->assertOk()->json('data');
    $created = collect($roles)->firstWhere('name', 'qa-crew');

    expect($created['users_count'])->toBe(0)
        ->and(AuditLog::where('action', 'role.created')->exists())->toBeTrue();
});

it('rejects duplicate and blank role names', function () {
    actingAsRole('admin');

    postJson('/api/roles', ['name' => 'admin'])->assertUnprocessable();
    postJson('/api/roles', ['name' => ''])->assertUnprocessable();
});

it('renames a non-system role and audits it', function () {
    actingAsRole('admin');
    $role = Role::findByName('staff');

    putJson("/api/roles/{$role->id}", ['name' => 'support'])->assertOk();

    expect(Role::findByName('support'))->not->toBeNull()
        ->and(AuditLog::where('action', 'role.updated')->exists())->toBeTrue();
});

it('refuses to rename system roles', function () {
    actingAsRole('admin');
    $role = Role::findByName('admin');

    putJson("/api/roles/{$role->id}", ['name' => 'superuser'])
        ->assertUnprocessable()
        ->assertJsonValidationErrors(['name']);

    expect(Role::findByName('admin'))->not->toBeNull();
});

it('deletes an empty role but refuses to delete roles that still have users', function () {
    actingAsRole('admin');
    makeUser('staff');

    postJson('/api/roles', ['name' => 'temp-role'])->assertCreated();
    $emptyId = collect(getJson('/api/roles')->assertOk()->json('data'))->firstWhere('name', 'temp-role')['id'];
    deleteJson("/api/roles/{$emptyId}")->assertOk();
    expect(Role::query()->where('name', 'temp-role')->where('guard_name', 'web')->exists())->toBeFalse()
        ->and(AuditLog::where('action', 'role.deleted')->exists())->toBeTrue();

    $staff = collect(getJson('/api/roles')->assertOk()->json('data'))->firstWhere('name', 'staff');
    deleteJson("/api/roles/{$staff['id']}")
        ->assertStatus(422)
        ->assertJsonPath('code', 'CONFLICT');
    expect(Role::query()->where('name', 'staff')->where('guard_name', 'web')->exists())->toBeTrue();
});

it('refuses to delete system roles', function () {
    actingAsRole('admin');
    $role = Role::findByName('admin');

    deleteJson("/api/roles/{$role->id}")->assertStatus(422);

    expect(Role::findByName('admin'))->not->toBeNull();
});

it('reports the real user count for every role', function () {
    actingAsRole('admin');
    makeUser('staff');

    $roles = getJson('/api/roles')->assertOk()->json('data');
    $staff = collect($roles)->firstWhere('name', 'staff');
    $admin = collect($roles)->firstWhere('name', 'admin');

    expect($staff['users_count'])->toBe(1)
        ->and($admin['users_count'])->toBe(1);
});

it('stops counting soft-deleted users and frees the role for deletion', function () {
    actingAsRole('admin');
    $staffUser = makeUser('staff');

    deleteJson("/api/users/{$staffUser->id}")->assertOk();

    $role = collect(getJson('/api/roles')->assertOk()->json('data'))->firstWhere('name', 'staff');
    expect($role['users_count'])->toBe(0);

    deleteJson("/api/roles/{$role['id']}")->assertOk();
    expect(Role::query()->where('name', 'staff')->where('guard_name', 'web')->exists())->toBeFalse();
});

it('restricts role creation, renaming and deletion to admins', function (string $role) {
    actingAsRole($role);
    $target = Role::findByName('staff');

    postJson('/api/roles', ['name' => 'not-allowed'])->assertForbidden();
    putJson("/api/roles/{$target->id}", ['name' => 'not-allowed'])->assertForbidden();
    deleteJson("/api/roles/{$target->id}")->assertForbidden();
})->with(['manager', 'staff']);
