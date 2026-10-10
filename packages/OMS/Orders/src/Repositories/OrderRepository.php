<?php

declare(strict_types=1);

namespace OMS\Orders\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use OMS\Orders\Models\Order;
use OMS\Users\Models\User;

class OrderRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 15, ?User $user = null): LengthAwarePaginator
    {
        $query = Order::query()->with([
            'customer:id,name,email',
            'assignee:id,name,email',
        ]);

        // Staff scope: if user cannot view all orders, restrict to assigned orders
        if ($user && (! $user->can('orders.view_all'))) {
            $query->where('assigned_to', $user->id);
        }

        // Status filter (single or array)
        if (! empty($filters['status'])) {
            if (is_array($filters['status'])) {
                $query->whereIn('status', $filters['status']);
            } else {
                $query->where('status', $filters['status']);
            }
        }

        // Customer filter
        if (! empty($filters['customer_id'])) {
            $query->where('customer_id', (int) $filters['customer_id']);
        }

        // Assignee filter (only applies if user has orders.view_all)
        if (! empty($filters['assigned_to']) && (! $user || $user->can('orders.view_all'))) {
            $query->where('assigned_to', (int) $filters['assigned_to']);
        }

        // Priority filter
        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        // Date range filters
        if (! empty($filters['date_from'])) {
            $query->whereDate('order_date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('order_date', '<=', $filters['date_to']);
        }

        // Search: order number, customer name, customer email, product name, product sku, assignee name
        if (isset($filters['search']) && $filters['search'] !== '') {
            $rawSearch = (string) $filters['search'];
            $escaped = str_replace(['\\', '%', '_'], ['\\\\', '\\%', '\\_'], $rawSearch);

            $query->where(function ($q) use ($escaped) {
                $q->where('order_number', 'like', "%{$escaped}%")
                    ->orWhereHas('customer', function ($cq) use ($escaped) {
                        $cq->withTrashed()->where(function ($q) use ($escaped) {
                            $q->where('name', 'like', "%{$escaped}%")
                                ->orWhere('email', 'like', "%{$escaped}%");
                        });
                    })
                    ->orWhereHas('items', function ($iq) use ($escaped) {
                        $iq->where('product_name', 'like', "%{$escaped}%")
                            ->orWhere('sku', 'like', "%{$escaped}%");
                    })
                    ->orWhereHas('assignee', function ($aq) use ($escaped) {
                        $aq->withTrashed()->where('name', 'like', "%{$escaped}%");
                    });
            });
        }

        // Sorting
        $sort = $filters['sort'] ?? 'order_date';
        $direction = strtolower($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        if ($sort === 'customer') {
            $query->join('customers', 'orders.customer_id', '=', 'customers.id')
                ->orderBy('customers.name', $direction)
                ->select('orders.*');
        } elseif (in_array($sort, ['order_date', 'total', 'status', 'priority', 'created_at'], true)) {
            $query->orderBy($sort, $direction);
        } else {
            $query->latest('id');
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): ?Order
    {
        return Order::find($id);
    }

    public function findWithRelations(int $id): ?Order
    {
        return Order::with([
            'customer',
            'creator:id,name,email',
            'assignee:id,name,email',
            'items',
            'statusHistories.changedBy:id,name,email',
            'notesList.user:id,name,email',
            'activities.user:id,name,email',
        ])->find($id);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Order
    {
        return Order::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Order $order, array $data): bool
    {
        return $order->update($data);
    }

    public function delete(Order $order): bool
    {
        return (bool) $order->delete();
    }
}
