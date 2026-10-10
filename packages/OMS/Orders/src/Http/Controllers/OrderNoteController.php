<?php

declare(strict_types=1);

namespace OMS\Orders\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderActivity;
use OMS\Orders\Models\OrderNote;

class OrderNoteController extends Controller
{
    public function store(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        $order = Order::find($id);
        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if ($user->can('orders.view_assigned') && ! $user->can('orders.view_all')) {
            if ($order->assigned_to !== $user->id) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'This action is unauthorized.',
                    'code' => 'FORBIDDEN',
                    'errors' => [],
                ], 403));
            }
        }

        $validated = $request->validate([
            'body' => 'required|string|min:1|max:5000',
        ]);

        $note = OrderNote::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'body' => $validated['body'],
        ]);

        OrderActivity::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'type' => 'note_added',
            'description' => 'Added a note',
        ]);

        return response()->json([
            'success' => true,
            'message' => 'Note added successfully',
            'data' => [
                'id' => $note->id,
                'body' => $note->body,
                'user' => [
                    'id' => $user->id,
                    'name' => $user->name,
                ],
                'created_at' => $note->created_at->toIso8601String(),
            ],
        ], 201);
    }
}
