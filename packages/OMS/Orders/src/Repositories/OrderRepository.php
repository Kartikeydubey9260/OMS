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
        $query = Order::query()->with(['customer', 'assignee', 'creator']);

        if ($user && $user->can('orders.view_assigned') && ! $user->can('orders.view_all')) {
            $query->where('assigned_to', $user->id);
        }

        if (! empty($filters['status'])) {
            $query->where('status', $filters['status']);
        }

        if (! empty($filters['customer_id'])) {
            $query->where('customer_id', $filters['customer_id']);
        }

        if (! empty($filters['assigned_to'])) {
            $query->where('assigned_to', $filters['assigned_to']);
        }

        if (! empty($filters['priority'])) {
            $query->where('priority', $filters['priority']);
        }

        if (! empty($filters['date_from'])) {
            $query->whereDate('order_date', '>=', $filters['date_from']);
        }

        if (! empty($filters['date_to'])) {
            $query->whereDate('order_date', '<=', $filters['date_to']);
        }

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('order_number', 'like', "%{$search}%")
                    ->orWhereHas('customer', function ($cq) use ($search) {
                        $cq->where('name', 'like', "%{$search}%")
                            ->orWhere('email', 'like', "%{$search}%");
                    });
            });
        }

        $sort = $filters['sort'] ?? 'order_date';
        $direction = strtolower($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sort, ['id', 'order_number', 'order_date', 'total', 'created_at', 'status', 'priority'], true)) {
            $query->orderBy($sort, $direction);
        } else {
            $query->orderBy('order_date', 'desc')->latest('id');
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
            'creator',
            'assignee',
            'items.product',
            'statusHistories.changedBy',
            'notes.user',
            'activities.user',
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
