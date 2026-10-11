<?php

declare(strict_types=1);

use Illuminate\Support\Facades\Route;
use OMS\Admin\Http\Controllers\DashboardController;
use OMS\Admin\Http\Controllers\DashboardReportController;
use OMS\Core\Http\Controllers\AuditLogController;
use OMS\Core\Http\Controllers\NotificationController;
use OMS\Customers\Http\Controllers\CustomerController;
use OMS\Orders\Http\Controllers\OrderAssignmentController;
use OMS\Orders\Http\Controllers\OrderController;
use OMS\Orders\Http\Controllers\OrderNoteController;
use OMS\Orders\Http\Controllers\OrderStatusController;
use OMS\Products\Http\Controllers\ProductController;
use OMS\Users\Http\Controllers\AuthController;
use OMS\Users\Http\Controllers\RoleController;
use OMS\Users\Http\Controllers\UserController;

// Public routes
Route::get('/health', function () {
    return response()->json([
        'success' => true,
        'message' => 'OMS API is healthy',
        'data' => [
            'status' => 'ok',
            'timestamp' => now()->toIso8601String(),
            'environment' => config('app.env'),
            'version' => '1.0.0',
        ],
    ]);
});

Route::post('/login', [AuthController::class, 'login']);

// Protected routes (Sanctum)
Route::middleware('auth:sanctum')->group(function () {
    // Auth
    Route::post('/logout', [AuthController::class, 'logout']);
    Route::get('/me', [AuthController::class, 'me']);

    // Users & Roles
    Route::get('/users/assignable', [UserController::class, 'assignable']);
    Route::apiResource('users', UserController::class);

    Route::get('/roles', [RoleController::class, 'index']);
    Route::put('/roles/{id}/permissions', [RoleController::class, 'updatePermissions']);
    Route::get('/permissions', [RoleController::class, 'permissions']);

    // Customers
    Route::get('/customers/lookup', [CustomerController::class, 'lookup']);
    Route::apiResource('customers', CustomerController::class);

    // Products
    Route::get('/products/lookup', [ProductController::class, 'lookup']);
    Route::patch('/products/{id}/stock', [ProductController::class, 'adjustStock']);
    Route::apiResource('products', ProductController::class);

    // Orders
    Route::post('/orders/preview', [OrderController::class, 'preview']);
    Route::post('/orders/{id}/status', [OrderStatusController::class, 'changeStatus']);
    Route::post('/orders/{id}/assign', [OrderAssignmentController::class, 'assign']);
    Route::post('/orders/{id}/notes', [OrderNoteController::class, 'store']);
    Route::apiResource('orders', OrderController::class);

    // Dashboard
    Route::get('/dashboard/summary', [DashboardController::class, 'summary']);
    Route::get('/dashboard/status-distribution', [DashboardController::class, 'statusDistribution']);
    Route::get('/dashboard/revenue-trend', [DashboardController::class, 'revenueTrend']);
    Route::get('/dashboard/reports', [DashboardReportController::class, 'index']);
    Route::get('/dashboard/reports/export', [DashboardReportController::class, 'export']);

    // Audit logs (read only)
    Route::get('/audit-logs', [AuditLogController::class, 'index']);

    // Notifications
    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);
});
