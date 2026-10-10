<?php

declare(strict_types=1);

namespace OMS\Users\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Core\Services\AuditLogger;
use Spatie\Permission\Models\Permission;
use Spatie\Permission\Models\Role;
use Spatie\Permission\PermissionRegistrar;

class RoleController extends Controller
{
    public function index(): JsonResponse
    {
        $this->authorizePermission('roles.manage');

        $roles = Role::with('permissions')->get();

        return response()->json([
            'success' => true,
            'message' => 'Roles retrieved successfully',
            'data' => $roles,
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

        $permissions = Permission::all();

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
