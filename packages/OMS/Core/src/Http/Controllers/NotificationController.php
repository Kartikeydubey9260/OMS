<?php

declare(strict_types=1);

namespace OMS\Core\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Notifications\DatabaseNotification;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;

class NotificationController extends Controller
{
    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        $query = $user->notifications();

        if ($request->input('unread') == 1) {
            $query = $user->unreadNotifications();
        }

        $notifications = $query->latest('created_at')->get()->map(function (DatabaseNotification $n) {
            return [
                'id' => $n->id,
                'read_at' => $n->read_at?->toIso8601String(),
                'created_at' => $n->created_at?->toIso8601String(),
                'data' => $n->data,
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Notifications retrieved successfully',
            'data' => $notifications,
        ]);
    }

    public function unreadCount(): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        $count = $user->unreadNotifications()->count();

        return response()->json([
            'success' => true,
            'message' => 'Unread notifications count retrieved successfully',
            'data' => [
                'count' => $count,
            ],
        ]);
    }

    public function markAsRead(string $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        /** @var DatabaseNotification|null $notification */
        $notification = $user->notifications()->where('id', $id)->first();
        if (! $notification) {
            return response()->json([
                'success' => false,
                'message' => 'Notification not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $notification->markAsRead();

        return response()->json([
            'success' => true,
            'message' => 'Notification marked as read',
            'data' => null,
        ]);
    }

    public function markAllAsRead(): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        $user->unreadNotifications()->update(['read_at' => now()]);

        return response()->json([
            'success' => true,
            'message' => 'All notifications marked as read',
            'data' => null,
        ]);
    }
}
