<?php

declare(strict_types=1);

namespace OMS\Orders\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use OMS\Orders\Models\Order;
use OMS\Orders\Models\OrderItem;
use OMS\Products\Models\Product;

/**
 * @extends Factory<OrderItem>
 */
class OrderItemFactory extends Factory
{
    protected $model = OrderItem::class;

    public function definition(): array
    {
        $quantity = fake()->numberBetween(1, 5);
        $unitPrice = fake()->randomFloat(2, 10, 200);
        $lineSubtotal = round($quantity * $unitPrice, 2);

        return [
            'order_id' => Order::factory(),
            'product_id' => Product::factory(),
            'product_name' => fake()->words(3, true),
            'sku' => 'SKU-'.strtoupper(fake()->unique()->bothify('??###')),
            'quantity' => $quantity,
            'unit_price' => $unitPrice,
            'line_subtotal' => $lineSubtotal,
            'discount_amount' => 0.00,
            'tax_amount' => round($lineSubtotal * 0.10, 2),
            'line_total' => round($lineSubtotal + ($lineSubtotal * 0.10), 2),
        ];
    }
}
