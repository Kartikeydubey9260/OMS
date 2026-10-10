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
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderActivity;
use OMS\Orders\Models\OrderItem;
use OMS\Orders\Models\OrderNote;
use OMS\Orders\Models\OrderStatusHistory;
use OMS\Orders\Notifications\OrderNotification;
use OMS\Orders\Repositories\OrderRepository;
use OMS\Orders\Services\OrderPricingService;
use OMS\Products\Models\Product;
use OMS\Users\Models\User;

class OrderController extends Controller
{
    public function __construct(
        protected OrderRepository $orderRepository,
        protected OrderPricingService $pricingService,
    ) {}

    public function index(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user || (! $user->can('orders.view_all') && ! $user->can('orders.view_assigned'))) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        if ($request->has('sort')) {
            $allowedSorts = ['order_date', 'total', 'status', 'priority', 'customer', 'created_at'];
            if (! in_array($request->input('sort'), $allowedSorts, true)) {
                throw ValidationException::withMessages(['sort' => 'Invalid sort column.']);
            }
        }

        if ($request->has('direction')) {
            $direction = strtolower((string) $request->input('direction'));
            if (! in_array($direction, ['asc', 'desc'], true)) {
                throw ValidationException::withMessages(['direction' => 'Invalid sort direction.']);
            }
        }

        if ($request->has('per_page')) {
            $perPageVal = $request->input('per_page');
            if (! is_numeric($perPageVal) || (int) $perPageVal < 1) {
                throw ValidationException::withMessages(['per_page' => 'per_page must be at least 1.']);
            }
        }

        $perPage = min((int) $request->input('per_page', 15), (int) config('oms.max_per_page', 100));
        $orders = $this->orderRepository->paginate($request->all(), $perPage, $user);

        $items = collect($orders->items())->map(function (Order $order) {
            return [
                'id' => $order->id,
                'order_number' => $order->order_number,
                'customer' => $order->customer ? [
                    'id' => $order->customer->id,
                    'name' => $order->customer->name,
                    'email' => $order->customer->email,
                ] : null,
                'order_date' => $order->order_date instanceof \DateTimeInterface ? $order->order_date->format('Y-m-d') : ($order->order_date ? (string) $order->order_date : null),
                'status' => $order->status->value,
                'priority' => $order->priority->value,
                'assigned_to' => $order->assignee ? [
                    'id' => $order->assignee->id,
                    'name' => $order->assignee->name,
                    'email' => $order->assignee->email,
                ] : null,
                'total' => (float) $order->total,
                'created_at' => $order->created_at?->toIso8601String(),
            ];
        });

