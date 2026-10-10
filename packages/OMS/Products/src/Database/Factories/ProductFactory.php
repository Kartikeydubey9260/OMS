<?php

declare(strict_types=1);

namespace OMS\Products\Database\Factories;

use Illuminate\Database\Eloquent\Factories\Factory;
use OMS\Products\Models\Product;

/**
 * @extends Factory<Product>
 */
class ProductFactory extends Factory
{
    protected $model = Product::class;

    public function definition(): array
    {
        return [
            'sku' => 'SKU-'.strtoupper(fake()->unique()->bothify('??###')),
            'name' => fake()->words(3, true),
            'description' => fake()->sentence(),
            'price' => fake()->numberBetween(10, 200),
            'tax_rate' => 10.00,
            'stock_quantity' => 100,
            'low_stock_threshold' => 5,
            'status' => 'active',
        ];
    }

    public function inactive(): static
    {
        return $this->state(fn (array $attributes) => [
            'status' => 'inactive',
        ]);
    }
}
