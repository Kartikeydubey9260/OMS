<?php

declare(strict_types=1);

namespace OMS\Customers\Repositories;

use Illuminate\Contracts\Pagination\LengthAwarePaginator;
use OMS\Customers\Models\Customer;

class CustomerRepository
{
    /**
     * @param  array<string, mixed>  $filters
     */
    public function paginate(array $filters = [], int $perPage = 15): LengthAwarePaginator
    {
        $query = Customer::query();

        if (! empty($filters['search'])) {
            $search = $filters['search'];
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                    ->orWhere('email', 'like', "%{$search}%")
                    ->orWhere('company', 'like', "%{$search}%");
            });
        }

        if (isset($filters['is_active']) && $filters['is_active'] !== '') {
            $query->where('is_active', filter_var($filters['is_active'], FILTER_VALIDATE_BOOLEAN));
        }

        $sort = $filters['sort'] ?? 'id';
        $direction = strtolower($filters['direction'] ?? 'desc') === 'asc' ? 'asc' : 'desc';

        if (in_array($sort, ['id', 'name', 'email', 'created_at'], true)) {
            $query->orderBy($sort, $direction);
        } else {
            $query->latest('id');
        }

        return $query->paginate($perPage);
    }

    public function find(int $id): ?Customer
    {
        return Customer::find($id);
    }

    public function findWithStats(int $id): ?Customer
    {
        $customer = Customer::with(['orders' => function ($q) {
            $q->latest('created_at')->limit(5);
        }])->find($id);

        if (! $customer) {
            return null;
        }

        $orders = $customer->orders();
        $customer->total_orders = (clone $orders)->count();
        $customer->pending_orders = (clone $orders)->where('status', 'pending')->count();
        $customer->completed_orders = (clone $orders)->where('status', 'completed')->count();
        $customer->cancelled_orders = (clone $orders)->where('status', 'cancelled')->count();
        $customer->total_order_value = (string) (clone $orders)->whereNotIn('status', ['cancelled', 'draft'])->sum('total');
        $customer->recent_orders = $customer->orders;

        return $customer;
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function create(array $data): Customer
    {
        return Customer::create($data);
    }

    /**
     * @param  array<string, mixed>  $data
     */
    public function update(Customer $customer, array $data): bool
    {
        return $customer->update($data);
    }

    public function delete(Customer $customer): bool
    {
        return (bool) $customer->delete();
    }
}
