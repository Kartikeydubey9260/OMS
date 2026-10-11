<?php

declare(strict_types=1);

namespace OMS\Users\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use OMS\Core\Services\AuditLogger;
use OMS\Users\Repositories\UserRepository;

class UserController extends Controller
{
    public function __construct(
        protected UserRepository $userRepository,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $perPage = min((int) ($request->input('per_page', 10)), (int) config('oms.max_per_page', 100));
        $users = $this->userRepository->paginate($request->all(), $perPage);

        return response()->json([
            'success' => true,
            'message' => 'Users retrieved successfully',
            'data' => $users->items(),
            'meta' => [
                'current_page' => $users->currentPage(),
                'per_page' => $users->perPage(),
                'total' => $users->total(),
                'last_page' => $users->lastPage(),
            ],
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $this->authorizePermission('users.manage');

        if ($request->has('email')) {
            $request->merge(['email' => strtolower($request->input('email'))]);
        }

        $validated = $request->validate([
            'name' => 'required|string|max:120',
            'email' => 'required|email|max:190|unique:users,email',
            'password' => 'required|string|min:6',
            'role' => 'required|string|exists:roles,name',
            'is_active' => 'boolean',
        ]);

        $user = $this->userRepository->create([
            'name' => $validated['name'],
            'email' => $validated['email'],
            'password' => Hash::make($validated['password']),
            'is_active' => $validated['is_active'] ?? true,
        ]);

        $user->assignRole($validated['role']);

        AuditLogger::record(
            action: 'user.created',
            auditableType: 'user',
            auditableId: $user->id,
            label: "Created user {$user->name} ({$user->email})",
            newValues: ['name' => $user->name, 'email' => $user->email, 'role' => $validated['role']]
        );

        return response()->json([
            'success' => true,
            'message' => 'User created successfully',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $validated['role'],
                'is_active' => $user->is_active,
            ],
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $user = $this->userRepository->find($id);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        return response()->json([
            'success' => true,
            'message' => 'User retrieved successfully',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->getRoleNames()->first() ?? 'staff',
                'is_active' => $user->is_active,
                'created_at' => $user->created_at,
            ],
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $user = $this->userRepository->find($id);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if ($request->has('email')) {
            $request->merge(['email' => strtolower($request->input('email'))]);
        }

        $validated = $request->validate([
            'name' => 'sometimes|string|max:120',
            'email' => "sometimes|email|max:190|unique:users,email,{$id}",
            'password' => 'sometimes|nullable|string|min:6',
            'role' => 'sometimes|string|exists:roles,name',
            'is_active' => 'sometimes|boolean',
        ]);

        $updateData = [];
        if (isset($validated['name'])) {
            $updateData['name'] = $validated['name'];
        }
        if (isset($validated['email'])) {
            $updateData['email'] = $validated['email'];
        }
        if (! empty($validated['password'])) {
            $updateData['password'] = Hash::make($validated['password']);
        }
        if (isset($validated['is_active'])) {
            $updateData['is_active'] = $validated['is_active'];
        }

        $this->userRepository->update($user, $updateData);

        if (! empty($validated['role'])) {
            $user->syncRoles([$validated['role']]);
        }

        AuditLogger::record(
            action: 'user.updated',
            auditableType: 'user',
            auditableId: $user->id,
            label: "Updated user {$user->name}",
            newValues: $updateData
        );

        return response()->json([
            'success' => true,
            'message' => 'User updated successfully',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->getRoleNames()->first() ?? 'staff',
                'is_active' => $user->is_active,
            ],
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $this->authorizePermission('users.manage');

        $user = $this->userRepository->find($id);
        if (! $user) {
            return response()->json([
                'success' => false,
                'message' => 'User not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if ($user->id === Auth::id()) {
            return response()->json([
                'success' => false,
                'message' => 'Cannot delete your own account.',
                'code' => 'VALIDATION_ERROR',
                'errors' => ['user' => ['You cannot delete your own account.']],
            ], 422);
        }

        $this->userRepository->delete($user);

        AuditLogger::record(
            action: 'user.deleted',
            auditableType: 'user',
            auditableId: $user->id,
            label: "Deleted user {$user->name}"
        );

        return response()->json([
            'success' => true,
            'message' => 'User deleted successfully',
            'data' => null,
        ]);
    }

    public function assignable(): JsonResponse
    {
        $user = Auth::user();
        if (! $user || (! $user->can('orders.assign') && ! $user->can('orders.create') && ! $user->can('orders.view_all'))) {
            return response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403);
        }

        $users = $this->userRepository->getAssignable();

        return response()->json([
            'success' => true,
            'message' => 'Assignable users retrieved successfully',
            'data' => $users,
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
