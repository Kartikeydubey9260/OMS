<?php

declare(strict_types=1);

namespace OMS\Orders\Database\Seeders;

use Carbon\Carbon;
use Illuminate\Database\Seeder;
use OMS\Core\Models\AuditLog;
use OMS\Customers\Models\Customer;
use OMS\Orders\Enums\OrderPriority;
use OMS\Orders\Enums\OrderStatus;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderActivity;
use OMS\Orders\Models\OrderNote;
use OMS\Orders\Models\OrderStatusHistory;
use OMS\Products\Models\Product;
use OMS\Users\Models\User;

class OrderSeeder extends Seeder
{
    public function run(): void
    {
        $customers = Customer::all();
        $products = Product::all();
        $users = User::all();
        $staffUsers = User::role(['staff', 'manager'])->get();
        $admin = User::role('admin')->first() ?? $users->first();

        if ($customers->isEmpty() || $products->isEmpty() || $users->isEmpty()) {
            return;
        }

        $targetCount = 520;
        $currentCount = Order::count();
        if ($currentCount >= $targetCount) {
            return;
        }

        $toCreate = $targetCount - $currentCount;

        $statusWeights = [
            'draft' => 5,
            'pending' => 15,
            'confirmed' => 20,
            'processing' => 15,
            'ready' => 10,
            'completed' => 25,
            'cancelled' => 10,
        ];

        $statusPool = [];
        foreach ($statusWeights as $st => $weight) {
            for ($w = 0; $w < $weight; $w++) {
                $statusPool[] = $st;
            }
        }

        $priorities = [OrderPriority::LOW, OrderPriority::NORMAL, OrderPriority::NORMAL, OrderPriority::HIGH, OrderPriority::URGENT];

        for ($i = 1; $i <= $toCreate; $i++) {
            $orderNumber = sprintf('ORD-%05d', $currentCount + $i);
            $customer = $customers->random();
            $creator = $users->random();
            $assignedTo = fake()->boolean(80) ? $staffUsers->random()->id : null;
            $statusStr = $statusPool[array_rand($statusPool)];
            $status = OrderStatus::from($statusStr);
            $priority = $priorities[array_rand($priorities)];

            $daysAgo = fake()->numberBetween(0, 90);
            $createdAt = Carbon::now()->subDays($daysAgo)->subHours(fake()->numberBetween(1, 23));
            $orderDate = $createdAt->toDateString();

            $holdsStock = $status->holdsStock();
            $confirmedAt = in_array($statusStr, ['confirmed', 'processing', 'ready', 'completed'], true) ? (clone $createdAt)->addHours(2) : null;
            $completedAt = $statusStr === 'completed' ? (clone $createdAt)->addDays(fake()->numberBetween(1, 5)) : null;
            $cancelledAt = $statusStr === 'cancelled' ? (clone $createdAt)->addHours(fake()->numberBetween(2, 48)) : null;
            $cancellationReason = $statusStr === 'cancelled' ? fake()->randomElement(['Customer requested', 'Out of stock', 'Duplicate order', 'Payment timeout']) : null;

            // Pick 1 to 4 items
            $itemCount = fake()->numberBetween(1, 4);
            $selectedProducts = $products->random($itemCount);

            $subtotal = 0.00;
            $itemsData = [];

            foreach ($selectedProducts as $prod) {
                $qty = fake()->numberBetween(1, 4);
                $unitPrice = (float) $prod->price;
                $lineSubtotal = round($qty * $unitPrice, 2);
                $lineTax = round($lineSubtotal * 0.10, 2);
                $lineTotal = round($lineSubtotal + $lineTax, 2);

                $itemsData[] = [
                    'product_id' => $prod->id,
                    'product_name' => $prod->name,
                    'sku' => $prod->sku,
                    'quantity' => $qty,
                    'unit_price' => $unitPrice,
                    'line_subtotal' => $lineSubtotal,
                    'discount_amount' => 0.00,
                    'tax_amount' => $lineTax,
                    'line_total' => $lineTotal,
                ];

                $subtotal += $lineSubtotal;
            }

            $discountType = fake()->boolean(20) ? 'fixed' : null;
            $discountValue = $discountType ? (float) fake()->randomElement([10, 20, 50]) : 0.00;
            if ($discountValue > $subtotal) {
                $discountValue = 0.00;
                $discountType = null;
            }
            $discountAmount = $discountValue;
            $taxable = max(0.00, $subtotal - $discountAmount);
            $taxAmount = round($taxable * 0.10, 2);
            $total = round($taxable + $taxAmount, 2);

            $order = Order::create([
                'order_number' => $orderNumber,
                'customer_id' => $customer->id,
                'created_by' => $creator->id,
                'assigned_to' => $assignedTo,
                'status' => $status,
                'priority' => $priority,
                'order_date' => $orderDate,
                'subtotal' => $subtotal,
                'discount_type' => $discountType,
                'discount_value' => $discountValue,
                'discount_amount' => $discountAmount,
                'tax_rate' => 10.00,
                'tax_amount' => $taxAmount,
                'total' => $total,
                'notes' => fake()->boolean(30) ? fake()->sentence() : null,
                'stock_reserved' => $holdsStock,
                'confirmed_at' => $confirmedAt,
                'completed_at' => $completedAt,
                'cancelled_at' => $cancelledAt,
                'cancellation_reason' => $cancellationReason,
                'version' => 1,
                'created_at' => $createdAt,
                'updated_at' => $createdAt,
            ]);

            foreach ($itemsData as $item) {
                $order->items()->create($item);
            }

            // Create status history chain
            $historyChain = match ($statusStr) {
                'draft' => [
                    [null, 'draft', 'Order created as draft', $createdAt],
                ],
                'pending' => [
                    [null, 'pending', 'Order placed', $createdAt],
                ],
                'confirmed' => [
                    [null, 'pending', 'Order placed', $createdAt],
                    ['pending', 'confirmed', 'Order confirmed and inventory reserved', $confirmedAt ?? $createdAt],
                ],
                'processing' => [
                    [null, 'pending', 'Order placed', $createdAt],
                    ['pending', 'confirmed', 'Order confirmed', (clone $createdAt)->addHours(1)],
                    ['confirmed', 'processing', 'Processing started in warehouse', $confirmedAt ?? $createdAt],
                ],
                'ready' => [
                    [null, 'pending', 'Order placed', $createdAt],
                    ['pending', 'confirmed', 'Order confirmed', (clone $createdAt)->addHours(1)],
                    ['confirmed', 'processing', 'Processing started', (clone $createdAt)->addHours(3)],
                    ['processing', 'ready', 'Packed and ready for dispatch', (clone $createdAt)->addHours(6)],
                ],
                'completed' => [
                    [null, 'pending', 'Order placed', $createdAt],
                    ['pending', 'confirmed', 'Order confirmed', (clone $createdAt)->addHours(1)],
                    ['confirmed', 'processing', 'Processing in warehouse', (clone $createdAt)->addHours(3)],
                    ['processing', 'ready', 'Packed and ready', (clone $createdAt)->addHours(6)],
                    ['ready', 'completed', 'Delivered to customer', $completedAt ?? (clone $createdAt)->addDays(2)],
                ],
                default => [
                    [null, 'pending', 'Order placed', $createdAt],
                    ['pending', 'cancelled', $cancellationReason ?? 'Cancelled', $cancelledAt ?? (clone $createdAt)->addHours(2)],
                ],
            };

            foreach ($historyChain as $step) {
                OrderStatusHistory::create([
                    'order_id' => $order->id,
                    'from_status' => $step[0],
                    'to_status' => $step[1],
                    'changed_by' => $creator->id,
                    'remarks' => $step[2],
                    'created_at' => $step[3],
                ]);
            }

            // Activity
            OrderActivity::create([
                'order_id' => $order->id,
                'user_id' => $creator->id,
                'type' => 'created',
                'description' => "Order {$orderNumber} was placed",
                'meta' => ['total' => $total, 'items_count' => count($itemsData)],
                'created_at' => $createdAt,
            ]);

            if ($statusStr !== 'draft' && $statusStr !== 'pending') {
                OrderActivity::create([
                    'order_id' => $order->id,
                    'user_id' => $assignedTo ?? $admin->id,
                    'type' => 'status_changed',
                    'description' => "Order status updated to {$statusStr}",
                    'meta' => ['status' => $statusStr],
                    'created_at' => $confirmedAt ?? $createdAt,
                ]);
            }

            // Occasional note
            if (fake()->boolean(25)) {
                OrderNote::create([
                    'order_id' => $order->id,
                    'user_id' => $assignedTo ?? $admin->id,
                    'body' => fake()->sentence(),
                    'created_at' => (clone $createdAt)->addHours(1),
                ]);
            }

            // Audit log
            if (fake()->boolean(30)) {
                AuditLog::create([
                    'user_id' => $creator->id,
                    'action' => 'order.created',
                    'auditable_type' => 'order',
                    'auditable_id' => $order->id,
                    'label' => "Created order #{$orderNumber}",
                    'old_values' => null,
                    'new_values' => ['status' => $statusStr, 'total' => $total],
                    'ip_address' => '127.0.0.1',
                    'created_at' => $createdAt,
                ]);
            }
        }
    }
}
