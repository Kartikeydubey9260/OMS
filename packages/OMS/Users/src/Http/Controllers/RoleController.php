<?php

declare(strict_types=1);

namespace OMS\Users\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\Rule;
use OMS\Core\Services\AuditLogger;
use OMS\Users\Models\User;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    /**
     * Count live (non-soft-deleted) users per role id from the model_has_roles
     * pivot. Counted directly because Spatie's Role::users() resolves the
     * related model through the active request guard (auth:sanctum switches
     * the default guard to "sanctum", which has no configured provider).
     */
    private function usersCountByRoleId(): array
    {
        $pivot = config('permission.table_names.model_has_roles');
        $usersTable = (new User)->getTable();

        return DB::table("{$pivot} as mhr")
            ->join($usersTable, $usersTable.'.id', '=', 'mhr.model_id')
            ->where('mhr.model_type', User::class)
            ->whereNull($usersTable.'.deleted_at')
            ->select('mhr.role_id', DB::raw('count(*) as total'))
            ->groupBy('mhr.role_id')
            ->pluck('total', 'role_id')
            ->all();
    }

    private function usersCountForRole(Role $role): int
    {
        $pivot = config('permission.table_names.model_has_roles');
        $usersTable = (new User)->getTable();

        return (int) DB::table("{$pivot} as mhr")
            ->join($usersTable, $usersTable.'.id', '=', 'mhr.model_id')
            ->where('mhr.role_id', $role->id)
            ->where('mhr.model_type', User::class)
            ->whereNull($usersTable.'.deleted_at')
            ->count();
    }

    public function index(): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $roles = Role::query()
            ->where('guard_name', 'web')
            ->with('permissions')
            ->orderBy('name')
            ->get();

        $counts = $this->usersCountByRoleId();

        $roles->each(function (Role $role) use ($counts): void {
            $role->setAttribute('users_count', $counts[$role->id] ?? 0);
        });

        return response()->json([
            'success' => true,
            'message' => 'Roles retrieved successfully',
            'data' => $roles,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', 'unique:roles,name'],
        ]);

        $role = Role::create([
            'name' => strtolower(trim($validated['name'])),
            'guard_name' => 'web',
        ]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        AuditLogger::record(
            action: 'role.created',
            auditableType: 'role',
            auditableId: $role->id,
            label: "Created role {$role->name}",
            newValues: ['name' => $role->name]
        );

        return response()->json([
            'success' => true,
            'message' => 'Role created successfully',
            'data' => $role->fresh('permissions'),
        ], 201);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $role = Role::find($id);
        if (! $role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if (in_array($role->name, ['admin', 'super-admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'System roles cannot be renamed.',
                'code' => 'VALIDATION_ERROR',
                'errors' => ['name' => ['System roles cannot be renamed.']],
            ], 422);
        }

        $validated = $request->validate([
            'name' => ['required', 'string', 'max:50', Rule::unique('roles', 'name')->ignore($id)],
        ]);

        $oldName = $role->name;
        $newName = strtolower(trim($validated['name']));

        if ($newName !== $oldName) {
            // Keep the legacy twin role (same name, other guard) in sync so
            // name-based lookups such as `exists:roles,name` and `syncRoles`
            // behave consistently regardless of the resolved guard.
            $otherGuard = $role->guard_name === 'web' ? 'sanctum' : 'web';
            Role::query()
                ->where('guard_name', $otherGuard)
                ->where('name', $oldName)
                ->update(['name' => $newName]);
        }

        $role->update(['name' => $newName]);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        AuditLogger::record(
            action: 'role.updated',
            auditableType: 'role',
            auditableId: $role->id,
            label: "Renamed role {$oldName} to {$role->name}",
            oldValues: ['name' => $oldName],
            newValues: ['name' => $role->name]
        );

        return response()->json([
            'success' => true,
            'message' => 'Role updated successfully',
            'data' => $role->fresh('permissions'),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $role = Role::find($id);
        if (! $role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if (in_array($role->name, ['admin', 'super-admin'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'System roles cannot be deleted.',
                'code' => 'VALIDATION_ERROR',
                'errors' => ['role' => ['System roles cannot be deleted.']],
            ], 422);
        }

        if ($this->usersCountForRole($role) > 0) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete a role that still has users assigned. Reassign or remove those users first.',
                'code' => 'CONFLICT',
                'errors' => ['role' => ['Role still has users assigned.']],
            ], 422);
        }

        $roleName = $role->name;
        $role->delete();

        // Remove the legacy twin role (same name, other guard) as well.
        Role::query()
            ->where('guard_name', $role->guard_name === 'web' ? 'sanctum' : 'web')
            ->where('name', $roleName)
            ->delete();

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        AuditLogger::record(
            action: 'role.deleted',
            auditableType: 'role',
            auditableId: $role->id,
            label: "Deleted role {$roleName}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Role deleted successfully',
            'data' => null,
        ]);
    }

    public function updatePermissions(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $role = Role::find($id);
        if (! $role) {
            return response()->json([
                'success' => false,
                'message' => 'Role not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $validated = $request->validate([
            'permissions' => 'required|array',
            'permissions.*' => 'required|string|exists:permissions,name',
        ]);

        $permissions = $validated['permissions'];

        // Lock-out protection: admin role must retain core permissions
        if ($role->name === 'admin') {
            $requiredCore = ['users.manage', 'roles.manage'];
            foreach ($requiredCore as $corePerm) {
                if (! in_array($corePerm, $permissions, true)) {
                    return response()->json([
                        'success' => false,
                        'message' => 'Cannot remove core management permissions from the admin role.',
                        'code' => 'VALIDATION_ERROR',
                        'errors' => [
                            'permissions' => ["Cannot remove '{$corePerm}' from admin role."],
                        ],
                    ], 422);
                }
            }
        }

        $oldPermissions = $role->permissions->pluck('name')->all();
        $role->syncPermissions($permissions);

        app(PermissionRegistrar::class)->forgetCachedPermissions();

        AuditLogger::record(
            action: 'role.permissions_updated',
            auditableType: 'role',
            auditableId: $role->id,
            label: "Updated permissions for role {$role->name}",
            oldValues: ['permissions' => $oldPermissions],
            newValues: ['permissions' => $permissions]
        );

        return response()->json([
            'success' => true,
            'message' => 'Role permissions updated successfully',
            'data' => $role->fresh('permissions'),
        ]);
    }

    public function permissions(): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        // Only web-guard permissions: the sanctum rows are legacy orphans and
        // would otherwise appear as duplicates in the permission manager.
        $permissions = Permission::query()
            ->where('guard_name', 'web')
            ->orderBy('name')
            ->get();

        return response()->json([
            'success' => true,
            'message' => 'Permissions retrieved successfully',
            'data' => $permissions,
        ]);
    }

    protected function authorizePermission(string $permission): void
    {
        $user = Auth::user();
        if (! $user || ! $user->can($permission)) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }
    }
}
