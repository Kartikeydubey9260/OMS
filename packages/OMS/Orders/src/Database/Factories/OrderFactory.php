<?php

declare(strict_types=1);

namespace OMS\Orders\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use OMS\Customers\Models\Customer;
use OMS\Orders\Enums\OrderPriority;
use OMS\Orders\Enums\OrderStatus;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderItem;
use OMS\Products\Models\Product;
use OMS\Users\Models\User;

/**
 * @extends Factory<Order>
 */
class OrderFactory extends Factory
{
    protected $model = Order::class;

    protected static int $orderSequence = 10000;

    public function definition(): array
    {
        self::$orderSequence++;
        $subtotal = 20.00;
        $taxAmount = 2.00;
        $total = 22.00;

        return [
            'order_number' => 'ORD-'.self::$orderSequence,
            'customer_id' => Customer::factory(),
            'created_by' => User::factory(),
            'assigned_to' => null,
            'status' => OrderStatus::PENDING,
            'priority' => OrderPriority::NORMAL,
            'order_date' => now()->toDateString(),
            'subtotal' => $subtotal,
            'discount_type' => null,
            'discount_value' => 0.00,
            'discount_amount' => 0.00,
            'tax_rate' => 10.00,
            'tax_amount' => $taxAmount,
            'total' => $total,
            'notes' => null,
            'stock_reserved' => false,
            'confirmed_at' => null,
            'completed_at' => null,
            'cancelled_at' => null,
            'cancellation_reason' => null,
            'version' => 1,
        ];
    }

    public function configure(): static
    {
        return $this->afterCreating(function (Order $order) {
            if ($order->items()->count() === 0) {
                $product = Product::factory()->create(['price' => $order->subtotal]);
                OrderItem::create([
                    'order_id' => $order->id,
                    'product_id' => $product->id,
                    'product_name' => $product->name,
                    'sku' => $product->sku,
                    'quantity' => 1,
                    'unit_price' => $order->subtotal,
                    'line_subtotal' => $order->subtotal,
                    'discount_amount' => $order->discount_amount ?: 0.00,
                    'tax_amount' => $order->tax_amount ?: 0.00,
                    'line_total' => $order->total,
                ]);
            }
        });
    }

    public function draft(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::DRAFT,
            'stock_reserved' => false,
        ]);
    }

    public function pending(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::PENDING,
            'stock_reserved' => false,
        ]);
    }

    public function confirmed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::CONFIRMED,
            'stock_reserved' => true,
            'confirmed_at' => now(),
        ]);
    }

    public function processing(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::PROCESSING,
            'stock_reserved' => true,
            'confirmed_at' => now()->subHours(2),
        ]);
    }

    public function ready(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::READY,
            'stock_reserved' => true,
            'confirmed_at' => now()->subHours(4),
        ]);
    }

    public function completed(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::COMPLETED,
            'stock_reserved' => true,
            'confirmed_at' => now()->subDays(1),
            'completed_at' => now(),
        ]);
    }

    public function cancelled(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => OrderStatus::CANCELLED,
            'stock_reserved' => false,
            'cancelled_at' => now(),
            'cancellation_reason' => 'Customer request',
        ]);
    }
}
