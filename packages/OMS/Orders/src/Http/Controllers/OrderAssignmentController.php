<?php

declare(strict_types=1);

namespace OMS\Orders\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Validation\ValidationException;
use OMS\Core\Services\AuditLogger;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderActivity;
use OMS\Orders\Notifications\OrderNotification;
use OMS\Users\Models\User;

class OrderAssignmentController extends Controller
{
    public function assign(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->can('orders.assign')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
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

        if (in_array($order->status->value, ['completed', 'cancelled'], true)) {
            throw ValidationException::withMessages(['assigned_to' => 'Cannot assign completed or cancelled orders.']);
        }

        $validated = $request->validate([
            'assigned_to' => 'required|integer|exists:users,id',
        ]);

        $assignee = User::find($validated['assigned_to']);
        if ($assignee && ! $assignee->is_active) {
            throw ValidationException::withMessages(['assigned_to' => 'Assignee is inactive.']);
        }

        $oldAssigneeId = $order->assigned_to;
        $newAssigneeId = (int) $validated['assigned_to'];

        // If no change, return immediately without duplicate audit log
        if ($oldAssigneeId === $newAssigneeId) {
            return response()->json([
                'success' => true,
                'message' => 'Order assigned successfully',
                'data' => [
                    'id' => $order->id,
                    'assigned_to' => [
                        'id' => $assignee->id,
                        'name' => $assignee->name,
                        'email' => $assignee->email,
                    ],
                ],
            ]);
        }

        $order->update(['assigned_to' => $newAssigneeId]);

        OrderActivity::create([
            'order_id' => $order->id,
            'user_id' => $user->id,
            'type' => 'assigned',
            'description' => "Order assigned to {$assignee->name}",
        ]);

        if ($newAssigneeId !== $user->id) {
            $assignee->notify(new OrderNotification(
                type: 'order_assigned',
                message: "You have been assigned order {$order->order_number}.",
                orderId: $order->id,
                orderNumber: $order->order_number,
            ));
        }

        AuditLogger::record(
            action: 'order.assigned',
            auditableType: 'order',
            auditableId: $order->id,
            label: "Assigned Order #{$order->order_number} to {$assignee->name}",
            oldValues: ['assigned_to' => $oldAssigneeId],
            newValues: ['assigned_to' => $newAssigneeId]
        );

        return response()->json([
            'success' => true,
            'message' => 'Order assigned successfully',
            'data' => [
                'id' => $order->id,
                'assigned_to' => [
                    'id' => $assignee->id,
                    'name' => $assignee->name,
                    'email' => $assignee->email,
                ],
            ],
        ]);
    }
}
