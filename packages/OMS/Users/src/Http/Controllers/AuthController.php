<?php

declare(strict_types=1);

namespace OMS\Users\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\RateLimiter;
use OMS\Users\Models\User;

class AuthController extends Controller
{
    public function login(Request $request): JsonResponse
    {
        $request->validate([
            'email' => 'required|email',
            'password' => 'required|string',
        ]);

        $throttleKey = 'login:'.$request->ip().'|'.strtolower((string) $request->input('email'));
        $maxAttempts = (int) config('oms.login_throttle', 5);

        if (RateLimiter::tooManyAttempts($throttleKey, $maxAttempts)) {
            return response()->json([
                'success' => false,
                'message' => 'Too Many Requests',
                'code' => 'TOO_MANY_REQUESTS',
                'errors' => [],
            ], 429);
        }

        $user = User::where('email', $request->input('email'))->first();

        if (! $user || ! Hash::check((string) $request->input('password'), $user->password) || ! $user->is_active) {
            RateLimiter::hit($throttleKey, 60);

            return response()->json([
                'success' => false,
                'message' => 'The provided credentials are incorrect or your account is disabled.',
                'code' => 'INVALID_CREDENTIALS',
                'errors' => [],
            ], 401);
        }

        RateLimiter::clear($throttleKey);

        $user->update(['last_login_at' => now()]);
        $token = $user->createToken('api', ['*'], now()->addHours(8))->plainTextToken;

        return response()->json([
            'success' => true,
            'message' => 'Login successful',
            'data' => [
                'token' => $token,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'role' => $user->getRoleNames()->first() ?? 'staff',
                    'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
                ],
            ],
        ]);
    }

    public function logout(Request $request): JsonResponse
    {
        $user = $request->user();
        if ($user && $user->currentAccessToken()) {
            $user->currentAccessToken()->delete();
        }

        return response()->json([
            'success' => true,
            'message' => 'Logged out successfully',
            'data' => null,
        ]);
    }

    public function me(Request $request): JsonResponse
    {
        $user = $request->user();

        return response()->json([
            'success' => true,
            'message' => 'Current user retrieved',
            'data' => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'role' => $user->getRoleNames()->first() ?? 'staff',
                'permissions' => $user->getAllPermissions()->pluck('name')->values()->all(),
            ],
        ]);
    }
}
