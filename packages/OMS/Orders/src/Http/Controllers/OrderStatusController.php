<?php

declare(strict_types=1);

namespace OMS\Orders\Http\Controllers;

use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Validation\ValidationException;
use OMS\Core\Services\AuditLogger;
use OMS\Inventory\Contracts\InventoryService as InventoryServiceContract;
use OMS\Orders\Enums\OrderStatus;
use OMS\Orders\Exceptions\InvalidStatusTransitionException;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderActivity;
use OMS\Orders\Models\OrderStatusHistory;
use OMS\Orders\Notifications\OrderNotification;
use OMS\Users\Models\User;

class OrderStatusController extends Controller
{
    public function __construct(
        protected InventoryServiceContract $inventoryService,
    ) {}

    public function changeStatus(Request $request, int $id): JsonResponse
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

        if ($request->has('version') && (int) $request->input('version') !== $order->version) {
            return response()->json([
                'success' => false,
                'message' => 'Order has been modified by another user.',
                'code' => 'CONFLICT',
                'errors' => [],
            ], 409);
        }

        $validated = $request->validate([
            'status' => 'required|string|in:draft,pending,confirmed,processing,ready,completed,cancelled',
            'remarks' => 'nullable|string|max:500',
            'version' => 'nullable|integer',
        ]);

        $fromStatus = $order->status->value;
        $targetStatus = $validated['status'];

        // Staff-specific permission check
        if ($user->hasRole('staff') && ! $user->hasRole('admin') && ! $user->hasRole('manager')) {
            if ($order->assigned_to !== $user->id) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'This action is unauthorized.',
                    'code' => 'FORBIDDEN',
                    'errors' => [],
                ], 403));
            }

            // Staff may only transition confirmed -> processing or processing -> ready
            $allowedStaff = [
                'confirmed' => ['processing'],
                'processing' => ['ready'],
            ];

            if (! isset($allowedStaff[$fromStatus]) || ! in_array($targetStatus, $allowedStaff[$fromStatus], true)) {
                abort(response()->json([
                    'success' => false,
                    'message' => 'This action is unauthorized.',
                    'code' => 'FORBIDDEN',
                    'errors' => [],
                ], 403));
            }
        }

        // State machine transition validation
        $transitionMap = [
            'draft' => ['pending', 'cancelled'],
            'pending' => ['confirmed', 'cancelled', 'draft'],
            'confirmed' => ['processing', 'cancelled'],
            'processing' => ['ready', 'cancelled'],
            'ready' => ['completed', 'cancelled'],
            'completed' => [],
            'cancelled' => [],
        ];

        $validTargets = $transitionMap[$fromStatus];
        if (! in_array($targetStatus, $validTargets, true)) {
            throw new InvalidStatusTransitionException("Cannot transition order from {$fromStatus} to {$targetStatus}.");
        }

        // Validation: cannot leave draft without items
        if ($fromStatus === 'draft' && $targetStatus === 'pending') {
            if ($order->items()->count() === 0) {
                throw ValidationException::withMessages(['status' => 'Order must contain at least one product before leaving draft.']);
            }
        }

        // Validation: cancellation after confirmation requires remarks
        if (in_array($fromStatus, ['confirmed', 'processing', 'ready'], true) && $targetStatus === 'cancelled') {
            if (empty($validated['remarks'])) {
                throw ValidationException::withMessages(['remarks' => 'Remarks are required when cancelling a confirmed order.']);
            }
        }

        DB::transaction(function () use ($order, $fromStatus, $targetStatus, $validated, $user) {
            if ($targetStatus === 'confirmed') {
                $this->inventoryService->reserveStock($order);
                $order->confirmed_at = now();
            } elseif ($targetStatus === 'cancelled') {
                if ($order->stock_reserved) {
                    $this->inventoryService->restoreStock($order);
                }
                $order->cancelled_at = now();
                $order->cancellation_reason = $validated['remarks'] ?? null;
            } elseif ($targetStatus === 'completed') {
                $order->completed_at = now();
            }

            $order->status = OrderStatus::from($targetStatus);
            $order->version = $order->version + 1;
            $order->save();

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'from_status' => $fromStatus,
                'to_status' => $targetStatus,
                'changed_by' => $user->id,
                'remarks' => $validated['remarks'] ?? null,
            ]);

            OrderActivity::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'type' => 'status_changed',
                'description' => "Status changed from {$fromStatus} to {$targetStatus}",
            ]);

            // Notifications on confirmed or cancelled
            if (in_array($targetStatus, ['confirmed', 'cancelled'], true)) {
                $notifType = $targetStatus === 'confirmed' ? 'order_confirmed' : 'order_cancelled';
                $verb = $targetStatus === 'confirmed' ? 'confirmed' : 'cancelled';
                $message = "Order {$order->order_number} has been {$verb}.";

                $recipientIds = array_unique(array_filter([$order->created_by, $order->assigned_to]));
                foreach ($recipientIds as $recId) {
                    if ($recId !== $user->id) {
                        $recipient = User::find($recId);
                        $recipient?->notify(new OrderNotification(
                            type: $notifType,
                            message: $message,
                            orderId: $order->id,
                            orderNumber: $order->order_number,
                        ));
                    }
                }
            }

            AuditLogger::record(
                action: 'order.status_changed',
                auditableType: 'order',
                auditableId: $order->id,
                label: "Status changed to {$targetStatus} for Order #{$order->order_number}",
                oldValues: ['status' => $fromStatus],
                newValues: ['status' => $targetStatus]
            );
        });

        return response()->json([
            'success' => true,
            'message' => 'Order status updated successfully',
            'data' => $order->fresh(),
        ]);
    }
}
