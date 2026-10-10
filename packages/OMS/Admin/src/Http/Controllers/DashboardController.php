<?php

declare(strict_types=1);

namespace OMS\Admin\Http\Controllers;

use Carbon\Carbon;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Routing\Controller;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use OMS\Customers\Models\Customer;
use OMS\Orders\Models\Order;
use OMS\Products\Models\Product;

class DashboardController extends Controller
{
    public function summary(): JsonResponse
    {
        $this->authorizePermission('dashboard.view');

        $totalOrders = Order::count();
        $pendingOrders = Order::where('status', 'pending')->count();
        $confirmedOrders = Order::where('status', 'confirmed')->count();
        $processingOrders = Order::where('status', 'processing')->count();
        $completedOrders = Order::where('status', 'completed')->count();
        $cancelledOrders = Order::where('status', 'cancelled')->count();

        $totalRevenue = (float) Order::where('status', 'completed')->sum('total');
        $averageOrderValue = $completedOrders > 0 ? round($totalRevenue / $completedOrders, 2) : 0.0;

        $totalCustomers = Customer::count();
        $totalProducts = Product::count();

        return response()->json([
            'success' => true,
            'message' => 'Dashboard summary retrieved successfully',
            'data' => [
                'total_orders' => $totalOrders,
                'pending_orders' => $pendingOrders,
                'confirmed_orders' => $confirmedOrders,
                'processing_orders' => $processingOrders,
                'completed_orders' => $completedOrders,
                'cancelled_orders' => $cancelledOrders,
                'total_revenue' => $totalRevenue,
                'average_order_value' => $averageOrderValue,
                'total_customers' => $totalCustomers,
                'total_products' => $totalProducts,
            ],
        ]);
    }

    public function statusDistribution(): JsonResponse
    {
        $this->authorizePermission('dashboard.view');

        $statuses = ['draft', 'pending', 'confirmed', 'processing', 'ready', 'completed', 'cancelled'];
        $counts = Order::query()
            ->select('status', DB::raw('count(*) as count'))
            ->groupBy('status')
            ->pluck('count', 'status')
            ->all();

        $data = [];
        foreach ($statuses as $st) {
            $count = (int) ($counts[$st] ?? 0);
            if ($count > 0 || Order::count() === 0) {
                $data[] = [
                    'status' => $st,
                    'count' => $count,
                ];
            }
        }

        // If specific non-empty orders exist that weren't included (e.g. only subset of statuses present)
        // Make sure all statuses present in DB are returned
        $presentStatuses = array_keys($counts);
        foreach ($presentStatuses as $st) {
            if (! collect($data)->contains('status', $st)) {
                $data[] = [
                    'status' => $st,
                    'count' => (int) $counts[$st],
                ];
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Status distribution retrieved successfully',
            'data' => $data,
        ]);
    }

    public function revenueTrend(Request $request): JsonResponse
    {
        $this->authorizePermission('dashboard.view');

        $validated = $request->validate([
            'period' => 'required|string|in:day,week,month',
            'from' => 'sometimes|date_format:Y-m-d',
            'to' => 'sometimes|date_format:Y-m-d',
        ]);

        $periodType = $validated['period'];
        $from = isset($validated['from']) ? Carbon::parse($validated['from'])->startOfDay() : now()->subDays(30)->startOfDay();
        $to = isset($validated['to']) ? Carbon::parse($validated['to'])->endOfDay() : now()->endOfDay();

        $completedOrders = Order::query()
            ->where('status', 'completed')
            ->whereDate('order_date', '>=', $from->toDateString())
            ->whereDate('order_date', '<=', $to->toDateString())
            ->get(['order_date', 'total']);

        $result = [];

        if ($periodType === 'day') {
            $current = $from->copy();
            while ($current->lte($to)) {
                $label = $current->format('Y-m-d');
                $matching = $completedOrders->filter(fn ($o) => Carbon::parse($o->order_date)->format('Y-m-d') === $label);

                $result[] = [
                    'label' => $label,
                    'revenue' => (float) round($matching->sum('total'), 2),
                    'orders' => $matching->count(),
                ];
                $current->addDay();
            }
        } elseif ($periodType === 'month') {
            $current = $from->copy()->startOfMonth();
            $endMonth = $to->copy()->startOfMonth();
            while ($current->lte($endMonth)) {
                $label = $current->format('Y-m');
                $matching = $completedOrders->filter(fn ($o) => Carbon::parse($o->order_date)->format('Y-m') === $label);

                $result[] = [
                    'label' => $label,
                    'revenue' => (float) round($matching->sum('total'), 2),
                    'orders' => $matching->count(),
                ];
                $current->addMonth();
            }
        } elseif ($periodType === 'week') {
            $current = $from->copy()->startOfWeek();
            while ($current->lte($to)) {
                $weekEnd = $current->copy()->endOfWeek();
                $label = $current->format('Y').'-W'.str_pad((string) $current->weekOfYear, 2, '0', STR_PAD_LEFT);
                $matching = $completedOrders->filter(function ($o) use ($current, $weekEnd) {
                    $d = Carbon::parse($o->order_date);

                    return $d->gte($current->startOfDay()) && $d->lte($weekEnd->endOfDay());
                });

                $result[] = [
                    'label' => $label,
                    'revenue' => (float) round($matching->sum('total'), 2),
                    'orders' => $matching->count(),
                ];
                $current->addWeek();
            }
        }

        return response()->json([
            'success' => true,
            'message' => 'Revenue trend retrieved successfully',
            'data' => $result,
        ]);
    }

    protected function authorizePermission(string $permission): void
    {
        $user = Auth::user();
        if (! $user || ! $user->can($permission)) {
            abort(response()->json([
                'success' => false,
                'message' => 'This action is unauthorized.',
                'code' => 'FORBIDDEN',
                'errors' => [],
            ], 403));
        }
    }
}