        return response()->json([
            'success' => true,
            'message' => 'Orders retrieved successfully',
            'data' => $items,
            'meta' => [
                'current_page' => $orders->currentPage(),
                'per_page' => $orders->perPage(),
                'total' => $orders->total(),
                'last_page' => $orders->lastPage(),
            ],
        ]);
    }

    public function preview(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->can('orders.create')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        $validated = $request->validate([
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1|max:100000',
            'discount_type' => 'nullable|string|in:fixed,percent,percentage,none',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0',
        ]);

        $dType = $validated['discount_type'] ?? null;
        if ($dType === 'percentage') {
            $dType = 'percent';
        }
        if ($dType === 'none') {
            $dType = null;
        }
        $validated['discount_type'] = $dType;

        if (($validated['discount_type'] ?? null) === 'percent' && ((float) ($validated['discount_value'] ?? 0)) > 100) {
            throw ValidationException::withMessages(['discount_value' => 'Percentage discount cannot exceed 100%.']);
        }

        foreach ($validated['items'] as $index => $item) {
            $product = Product::find($item['product_id']);
            if ($product && $product->status === 'inactive') {
                throw ValidationException::withMessages(["items.{$index}.product_id" => 'Product is inactive.']);
            }
        }

        $result = $this->pricingService->calculate(
            rawItems: $validated['items'],
            discountType: $validated['discount_type'] ?? null,
            discountValue: (float) ($validated['discount_value'] ?? 0),
            taxRate: isset($validated['tax_rate']) ? (float) $validated['tax_rate'] : null,
        );

        return response()->json([
            'success' => true,
            'message' => 'Preview calculated successfully',
            'data' => $result,
        ]);
    }

    public function store(Request $request): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->can('orders.create')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        $validated = $request->validate([
            'customer_id' => 'required|integer|exists:customers,id',
            'order_date' => 'sometimes|date',
            'priority' => 'sometimes|string|in:low,normal,high,urgent',
            'status' => 'sometimes|string|in:draft,pending',
            'assigned_to' => 'nullable|integer|exists:users,id',
            'items' => 'required|array|min:1',
            'items.*.product_id' => 'required|integer|exists:products,id',
            'items.*.quantity' => 'required|integer|min:1',
            'discount_type' => 'nullable|string|in:fixed,percent,percentage,none',
            'discount_value' => 'nullable|numeric|min:0',
            'tax_rate' => 'nullable|numeric|min:0',
            'notes' => 'nullable|string|max:5000',
        ], [
            'customer_id.required' => 'Customer is required.',
            'customer_id.exists' => 'Customer must exist.',
            'items.required' => 'Order must contain at least one product.',
            'items.min' => 'Order must contain at least one product.',
            'items.*.product_id.exists' => 'Product must exist.',
            'items.*.quantity.min' => 'Quantity must be greater than 0.',
            'items.*.quantity.integer' => 'Quantity must be an integer.',
        ]);

        $dType = $validated['discount_type'] ?? null;
        if ($dType === 'percentage') {
            $dType = 'percent';
        }
        if ($dType === 'none') {
            $dType = null;
        }
        $validated['discount_type'] = $dType;

        $customer = Customer::find($validated['customer_id']);
        if ($customer && ! $customer->is_active) {
            throw ValidationException::withMessages(['customer_id' => 'Customer is inactive.']);
        }

        if (! empty($validated['assigned_to'])) {
            $assignee = User::find($validated['assigned_to']);
            if ($assignee && ! $assignee->is_active) {
                throw ValidationException::withMessages(['assigned_to' => 'Assignee is inactive.']);
            }
        }

        if (($validated['discount_type'] ?? null) === 'percent' && ((float) ($validated['discount_value'] ?? 0)) > 100) {
            throw ValidationException::withMessages(['discount_value' => 'Percentage discount cannot exceed 100%.']);
        }

        foreach ($validated['items'] as $index => $item) {
            $product = Product::find($item['product_id']);
            if ($product && $product->status === 'inactive') {
                throw ValidationException::withMessages(["items.{$index}.product_id" => 'Product is inactive.']);
            }
        }

        $pricing = $this->pricingService->calculate(
            rawItems: $validated['items'],
            discountType: $validated['discount_type'] ?? null,
            discountValue: (float) ($validated['discount_value'] ?? 0),
            taxRate: isset($validated['tax_rate']) ? (float) $validated['tax_rate'] : null,
        );

        $order = DB::transaction(function () use ($validated, $pricing, $user) {
            $lastOrder = Order::withTrashed()->latest('id')->first();
            $nextNum = ($lastOrder ? $lastOrder->id : 0) + 1001;
            while (Order::withTrashed()->where('order_number', "ORD-{$nextNum}")->exists()) {
                $nextNum++;
            }
            $orderNumber = "ORD-{$nextNum}";

            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $validated['customer_id'],
                'created_by' => $user->id,
                'assigned_to' => $validated['assigned_to'] ?? null,
                'order_date' => $validated['order_date'] ?? now()->toDateString(),
                'status' => $validated['status'] ?? 'pending',
                'priority' => $validated['priority'] ?? 'normal',
                'subtotal' => $pricing['subtotal'],
                'discount_type' => $pricing['discount_type'],
                'discount_value' => $pricing['discount_value'],
                'discount_amount' => $pricing['discount_amount'],
                'tax_rate' => $pricing['tax_rate'],
                'tax_amount' => $pricing['tax_amount'],
                'total' => $pricing['total'],
                'notes' => $validated['notes'] ?? null,
                'stock_reserved' => false,
                'version' => 1,
            ]);

            foreach ($pricing['items'] as $itemData) {
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $itemData['product_id'],
                    'product_name' => $itemData['product_name'],
                    'sku' => $itemData['sku'],
                    'quantity' => $itemData['quantity'],
                    'unit_price' => $itemData['unit_price'],
                    'line_subtotal' => $itemData['line_subtotal'],
                    'discount_amount' => $itemData['discount_amount'],
                    'tax_amount' => $itemData['tax_amount'],
                    'line_total' => $itemData['line_total'],
                ]);
            }

            if (! empty($validated['notes'])) {
                OrderNote::create([
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'body' => $validated['notes'],
                ]);
            }

            OrderStatusHistory::create([
                'order_id' => $order->id,
                'from_status' => null,
                'to_status' => $order->status->value,
                'changed_by' => $user->id,
                'remarks' => 'Initial creation',
            ]);

            OrderActivity::create([
                'order_id' => $order->id,
                'user_id' => $user->id,
                'type' => 'created',
                'description' => 'Order created',
            ]);

            if ($order->assigned_to) {
                OrderActivity::create([
                    'order_id' => $order->id,
                    'user_id' => $user->id,
                    'type' => 'assigned',
                    'description' => 'Order assigned',
                ]);

                if ($order->assigned_to !== $user->id) {
                    $assigneeUser = User::find($order->assigned_to);
                    $assigneeUser?->notify(new OrderNotification(
                        type: 'order_assigned',
                        message: "You have been assigned order {$order->order_number}.",
                        orderId: $order->id,
                        orderNumber: $order->order_number,
                    ));
                }
            }

            AuditLogger::record(
                action: 'order.created',
                auditableType: 'order',
                auditableId: $order->id,
                label: "Created Order #{$order->order_number}",
                newValues: ['order_number' => $order->order_number, 'total' => $order->total]
            );

            return $order;
        });

        $fullOrder = $this->orderRepository->findWithRelations($order->id);

        return response()->json([
            'success' => true,
            'message' => 'Order created successfully',
            'data' => $this->formatOrderDetail($fullOrder, $user),
        ], 201);
    }

    public function show(int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user) {
            abort(401);
        }

        $order = $this->orderRepository->findWithRelations($id);
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

        return response()->json([
            'success' => true,
            'message' => 'Order retrieved successfully',
            'data' => $this->formatOrderDetail($order, $user),
        ]);
    }

    public function update(Request $request, int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->can('orders.update')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        $order = $this->orderRepository->findWithRelations($id);
        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        $request->validate([
            'version' => 'required|integer',
        ]);

        if ((int) $request->input('version') !== $order->version) {
            return response()->json([
                'success' => false,
                'message' => 'Order has been modified by another user.',
                'code' => 'CONFLICT',
                'errors' => [],
            ], 409);
        }

        if (! in_array($order->status->value, ['draft', 'pending'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft and pending orders can be updated.',
                'code' => 'VALIDATION_ERROR',
                'errors' => [],
            ], 422);
        }

        $validated = $request->validate([
            'priority' => 'sometimes|string|in:low,normal,high,urgent',
            'order_date' => 'sometimes|date',
            'customer_id' => 'sometimes|integer|exists:customers,id',
            'discount_type' => 'sometimes|nullable|string|in:fixed,percent',
            'discount_value' => 'sometimes|nullable|numeric|min:0',
            'tax_rate' => 'sometimes|nullable|numeric|min:0',
            'items' => 'sometimes|array|min:1',
            'items.*.product_id' => 'sometimes|integer|exists:products,id',
            'items.*.quantity' => 'sometimes|integer|min:1',
        ]);

        $oldValues = [];
        $newValues = [];

        DB::transaction(function () use ($order, $validated, &$oldValues, &$newValues) {
            if (isset($validated['items'])) {
                $pricing = $this->pricingService->calculate(
                    rawItems: $validated['items'],
                    discountType: $validated['discount_type'] ?? $order->discount_type,
                    discountValue: isset($validated['discount_value']) ? (float) $validated['discount_value'] : (float) $order->discount_value,
                    taxRate: isset($validated['tax_rate']) ? (float) $validated['tax_rate'] : (float) $order->tax_rate,
                );

                $order->items()->delete();
                foreach ($pricing['items'] as $itemData) {
                    OrderItem::create([
                        'order_id' => $order->id,
                        'product_id' => $itemData['product_id'],
                        'product_name' => $itemData['product_name'],
                        'sku' => $itemData['sku'],
                        'quantity' => $itemData['quantity'],
                        'unit_price' => $itemData['unit_price'],
                        'line_subtotal' => $itemData['line_subtotal'],
                        'discount_amount' => $itemData['discount_amount'],
                        'tax_amount' => $itemData['tax_amount'],
                        'line_total' => $itemData['line_total'],
                    ]);
                }

                $validated['subtotal'] = $pricing['subtotal'];
                $validated['discount_amount'] = $pricing['discount_amount'];
                $validated['tax_amount'] = $pricing['tax_amount'];
                $validated['total'] = $pricing['total'];
            }

            foreach ($validated as $key => $value) {
                if (in_array($key, ['version', 'items'], true)) {
                    continue;
                }
                $currentVal = $order->{$key} instanceof \BackedEnum ? $order->{$key}->value : $order->{$key};
                if ((string) $currentVal !== (string) $value) {
                    $oldValues[$key] = $currentVal;
                    $newValues[$key] = $value;
                }
            }

            $order->version = $order->version + 1;
            $order->fill(collect($validated)->except(['version', 'items'])->all());
            $order->save();

            if (! empty($newValues)) {
                AuditLogger::record(
                    action: 'order.updated',
                    auditableType: 'order',
                    auditableId: $order->id,
                    label: "Updated Order #{$order->order_number}",
                    oldValues: $oldValues,
                    newValues: $newValues
                );
            }
        });

        $fullOrder = $this->orderRepository->findWithRelations($order->id);

        return response()->json([
            'success' => true,
            'message' => 'Order updated successfully',
            'data' => $this->formatOrderDetail($fullOrder, $user),
        ]);
    }

    public function destroy(int $id): JsonResponse
    {
        $user = Auth::user();
        if (! $user || ! $user->hasRole('admin')) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }

        $order = $this->orderRepository->find($id);
        if (! $order) {
            return response()->json([
                'success' => false,
                'message' => 'Order not found.',
                'code' => 'NOT_FOUND',
                'errors' => [],
            ], 404);
        }

        if (! in_array($order->status->value, ['draft', 'cancelled'], true)) {
            return response()->json([
                'success' => false,
                'message' => 'Only draft or cancelled orders can be deleted.',
                'code' => 'VALIDATION_ERROR',
                'errors' => [],
            ], 422);
        }

        $order->delete();

        AuditLogger::record(
            action: 'order.deleted',
            auditableType: 'order',
            auditableId: $order->id,
            label: "Deleted Order #{$order->order_number}"
        );

        return response()->json([
            'success' => true,
            'message' => 'Order deleted successfully',
            'data' => null,
        ]);
    }

    protected function formatOrderDetail(Order $order, ?User $user = null): array
    {
        $user = $user ?? Auth::user();
        $status = $order->status->value;

        $allowedTransitions = [];
        if ($user) {
            if ($user->hasRole('staff') && ! $user->hasRole('admin') && ! $user->hasRole('manager')) {
                if ($order->assigned_to === $user->id) {
                    if ($status === 'confirmed') {
                        $allowedTransitions = ['processing'];
                    } elseif ($status === 'processing') {
                        $allowedTransitions = ['ready'];
                    }
                }
            } else {
                $allowedTransitions = match ($status) {
                    'draft' => ['pending', 'cancelled'],
                    'pending' => ['confirmed', 'cancelled', 'draft'],
                    'confirmed' => ['processing', 'cancelled'],
                    'processing' => ['ready', 'cancelled'],
                    'ready' => ['completed', 'cancelled'],
                    default => [],
                };
            }
        }

        $canEdit = $user && ($user->hasRole('admin') || $user->hasRole('manager') || $user->can('orders.update')) && in_array($status, ['draft', 'pending'], true);
        $canDelete = $user && $user->hasRole('admin') && in_array($status, ['draft', 'cancelled'], true);
        $canAssign = $user && ($user->hasRole('admin') || $user->hasRole('manager') || $user->can('orders.assign')) && ! in_array($status, ['completed', 'cancelled'], true);
        $canCancel = $user && ($user->hasRole('admin') || $user->hasRole('manager') || $user->can('orders.cancel')) && in_array('cancelled', $allowedTransitions, true);

        return [
            'id' => $order->id,
            'order_number' => $order->order_number,
            'customer' => $order->customer ? [
                'id' => $order->customer->id,
                'name' => $order->customer->name,
                'email' => $order->customer->email,
                'phone' => $order->customer->phone,
                'city' => $order->customer->city,
            ] : null,
            'creator' => $order->creator ? [
                'id' => $order->creator->id,
                'name' => $order->creator->name,
                'email' => $order->creator->email,
            ] : null,
            'assigned_to' => $order->assignee ? [
                'id' => $order->assignee->id,
                'name' => $order->assignee->name,
                'email' => $order->assignee->email,
            ] : null,
            'status' => $status,
            'priority' => $order->priority->value,
            'order_date' => $order->order_date instanceof \DateTimeInterface ? $order->order_date->format('Y-m-d') : ($order->order_date ? (string) $order->order_date : null),
            'subtotal' => (float) $order->subtotal,
            'discount_type' => $order->discount_type,
            'discount_value' => (float) $order->discount_value,
            'discount_amount' => (float) $order->discount_amount,
            'tax_rate' => (float) $order->tax_rate,
            'tax_amount' => (float) $order->tax_amount,
            'total' => (float) $order->total,
            'notes' => $order->notes,
            'stock_reserved' => (bool) $order->stock_reserved,
            'version' => $order->version,
            'confirmed_at' => $order->confirmed_at?->toIso8601String(),
            'completed_at' => $order->completed_at?->toIso8601String(),
            'cancelled_at' => $order->cancelled_at?->toIso8601String(),
            'cancellation_reason' => $order->cancellation_reason,
            'created_at' => $order->created_at?->toIso8601String(),
            'updated_at' => $order->updated_at?->toIso8601String(),
            'items' => $order->items->map(function (OrderItem $item) {
                return [
                    'id' => $item->id,
                    'product_id' => $item->product_id,
                    'product_name' => $item->product_name,
                    'sku' => $item->sku,
                    'quantity' => $item->quantity,
                    'unit_price' => (float) $item->unit_price,
                    'line_subtotal' => (float) $item->line_subtotal,
                    'discount_amount' => (float) $item->discount_amount,
                    'tax_amount' => (float) $item->tax_amount,
                    'line_total' => (float) $item->line_total,
                ];
            })->all(),
            'status_history' => $order->statusHistories->map(function (OrderStatusHistory $h) {
                return [
                    'id' => $h->id,
                    'from_status' => $h->from_status,
                    'to_status' => $h->to_status,
                    'remarks' => $h->remarks,
                    'changed_by' => $h->changed_by,
                    'user' => $h->changedBy ? ['id' => $h->changedBy->id, 'name' => $h->changedBy->name] : null,
                    'created_at' => $h->created_at?->toIso8601String(),
                ];
            })->all(),
            'notes_list' => ($order->notesList ?? collect())->map(function (OrderNote $n) {
                return [
                    'id' => $n->id,
                    'body' => $n->body,
                    'user' => $n->user ? ['id' => $n->user->id, 'name' => $n->user->name] : null,
                    'created_at' => $n->created_at?->toIso8601String(),
                ];
            })->all(),
            'activities' => $order->activities->map(function (OrderActivity $a) {
                return [
                    'id' => $a->id,
                    'type' => $a->type,
                    'description' => $a->description,
                    'user' => $a->user ? ['id' => $a->user->id, 'name' => $a->user->name] : null,
                    'created_at' => $a->created_at?->toIso8601String(),
                ];
            })->all(),
            'allowed_transitions' => $allowedTransitions,
            'permissions' => [
                'can_edit' => $canEdit,
                'can_delete' => $canDelete,
                'can_assign' => $canAssign,
                'can_cancel' => $canCancel,
            ],
        ];
    }
}
