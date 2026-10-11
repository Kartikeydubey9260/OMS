<?php

declare(strict_types=1);

namespace OMS\Admin\Services;

use Illuminate\Database\Query\Builder;
use Illuminate\Support\Collection;
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

/**
 * Builds the dashboard reporting dataset (top products/clients + per-client
 * and per-product reports) for the OMS variant.
 *
 * All aggregations run in the database; orders are never trusted from the
 * client. Soft-deleted orders are always excluded.
 */
class ReportService
{
    public const STATUSES = [
        'draft',
        'pending',
        'confirmed',
        'processing',
        'ready',
        'completed',
        'cancelled',
    ];

    public const MONTHS = [
        ['value' => '1', 'name' => 'January'],
        ['value' => '2', 'name' => 'February'],
        ['value' => '3', 'name' => 'March'],
        ['value' => '4', 'name' => 'April'],
        ['value' => '5', 'name' => 'May'],
        ['value' => '6', 'name' => 'June'],
        ['value' => '7', 'name' => 'July'],
        ['value' => '8', 'name' => 'August'],
        ['value' => '9', 'name' => 'September'],
        ['value' => '10', 'name' => 'October'],
        ['value' => '11', 'name' => 'November'],
        ['value' => '12', 'name' => 'December'],
    ];

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function build(array $filters = [], int $limit = 10): array
    {
        return [
            'summary' => $this->summary($filters),
            'orders_by_status' => $this->ordersByStatus($filters),
            'top_products_by_quantity' => $this->topProducts($filters, 'quantity', $limit),
            'top_products_by_price' => $this->topProducts($filters, 'price', $limit),
            'top_clients_by_orders' => $this->topCustomers($filters, 'orders', $limit),
            'top_clients_by_price' => $this->topCustomers($filters, 'price', $limit),
            'per_client_report' => $this->perCustomer($filters),
            'per_product_report' => $this->perProduct($filters),
            'filter_options' => $this->filterOptions(),
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return array<string, mixed>
     */
    public function summary(array $filters): array
    {
        $orders = $this->applyOrderFilters(
            \Illuminate\Support\Facades\DB::table('orders')->whereNull('orders.deleted_at'),
            $filters,
        );

        $totalOrders = (int) (clone $orders)->count();
        $totalRevenue = round((float) (clone $orders)->sum('orders.total'), 2);
        $avgOrderValue = $totalOrders > 0 ? round($totalRevenue / $totalOrders, 2) : 0.0;

        $items = \Illuminate\Support\Facades\DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNull('orders.deleted_at');
        $items = $this->applyOrderFilters($items, $filters);
        $totalItemsSold = (int) $items->sum('order_items.quantity');

        return [
            'total_revenue' => $totalRevenue,
            'total_orders' => $totalOrders,
            'total_customers' => Customer::count(),
            'total_products' => Product::count(),
            'total_items_sold' => $totalItemsSold,
            'average_order_value' => $avgOrderValue,
        ];
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, object>
     */
    public function ordersByStatus(array $filters): Collection
    {
        $query = $this->applyOrderFilters(
            \Illuminate\Support\Facades\DB::table('orders')->whereNull('orders.deleted_at'),
            $filters,
        );

        return $query
            ->select('orders.status', \Illuminate\Support\Facades\DB::raw('COUNT(*) as count'), \Illuminate\Support\Facades\DB::raw('COALESCE(SUM(orders.total), 0) as revenue'))
            ->groupBy('orders.status')
            ->orderByDesc('revenue')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, object>
     */
    public function topProducts(array $filters, string $sortBy = 'quantity', int $limit = 10): Collection
    {
        $query = \Illuminate\Support\Facades\DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->join('products', 'order_items.product_id', '=', 'products.id')
            ->whereNull('orders.deleted_at');
        $query = $this->applyOrderFilters($query, $filters);

        $orderColumn = $sortBy === 'price' ? 'total_revenue' : 'total_quantity';

        return $query
            ->select(
                'products.id as product_id',
                'products.name as product_name',
                'products.sku',
                'products.price as unit_price',
                \Illuminate\Support\Facades\DB::raw('SUM(order_items.quantity) as total_quantity'),
                \Illuminate\Support\Facades\DB::raw('COALESCE(SUM(order_items.line_total), 0) as total_revenue'),
                \Illuminate\Support\Facades\DB::raw('COUNT(DISTINCT orders.id) as orders_count'),
            )
            ->groupBy('products.id', 'products.name', 'products.sku', 'products.price')
            ->orderByDesc($orderColumn)
            ->limit($limit)
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, object>
     */
    public function topCustomers(array $filters, string $sortBy = 'orders', int $limit = 10): Collection
    {
        $query = \Illuminate\Support\Facades\DB::table('orders')
            ->join('customers', 'orders.customer_id', '=', 'customers.id')
            ->whereNull('orders.deleted_at');
        $query = $this->applyOrderFilters($query, $filters);

        $orderColumn = $sortBy === 'price' ? 'total_spent' : 'orders_count';

        return $query
            ->select(
                'customers.id as client_id',
                'customers.name as client_name',
                'customers.email',
                \Illuminate\Support\Facades\DB::raw('COUNT(orders.id) as orders_count'),
                \Illuminate\Support\Facades\DB::raw('COALESCE(SUM(orders.total), 0) as total_spent'),
            )
            ->groupBy('customers.id', 'customers.name', 'customers.email')
            ->orderByDesc($orderColumn)
            ->limit($limit)
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, object>
     */
    public function perCustomer(array $filters): Collection
    {
        $stats = \Illuminate\Support\Facades\DB::table('orders')->whereNull('orders.deleted_at');
        $stats = $this->applyOrderFilters($stats, $filters);
        $stats = $stats
            ->select(
                'orders.customer_id',
                \Illuminate\Support\Facades\DB::raw('COUNT(orders.id) as orders_count'),
                \Illuminate\Support\Facades\DB::raw('COALESCE(SUM(orders.total), 0) as total_spent'),
                \Illuminate\Support\Facades\DB::raw('COALESCE(AVG(orders.total), 0) as avg_order_value'),
                \Illuminate\Support\Facades\DB::raw('MAX(orders.order_date) as latest_order_date'),
            )
            ->groupBy('orders.customer_id');

        $quantities = \Illuminate\Support\Facades\DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNull('orders.deleted_at');
        $quantities = $this->applyOrderFilters($quantities, $filters);
        $quantities = $quantities
            ->select('orders.customer_id', \Illuminate\Support\Facades\DB::raw('SUM(order_items.quantity) as total_quantity'))
            ->groupBy('orders.customer_id');

        $query = \Illuminate\Support\Facades\DB::table('customers')
            ->leftJoinSub($stats, 'p_stats', 'customers.id', '=', 'p_stats.customer_id')
            ->leftJoinSub($quantities, 'q_stats', 'customers.id', '=', 'q_stats.customer_id');

        $customerId = $filters['customer_id'] ?? null;
        if ($customerId !== null && $customerId !== '' && $customerId !== 'all') {
            $query->where('customers.id', (int) $customerId);
        } else {
            $query->whereNotNull('p_stats.customer_id');
        }

        return $query
            ->select(
                'customers.id as client_id',
                'customers.name as client_name',
                'customers.email',
                'p_stats.orders_count',
                'p_stats.total_spent',
                'p_stats.avg_order_value',
                'p_stats.latest_order_date',
                \Illuminate\Support\Facades\DB::raw('COALESCE(q_stats.total_quantity, 0) as total_quantity'),
            )
            ->orderByDesc('p_stats.total_spent')
            ->get();
    }

    /**
     * @param  array<string, mixed>  $filters
     * @return Collection<int, object>
     */
    public function perProduct(array $filters): Collection
    {
        $stats = \Illuminate\Support\Facades\DB::table('order_items')
            ->join('orders', 'order_items.order_id', '=', 'orders.id')
            ->whereNull('orders.deleted_at');
        $stats = $this->applyOrderFilters($stats, $filters);
        $stats = $stats
            ->select(
                'order_items.product_id',
                \Illuminate\Support\Facades\DB::raw('COUNT(DISTINCT orders.id) as orders_count'),
                \Illuminate\Support\Facades\DB::raw('SUM(order_items.quantity) as total_quantity_sold'),
                \Illuminate\Support\Facades\DB::raw('COALESCE(SUM(order_items.line_total), 0) as total_revenue'),
            )
            ->groupBy('order_items.product_id');

        $query = \Illuminate\Support\Facades\DB::table('products')
            ->joinSub($stats, 'i_stats', 'products.id', '=', 'i_stats.product_id');

        $productId = $filters['product_id'] ?? null;
        if ($productId !== null && $productId !== '' && $productId !== 'all') {
            $query->where('products.id', (int) $productId);
        }

        return $query
            ->select(
                'products.id as product_id',
                'products.name as product_name',
                'products.sku',
                'products.price as unit_price',
                'i_stats.orders_count',
                'i_stats.total_quantity_sold',
                'i_stats.total_revenue',
            )
            ->orderByDesc('i_stats.total_revenue')
            ->get();
    }

    /**
     * @return array<string, mixed>
     */
    public function filterOptions(): array
    {
        $minDate = Order::query()->whereNotNull('order_date')->min('order_date');
        $maxDate = Order::query()->whereNotNull('order_date')->max('order_date');

        $years = [];
        if ($minDate && $maxDate) {
            $from = (int) substr((string) $minDate, 0, 4);
            $to = (int) substr((string) $maxDate, 0, 4);
            for ($year = $to; $year >= $from; $year--) {
                $years[] = (string) $year;
            }
        }

        return [
            'years' => $years,
            'months' => self::MONTHS,
            'statuses' => self::STATUSES,
            'clients' => Customer::query()->select('id', 'name', 'email')->orderBy('name')->get(),
            'products' => Product::query()->select('id', 'name', 'sku')->orderBy('name')->get(),
        ];
    }

    /**
     * Apply the shared report filters to an order-based query.
     *
     * The query must expose the `orders` table (directly or via join).
     *
     * @param  array<string, mixed>  $filters
     */
    protected function applyOrderFilters(Builder $query, array $filters): Builder
    {
        $status = $filters['status'] ?? null;
        if ($status !== null && $status !== '' && $status !== 'all') {
            if (is_array($status)) {
                $query->whereIn('orders.status', $status);
            } else {
                $query->where('orders.status', $status);
            }
        }

        $year = $filters['year'] ?? null;
        if ($year !== null && $year !== '' && $year !== 'all') {
            $query->whereYear('orders.order_date', (int) $year);
        }

        $month = $filters['month'] ?? null;
        if ($month !== null && $month !== '' && $month !== 'all') {
            $query->whereMonth('orders.order_date', (int) $month);
        }

        if (! empty($filters['start_date'])) {
            $query->whereDate('orders.order_date', '>=', $filters['start_date']);
        }

        if (! empty($filters['end_date'])) {
            $query->whereDate('orders.order_date', '<=', $filters['end_date']);
        }

        $customerId = $filters['customer_id'] ?? null;
        if ($customerId !== null && $customerId !== '' && $customerId !== 'all') {
            $query->where('orders.customer_id', (int) $customerId);
        }

        $productId = $filters['product_id'] ?? null;
        if ($productId !== null && $productId !== '' && $productId !== 'all') {
            $productId = (int) $productId;
            $query->whereExists(function ($sub) use ($productId) {
                $sub->select(\Illuminate\Support\Facades\DB::raw(1))
                    ->from('order_items')
                    ->whereColumn('order_items.order_id', 'orders.id')
                    ->where('order_items.product_id', $productId);
            });
        }

        return $query;
    }
}
